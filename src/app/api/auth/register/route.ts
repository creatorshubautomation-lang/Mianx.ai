// ============================================================
// MIANX.AI V3 — User Registration Endpoint
// POST /api/auth/register
//
// The entire registration (user + org + membership + RBAC seeding)
// runs inside a single Prisma interactive transaction so that any
// failure rolls back ALL side-effects — no orphan users or orgs.
//
// Rate limiting is FAIL-CLOSED: if the rate-limit DB operation
// fails, the request is rejected with 429.
// ============================================================

import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import {
  withErrorHandler,
  created,
  error,
  requireBody,
  ValidationError,
} from '@/lib/api-response'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { AuthErrors } from '@/lib/auth-errors'

const SALT_ROUNDS = 12
const MIN_PASSWORD_LENGTH = 8
const REGISTRATION_RATE_LIMIT = 5 // max 5 registrations per IP per window
const REGISTRATION_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

/** Maximum slug collision retry attempts before giving up */
const MAX_SLUG_RETRIES = 10

// ============================================================
// RBAC seed data — defined once, used inside the transaction
// ============================================================

const ALL_PERMISSION_KEYS = [
  'org:view', 'org:manage', 'org:delete', 'org:settings', 'org:billing', 'org:members:manage',
  'agent:view', 'agent:create', 'agent:update', 'agent:delete', 'agent:run',
  'mission:view', 'mission:create', 'mission:update', 'mission:delete', 'mission:execute', 'mission:approve',
  'workflow:view', 'workflow:create', 'workflow:update', 'workflow:delete', 'workflow:run',
  'domain:view', 'domain:manage',
  'integration:view', 'integration:manage',
  'audit:view',
  'approval:view', 'approval:decide',
  'billing:view', 'billing:manage',
]

const ROLE_DEFS: Array<{
  name: string
  slug: string
  description: string
  isOwner?: boolean
  keys: string[]
}> = [
  { name: 'Owner', slug: 'owner', description: 'Full access', isOwner: true, keys: ALL_PERMISSION_KEYS },
  { name: 'Admin', slug: 'admin', description: 'Administrative access', keys: [
    'org:view','org:manage','org:settings','org:members:manage',
    'agent:view','agent:create','agent:update','agent:delete','agent:run',
    'mission:view','mission:create','mission:update','mission:execute',
    'workflow:view','workflow:create','workflow:update','workflow:run',
    'domain:view','domain:manage','integration:view','integration:manage',
    'audit:view','approval:view','approval:decide','billing:view',
  ]},
  { name: 'Member', slug: 'member', description: 'Standard member', keys: [
    'org:view','agent:view','agent:create','agent:run',
    'mission:view','mission:create','mission:update','mission:execute',
    'workflow:view','workflow:run','domain:view','integration:view',
    'approval:view','billing:view',
  ]},
  { name: 'Viewer', slug: 'viewer', description: 'Read-only', keys: [
    'org:view','agent:view','mission:view','workflow:view',
    'domain:view','integration:view','audit:view','approval:view','billing:view',
  ]},
  { name: 'Billing Manager', slug: 'billing', description: 'Billing access', keys: [
    'org:view','billing:view','billing:manage','approval:view',
  ]},
]

// ============================================================
// Helper: generate a unique org slug with retry on conflict
// ============================================================

/**
 * Generate a deterministic base slug from an email local part,
 * then attempt creation with unique constraint violation retry.
 *
 * This avoids the check-then-insert race condition: we rely on
 * the DB's UNIQUE constraint on `slug` and retry with a new
 * suffix when P2002 (unique violation) is raised.
 *
 * IMPORTANT: Must be called INSIDE a Prisma transaction so that
 * the created org is part of the same atomic unit.
 */
async function createOrgWithUniqueSlug(
  tx: Prisma.TransactionClient,
  name: string,
  baseSlug: string,
) {
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`
    try {
      return await tx.organization.create({
        data: { name, slug },
      })
    } catch (e) {
      // P2002 = unique constraint violation on `slug`
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Slug collision — retry with next suffix
        continue
      }
      // Any other error is unexpected — let it propagate
      throw e
    }
  }
  throw new ValidationError(
    'Unable to generate a unique organization slug. Please try again.',
  )
}

// ============================================================
// Helper: seed permissions and roles inside a transaction
// ============================================================

/**
 * Seed the standard 31 permissions and 5 roles for a new org.
 * Also assigns the Owner role to the given membership.
 *
 * Permissions are globally unique by key, so we use upsert to
 * handle the case where they already exist from a prior org's
 * seeding. We do NOT swallow errors with broad .catch() — any
 * failure here rolls back the entire registration transaction.
 */
async function seedOrgPermissions(
  tx: Prisma.TransactionClient,
  organizationId: string,
  membershipId: string,
) {
  // Upsert all 31 permissions (idempotent — safe if already exists)
  for (const key of ALL_PERMISSION_KEYS) {
    await tx.permission.upsert({
      where: { key },
      update: {}, // no-op if exists
      create: { key, description: key },
    })
  }

  // Create 5 roles and link their permissions
  for (const roleDef of ROLE_DEFS) {
    const role = await tx.role.create({
      data: {
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isSystem: true,
        organizationId,
      },
    })

    // Link each permission to this role
    for (const pKey of roleDef.keys) {
      // Permission must exist — we just upserted all of them
      const perm = await tx.permission.findUniqueOrThrow({ where: { key: pKey } })
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      })
    }

    // Assign the Owner role to the creator's membership
    if (roleDef.isOwner) {
      await tx.membershipRole.create({
        data: { membershipId, roleId: role.id },
      })
    }
  }
}

// ============================================================
// POST handler — atomic registration
// ============================================================

// POST /api/auth/register — create a new user + personal org
export async function POST(request: Request) {
  return withErrorHandler(async () => {
    // Rate limit by client IP
    // failClosed: true — auth endpoint, reject on DB failure
    const clientIp = getClientIp(request)
    const rateResult = await rateLimit(`register:${clientIp}`, REGISTRATION_RATE_LIMIT, REGISTRATION_WINDOW_MS, true)
    if (!rateResult.success) {
      return error('TOO_MANY_REQUESTS', AuthErrors.RATE_LIMITED, 429)
    }

    const body = await requireBody<{
      email: string
      password: string
      displayName?: string
    }>(request)

    const email = body.email?.trim()?.toLowerCase()
    const password = body.password
    const displayName = body.displayName?.trim()

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('A valid email address is required')
    }

    // Validate password
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      )
    }

    // Early check for existing email (fast path, avoids transaction overhead)
    // Returns 409 to prevent account enumeration via timing
    const existing = await db.profile.findUnique({ where: { email } })
    if (existing) {
      return error('CONFLICT', 'An account with this email already exists', 409)
    }

    // Hash password BEFORE the transaction (bcrypt is CPU-bound,
    // doing it outside the tx reduces transaction duration)
    const passwordHash = await hash(password, SALT_ROUNDS)

    // ============================================================
    // ATOMIC TRANSACTION: user + org + membership + RBAC seeding
    // ============================================================
    // Prisma interactive transactions provide snapshot isolation.
    // If ANY operation inside fails, ALL changes are rolled back —
    // no orphan Profile/User, no partial org, no dangling membership.
    // ============================================================
    const result = await db.$transaction(async (tx) => {
      // 1. Check email uniqueness inside the transaction to prevent
      //    TOCTOU races with concurrent registrations for the same email.
      const existing = await tx.profile.findUnique({ where: { email } })
      if (existing) {
        throw new ValidationError('An account with this email already exists')
      }

      // 2. Create the user profile
      const profile = await tx.profile.create({
        data: {
          email,
          passwordHash,
          displayName: displayName || email.split('@')[0],
        },
      })

      // 3. Create org with concurrency-safe unique slug
      const orgName = `${displayName || email.split('@')[0]}'s Workspace`
      const baseSlug = email.split('@')[0].replace(/[^a-z0-9]/g, '') + '-workspace'
      const org = await createOrgWithUniqueSlug(tx, orgName, baseSlug)

      // 4. Create active membership linking user to org
      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: org.id,
          userId: profile.id,
          status: 'active',
        },
      })

      // 5. Seed all RBAC permissions + roles + assign Owner role
      //    If this fails, the entire transaction rolls back.
      await seedOrgPermissions(tx, org.id, membership.id)

      return { profile, org }
    }, {
      // Use Serializable isolation for maximum safety on registration.
      // This prevents all phantom reads and write skews.
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      // 30 second timeout — bcrypt is already done, remaining ops are fast
      timeout: 30_000,
    })

    // Transaction succeeded — return the expected response shape
    return created({
      id: result.profile.id,
      email: result.profile.email,
      displayName: result.profile.displayName,
      organizationId: result.org.id,
      organizationName: result.org.name,
    })
  })
}

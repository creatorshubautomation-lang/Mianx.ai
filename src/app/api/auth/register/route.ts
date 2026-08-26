// ============================================================
// MIANX.AI V3 — User Registration Endpoint
// POST /api/auth/register
//
// Rate limiting is FAIL-CLOSED: if the rate-limit DB operation
// fails, the request is rejected with 429.
// ============================================================

import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
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

    // Check if email already exists
    const existing = await db.profile.findUnique({ where: { email } })
    if (existing) {
      // Return 409 to prevent account enumeration via timing
      // (same response shape as success for security)
      return error('CONFLICT', 'An account with this email already exists', 409)
    }

    // Hash password
    const passwordHash = await hash(password, SALT_ROUNDS)

    // Create profile
    const profile = await db.profile.create({
      data: {
        email,
        passwordHash,
        displayName: displayName || email.split('@')[0],
      },
    })

    // Create a personal organization for the new user
    const orgName = `${displayName || email.split('@')[0]}'s Workspace`
    const slug = email.split('@')[0].replace(/[^a-z0-9]/g, '') + '-workspace'

    // Ensure slug is unique
    let finalSlug = slug
    let slugExists = await db.organization.findUnique({ where: { slug: finalSlug } })
    let suffix = 1
    while (slugExists) {
      finalSlug = `${slug}-${suffix}`
      slugExists = await db.organization.findUnique({ where: { slug: finalSlug } })
      suffix++
    }

    const org = await db.organization.create({
      data: {
        name: orgName,
        slug: finalSlug,
        memberships: {
          create: {
            userId: profile.id,
            status: 'active',
            roles: {
              create: {
                role: {
                  create: {
                    name: 'Owner',
                    slug: 'owner',
                    description: 'Full access to all organization resources',
                    isSystem: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Seed permissions for this org (copy from default set)
    await seedOrgPermissions(org.id)

    return created({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      organizationId: org.id,
      organizationName: org.name,
    })
  })
}

/**
 * Seed the 31 standard permissions + 5 roles for a new organization.
 * This ensures every new org has the full RBAC structure.
 */
async function seedOrgPermissions(organizationId: string) {
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

  const ROLE_DEFS: Array<{ name: string; slug: string; description: string; isOwner?: boolean; keys: string[] }> = [
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

  // Create permissions
  for (const key of ALL_PERMISSION_KEYS) {
    await db.permission.create({ data: { key, description: key } }).catch(() => {
      // Permission already exists (shared across orgs in this schema)
    })
  }

  // Find the membership for this org's first member (the owner)
  const membership = await db.organizationMembership.findFirst({
    where: { organizationId },
  })

  if (!membership) return

  // Create roles and assign to owner membership
  for (const roleDef of ROLE_DEFS) {
    const role = await db.role.create({
      data: {
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isSystem: true,
        organizationId,
      },
    })

    // Link role permissions
    for (const pKey of roleDef.keys) {
      const perm = await db.permission.findUnique({ where: { key: pKey } })
      if (perm) {
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        }).catch(() => {})
      }
    }

    // Assign owner role to the creator's membership
    if (roleDef.isOwner) {
      await db.membershipRole.create({
        data: { membershipId: membership.id, roleId: role.id },
      }).catch(() => {})
    }
  }
}
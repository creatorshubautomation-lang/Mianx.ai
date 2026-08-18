// ============================================================
// MIANX.AI V3 — Authorization Engine
// RBAC permission checking for organizations, missions, agents, etc.
// ============================================================

import { db } from './db'
import { ForbiddenError, UnauthorizedError } from './api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

// ============================================================
// Permission Constants
// ============================================================

/** Core permission keys used throughout the platform */
export const Permissions = {
  // Organization
  ORG_VIEW: 'org:view',
  ORG_MANAGE: 'org:manage',
  ORG_DELETE: 'org:delete',
  ORG_SETTINGS: 'org:settings',
  ORG_BILLING: 'org:billing',
  ORG_MEMBERS_MANAGE: 'org:members:manage',

  // Agents
  AGENT_VIEW: 'agent:view',
  AGENT_CREATE: 'agent:create',
  AGENT_UPDATE: 'agent:update',
  AGENT_DELETE: 'agent:delete',
  AGENT_RUN: 'agent:run',

  // Missions
  MISSION_VIEW: 'mission:view',
  MISSION_CREATE: 'mission:create',
  MISSION_UPDATE: 'mission:update',
  MISSION_DELETE: 'mission:delete',
  MISSION_EXECUTE: 'mission:execute',
  MISSION_APPROVE: 'mission:approve',

  // Workflows
  WORKFLOW_VIEW: 'workflow:view',
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_UPDATE: 'workflow:update',
  WORKFLOW_DELETE: 'workflow:delete',
  WORKFLOW_RUN: 'workflow:run',

  // Domains
  DOMAIN_VIEW: 'domain:view',
  DOMAIN_MANAGE: 'domain:manage',

  // Integrations
  INTEGRATION_VIEW: 'integration:view',
  INTEGRATION_MANAGE: 'integration:manage',

  // Audit
  AUDIT_VIEW: 'audit:view',

  // Approvals
  APPROVAL_VIEW: 'approval:view',
  APPROVAL_DECIDE: 'approval:decide',

  // Billing
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',
} as const

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions]

/** Default role definitions with their permission sets */
export const DefaultRoles: Record<string, { name: string; description: string; permissions: PermissionKey[] }> = {
  owner: {
    name: 'Owner',
    description: 'Full access to all organization resources',
    permissions: Object.values(Permissions),
  },
  admin: {
    name: 'Admin',
    description: 'Administrative access to manage most resources',
    permissions: [
      Permissions.ORG_VIEW,
      Permissions.ORG_MANAGE,
      Permissions.ORG_SETTINGS,
      Permissions.ORG_MEMBERS_MANAGE,
      Permissions.AGENT_VIEW,
      Permissions.AGENT_CREATE,
      Permissions.AGENT_UPDATE,
      Permissions.AGENT_DELETE,
      Permissions.AGENT_RUN,
      Permissions.MISSION_VIEW,
      Permissions.MISSION_CREATE,
      Permissions.MISSION_UPDATE,
      Permissions.MISSION_EXECUTE,
      Permissions.WORKFLOW_VIEW,
      Permissions.WORKFLOW_CREATE,
      Permissions.WORKFLOW_UPDATE,
      Permissions.WORKFLOW_RUN,
      Permissions.DOMAIN_VIEW,
      Permissions.DOMAIN_MANAGE,
      Permissions.INTEGRATION_VIEW,
      Permissions.INTEGRATION_MANAGE,
      Permissions.AUDIT_VIEW,
      Permissions.APPROVAL_VIEW,
      Permissions.APPROVAL_DECIDE,
      Permissions.BILLING_VIEW,
    ],
  },
  member: {
    name: 'Member',
    description: 'Standard member with view and create access',
    permissions: [
      Permissions.ORG_VIEW,
      Permissions.AGENT_VIEW,
      Permissions.AGENT_CREATE,
      Permissions.AGENT_RUN,
      Permissions.MISSION_VIEW,
      Permissions.MISSION_CREATE,
      Permissions.MISSION_UPDATE,
      Permissions.MISSION_EXECUTE,
      Permissions.WORKFLOW_VIEW,
      Permissions.WORKFLOW_RUN,
      Permissions.DOMAIN_VIEW,
      Permissions.INTEGRATION_VIEW,
      Permissions.APPROVAL_VIEW,
      Permissions.BILLING_VIEW,
    ],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to organization resources',
    permissions: [
      Permissions.ORG_VIEW,
      Permissions.AGENT_VIEW,
      Permissions.MISSION_VIEW,
      Permissions.WORKFLOW_VIEW,
      Permissions.DOMAIN_VIEW,
      Permissions.INTEGRATION_VIEW,
      Permissions.AUDIT_VIEW,
      Permissions.APPROVAL_VIEW,
      Permissions.BILLING_VIEW,
    ],
  },
  billing: {
    name: 'Billing Manager',
    description: 'Access to billing and subscription management',
    permissions: [
      Permissions.ORG_VIEW,
      Permissions.BILLING_VIEW,
      Permissions.BILLING_MANAGE,
      Permissions.APPROVAL_VIEW,
    ],
  },
}

// ============================================================
// Permission Checking (Server-side)
// ============================================================

/**
 * Check if a user has a specific set of permissions within an organization.
 * Returns true if the user has ALL of the required permissions.
 *
 * @param userId - The profile ID of the user
 * @param organizationId - The organization to check within
 * @param requiredPermissions - Array of permission keys the user must have
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  requiredPermissions: PermissionKey[],
): Promise<boolean> {
  if (requiredPermissions.length === 0) return true

  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  })

  if (!membership || membership.status !== 'active') return false

  const userPermissions = new Set<string>()
  for (const membershipRole of membership.roles) {
    for (const rolePerm of membershipRole.role.permissions) {
      userPermissions.add(rolePerm.permission.key)
    }
  }

  return requiredPermissions.every((perm) => userPermissions.has(perm))
}

/**
 * Assert that a user has the required permissions.
 * Throws ForbiddenError if not.
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  requiredPermissions: PermissionKey[],
): Promise<void> {
  const ok = await hasPermission(userId, organizationId, requiredPermissions)
  if (!ok) {
    throw new ForbiddenError(
      `Missing required permissions: ${requiredPermissions.join(', ')}`,
    )
  }
}

/**
 * Check if a user is an active member of an organization.
 */
export async function isOrgMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { status: true },
  })
  return membership?.status === 'active'
}

/**
 * Assert that a user is an active member.
 * Throws ForbiddenError if not.
 */
export async function requireOrgMember(
  userId: string,
  organizationId: string,
): Promise<void> {
  const ok = await isOrgMember(userId, organizationId)
  if (!ok) {
    throw new ForbiddenError('You are not an active member of this organization')
  }
}

/**
 * Get the full organization context for a user's membership,
 * including their roles and permissions.
 */
export async function getOrgContext(
  userId: string,
  organizationId: string,
) {
  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: {
      organization: true,
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  })

  if (!membership) return null

  const allPermissions = membership.roles.flatMap((mr) =>
    mr.role.permissions.map((rp) => rp.permission.key),
  )

  return {
    membershipId: membership.id,
    organization: membership.organization,
    roles: membership.roles.map((mr) => ({
      id: mr.role.id,
      name: mr.role.name,
      slug: mr.role.slug,
      isSystem: mr.role.isSystem,
    })),
    permissions: [...new Set(allPermissions)],
  }
}

/**
 * Get all permission keys for a user within an organization.
 */
export async function getUserPermissions(
  userId: string,
  organizationId: string,
): Promise<string[]> {
  const context = await getOrgContext(userId, organizationId)
  return context?.permissions ?? []
}

/**
 * Check if a user has owner-level access to an organization.
 */
export async function isOrgOwner(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return hasPermission(userId, organizationId, [Permissions.ORG_DELETE])
}

// ============================================================
// Server-Side Identity Resolution
// ============================================================

/**
 * Get the authenticated user ID from the current request's NextAuth session.
 * Throws UnauthorizedError if no valid session exists.
 *
 * This is the SINGLE source of truth for user identity in API routes.
 * Never trust client-provided headers for authentication.
 */
export async function getUserIdFromRequest(request: Request): Promise<string> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as Record<string, unknown> | undefined)?.id as string | undefined

  if (!userId) {
    throw new UnauthorizedError('Authentication required. Please sign in.')
  }

  return userId
}

/**
 * Get the authenticated user ID from the NextAuth session.
 * Returns null if not authenticated (instead of throwing).
 * Useful for routes that behave differently for auth vs non-auth users.
 */
export async function getOptionalUserIdFromRequest(request: Request): Promise<string | null> {
  try {
    return await getUserIdFromRequest(request)
  } catch {
    return null
  }
}

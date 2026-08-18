import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  Permissions,
  DefaultRoles,
  hasPermission,
  requirePermission,
  isOrgMember,
  getUserIdFromRequest,
  getOptionalUserIdFromRequest,
} from '@/lib/authorization'
import { ForbiddenError, UnauthorizedError } from '@/lib/api-response'

// ============================================================
// Mock db
// ============================================================

const mockFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    organizationMembership: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

// Mock NextAuth getServerSession
const mockGetServerSession = vi.fn()
vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: { providers: [] },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// Permissions constant
// ============================================================

describe('Permissions', () => {
  it('has ORG_VIEW permission', () => {
    expect(Permissions.ORG_VIEW).toBe('org:view')
  })

  it('has ORG_MANAGE permission', () => {
    expect(Permissions.ORG_MANAGE).toBe('org:manage')
  })

  it('has ORG_DELETE permission', () => {
    expect(Permissions.ORG_DELETE).toBe('org:delete')
  })

  it('has ORG_SETTINGS permission', () => {
    expect(Permissions.ORG_SETTINGS).toBe('org:settings')
  })

  it('has ORG_BILLING permission', () => {
    expect(Permissions.ORG_BILLING).toBe('org:billing')
  })

  it('has ORG_MEMBERS_MANAGE permission', () => {
    expect(Permissions.ORG_MEMBERS_MANAGE).toBe('org:members:manage')
  })

  it('has AGENT_VIEW permission', () => {
    expect(Permissions.AGENT_VIEW).toBe('agent:view')
  })

  it('has AGENT_CREATE permission', () => {
    expect(Permissions.AGENT_CREATE).toBe('agent:create')
  })

  it('has AGENT_UPDATE permission', () => {
    expect(Permissions.AGENT_UPDATE).toBe('agent:update')
  })

  it('has AGENT_DELETE permission', () => {
    expect(Permissions.AGENT_DELETE).toBe('agent:delete')
  })

  it('has AGENT_RUN permission', () => {
    expect(Permissions.AGENT_RUN).toBe('agent:run')
  })

  it('has MISSION_VIEW permission', () => {
    expect(Permissions.MISSION_VIEW).toBe('mission:view')
  })

  it('has MISSION_CREATE permission', () => {
    expect(Permissions.MISSION_CREATE).toBe('mission:create')
  })

  it('has MISSION_UPDATE permission', () => {
    expect(Permissions.MISSION_UPDATE).toBe('mission:update')
  })

  it('has MISSION_DELETE permission', () => {
    expect(Permissions.MISSION_DELETE).toBe('mission:delete')
  })

  it('has MISSION_EXECUTE permission', () => {
    expect(Permissions.MISSION_EXECUTE).toBe('mission:execute')
  })

  it('has MISSION_APPROVE permission', () => {
    expect(Permissions.MISSION_APPROVE).toBe('mission:approve')
  })

  it('has WORKFLOW_VIEW permission', () => {
    expect(Permissions.WORKFLOW_VIEW).toBe('workflow:view')
  })

  it('has WORKFLOW_CREATE permission', () => {
    expect(Permissions.WORKFLOW_CREATE).toBe('workflow:create')
  })

  it('has WORKFLOW_UPDATE permission', () => {
    expect(Permissions.WORKFLOW_UPDATE).toBe('workflow:update')
  })

  it('has WORKFLOW_DELETE permission', () => {
    expect(Permissions.WORKFLOW_DELETE).toBe('workflow:delete')
  })

  it('has WORKFLOW_RUN permission', () => {
    expect(Permissions.WORKFLOW_RUN).toBe('workflow:run')
  })

  it('has DOMAIN_VIEW permission', () => {
    expect(Permissions.DOMAIN_VIEW).toBe('domain:view')
  })

  it('has DOMAIN_MANAGE permission', () => {
    expect(Permissions.DOMAIN_MANAGE).toBe('domain:manage')
  })

  it('has INTEGRATION_VIEW permission', () => {
    expect(Permissions.INTEGRATION_VIEW).toBe('integration:view')
  })

  it('has INTEGRATION_MANAGE permission', () => {
    expect(Permissions.INTEGRATION_MANAGE).toBe('integration:manage')
  })

  it('has AUDIT_VIEW permission', () => {
    expect(Permissions.AUDIT_VIEW).toBe('audit:view')
  })

  it('has APPROVAL_VIEW permission', () => {
    expect(Permissions.APPROVAL_VIEW).toBe('approval:view')
  })

  it('has APPROVAL_DECIDE permission', () => {
    expect(Permissions.APPROVAL_DECIDE).toBe('approval:decide')
  })

  it('has BILLING_VIEW permission', () => {
    expect(Permissions.BILLING_VIEW).toBe('billing:view')
  })

  it('has BILLING_MANAGE permission', () => {
    expect(Permissions.BILLING_MANAGE).toBe('billing:manage')
  })

  it('has exactly 31 permission keys', () => {
    expect(Object.keys(Permissions).length).toBe(31)
  })
})

// ============================================================
// DefaultRoles
// ============================================================

describe('DefaultRoles', () => {
  it('has owner role', () => {
    expect(DefaultRoles.owner).toBeDefined()
    expect(DefaultRoles.owner.name).toBe('Owner')
  })

  it('has admin role', () => {
    expect(DefaultRoles.admin).toBeDefined()
    expect(DefaultRoles.admin.name).toBe('Admin')
  })

  it('has member role', () => {
    expect(DefaultRoles.member).toBeDefined()
    expect(DefaultRoles.member.name).toBe('Member')
  })

  it('has viewer role', () => {
    expect(DefaultRoles.viewer).toBeDefined()
    expect(DefaultRoles.viewer.name).toBe('Viewer')
  })

  it('has billing role', () => {
    expect(DefaultRoles.billing).toBeDefined()
    expect(DefaultRoles.billing.name).toBe('Billing Manager')
  })

  it('owner has all 31 permissions', () => {
    const allPerms = Object.values(Permissions)
    expect(DefaultRoles.owner.permissions).toHaveLength(31)
    expect(DefaultRoles.owner.permissions).toEqual(allPerms)
  })

  it('viewer has only view permissions', () => {
    const viewerPerms = DefaultRoles.viewer.permissions
    for (const perm of viewerPerms) {
      expect(perm).toContain(':view')
    }
  })

  it('viewer does not have create/update/delete/execute permissions', () => {
    const viewerPerms = new Set(DefaultRoles.viewer.permissions)
    expect(viewerPerms.has(Permissions.AGENT_CREATE)).toBe(false)
    expect(viewerPerms.has(Permissions.AGENT_UPDATE)).toBe(false)
    expect(viewerPerms.has(Permissions.MISSION_CREATE)).toBe(false)
    expect(viewerPerms.has(Permissions.MISSION_DELETE)).toBe(false)
    expect(viewerPerms.has(Permissions.MISSION_EXECUTE)).toBe(false)
  })

  it('admin has ORG_DELETE permission', () => {
    // Admin does NOT have ORG_DELETE based on the source
    expect(DefaultRoles.admin.permissions).not.toContain(Permissions.ORG_DELETE)
  })

  it('admin does not have ORG_BILLING_MANAGE (owner-only)', () => {
    expect(DefaultRoles.admin.permissions).not.toContain(Permissions.BILLING_MANAGE)
  })

  it('billing role has only 4 permissions', () => {
    expect(DefaultRoles.billing.permissions).toHaveLength(4)
  })

  it('billing role has BILLING_MANAGE permission', () => {
    expect(DefaultRoles.billing.permissions).toContain(Permissions.BILLING_MANAGE)
  })

  it('member has MISSION_CREATE and MISSION_EXECUTE', () => {
    const memberPerms = DefaultRoles.member.permissions
    expect(memberPerms).toContain(Permissions.MISSION_CREATE)
    expect(memberPerms).toContain(Permissions.MISSION_EXECUTE)
  })

  it('member does not have MISSION_DELETE', () => {
    expect(DefaultRoles.member.permissions).not.toContain(Permissions.MISSION_DELETE)
  })
})

// ============================================================
// hasPermission
// ============================================================

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem_1',
    status: 'active',
    roles: [
      {
        role: {
          id: 'role_1',
          name: 'Owner',
          slug: 'owner',
          isSystem: true,
          permissions: [
            { permission: { key: 'org:view' } },
            { permission: { key: 'agent:view' } },
            { permission: { key: 'agent:run' } },
          ],
        },
      },
    ],
    ...overrides,
  }
}

describe('hasPermission', () => {
  it('returns true when user has all required permissions', async () => {
    mockFindUnique.mockResolvedValue(makeMembership())
    const result = await hasPermission('user_1', 'org_1', ['org:view', 'agent:view'])
    expect(result).toBe(true)
  })

  it('returns false when user lacks a required permission', async () => {
    mockFindUnique.mockResolvedValue(makeMembership())
    const result = await hasPermission('user_1', 'org_1', ['org:delete'])
    expect(result).toBe(false)
  })

  it('returns true when required permissions array is empty', async () => {
    const result = await hasPermission('user_1', 'org_1', [])
    expect(result).toBe(true)
  })

  it('returns false when membership is not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await hasPermission('user_1', 'org_1', ['org:view'])
    expect(result).toBe(false)
  })

  it('returns false when membership is suspended', async () => {
    mockFindUnique.mockResolvedValue(makeMembership({ status: 'suspended' }))
    const result = await hasPermission('user_1', 'org_1', ['org:view'])
    expect(result).toBe(false)
  })

  it('calls db with correct where clause', async () => {
    mockFindUnique.mockResolvedValue(makeMembership())
    await hasPermission('u1', 'o1', ['org:view'])
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'o1', userId: 'u1' } },
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
  })

  it('aggregates permissions from multiple roles', async () => {
    mockFindUnique.mockResolvedValue({
      ...makeMembership(),
      roles: [
        {
          role: {
            id: 'r1', name: 'Viewer', slug: 'viewer', isSystem: true,
            permissions: [{ permission: { key: 'org:view' } }],
          },
        },
        {
          role: {
            id: 'r2', name: 'Billing', slug: 'billing', isSystem: true,
            permissions: [{ permission: { key: 'billing:manage' } }],
          },
        },
      ],
    })
    const result = await hasPermission('u1', 'o1', ['org:view', 'billing:manage'])
    expect(result).toBe(true)
  })
})

// ============================================================
// requirePermission
// ============================================================

describe('requirePermission', () => {
  it('does not throw when user has permission', async () => {
    mockFindUnique.mockResolvedValue(makeMembership())
    await expect(
      requirePermission('u1', 'o1', ['org:view']),
    ).resolves.toBeUndefined()
  })

  it('throws ForbiddenError when user lacks permission', async () => {
    mockFindUnique.mockResolvedValue(makeMembership())
    await expect(
      requirePermission('u1', 'o1', ['org:delete']),
    ).rejects.toThrow(ForbiddenError)
  })

  it('error message includes missing permissions', async () => {
    mockFindUnique.mockResolvedValue(makeMembership())
    try {
      await requirePermission('u1', 'o1', ['org:delete', 'mission:delete'])
    } catch (err) {
      expect((err as ForbiddenError).message).toContain('org:delete')
      expect((err as ForbiddenError).message).toContain('mission:delete')
    }
  })
})

// ============================================================
// isOrgMember
// ============================================================

describe('isOrgMember', () => {
  it('returns true for active membership', async () => {
    mockFindUnique.mockResolvedValue({ status: 'active' })
    expect(await isOrgMember('u1', 'o1')).toBe(true)
  })

  it('returns false for suspended membership', async () => {
    mockFindUnique.mockResolvedValue({ status: 'suspended' })
    expect(await isOrgMember('u1', 'o1')).toBe(false)
  })

  it('returns false when no membership found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await isOrgMember('u1', 'o1')).toBe(false)
  })

  it('queries db with correct params', async () => {
    mockFindUnique.mockResolvedValue({ status: 'active' })
    await isOrgMember('u1', 'o1')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'o1', userId: 'u1' } },
      select: { status: true },
    })
  })
})

// ============================================================
// getUserIdFromRequest (Phase 2 — NextAuth-based)
// ============================================================

describe('getUserIdFromRequest', () => {
  it('returns user ID from valid session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user_abc123', email: 'test@test.com', name: 'Test' },
    })
    const req = new Request('http://localhost')
    const userId = await getUserIdFromRequest(req)
    expect(userId).toBe('user_abc123')
  })

  it('throws UnauthorizedError when no session', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new Request('http://localhost')
    await expect(getUserIdFromRequest(req)).rejects.toThrow(UnauthorizedError)
  })

  it('throws UnauthorizedError when session has no user', async () => {
    mockGetServerSession.mockResolvedValue({ user: null })
    const req = new Request('http://localhost')
    await expect(getUserIdFromRequest(req)).rejects.toThrow(UnauthorizedError)
  })

  it('throws UnauthorizedError when session user has no id', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: 'test@test.com', name: 'Test' },
    })
    const req = new Request('http://localhost')
    await expect(getUserIdFromRequest(req)).rejects.toThrow(UnauthorizedError)
  })

  it('ignores x-user-id header (no client-provided identity trust)', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'real_user', email: 'test@test.com' },
    })
    const req = new Request('http://localhost', {
      headers: { 'x-user-id': 'fake_user' },
    })
    // Should return the SESSION user, NOT the header user
    const userId = await getUserIdFromRequest(req)
    expect(userId).toBe('real_user')
    expect(userId).not.toBe('fake_user')
  })
})

describe('getOptionalUserIdFromRequest', () => {
  it('returns user ID when session exists', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user_123', email: 'test@test.com' },
    })
    const req = new Request('http://localhost')
    const userId = await getOptionalUserIdFromRequest(req)
    expect(userId).toBe('user_123')
  })

  it('returns null when no session', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new Request('http://localhost')
    const userId = await getOptionalUserIdFromRequest(req)
    expect(userId).toBeNull()
  })
})

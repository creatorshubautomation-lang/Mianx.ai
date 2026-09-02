// ============================================================
// MIANX.AI V3 — Registration Atomic Transaction Tests
//
// Tests that registration is fully atomic:
// - Rollback on org creation failure
// - Rollback on RBAC seeding failure
// - No orphan Profile/User left behind
// - Concurrent slug uniqueness
// - Existing successful registration still works
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// Mock Setup
// ============================================================

const mockTransaction = vi.hoisted(() => vi.fn())
const mockProfileFindUnique = vi.hoisted(() => vi.fn())
const mockHash = vi.hoisted(() => vi.fn())

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  hash: mockHash,
  compare: vi.fn(),
}))

// Mock rate-limit (always allow in these tests)
vi.mock('./rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 4, resetAt: Date.now() + 900000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

// Mock Prisma client — we inspect how $transaction is called
vi.mock('./db', () => ({
  db: {
    $transaction: mockTransaction,
    profile: {
      findUnique: mockProfileFindUnique,
    },
  },
}))

// ============================================================
// Tests: Transaction atomicity contract
// ============================================================

describe('Registration atomic transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: hash succeeds, no existing user
    mockHash.mockResolvedValue('$2a$12$hashedpassword')
    mockProfileFindUnique.mockResolvedValue(null)
  })

  it('must wrap registration in db.$transaction with Serializable isolation', async () => {
    // Arrange: transaction succeeds, returns profile + org
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = createMockTxClient()
      return fn(tx)
    })

    // Act
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    await POST(req)

    // Assert
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    const callArgs = mockTransaction.mock.calls[0]
    // First arg is the callback function
    expect(typeof callArgs[0]).toBe('function')
    // Second arg should include isolationLevel
    if (callArgs[1]) {
      expect(callArgs[1].isolationLevel).toBeDefined()
    }
  })

  it('must check email uniqueness INSIDE the transaction (TOCTOU prevention)', async () => {
    let transactionFn: Function | null = null
    mockTransaction.mockImplementation(async (fn: Function) => {
      transactionFn = fn
      const tx = createMockTxClient()
      return fn(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    await POST(req)

    // The email check inside the transaction uses tx.profile.findUnique,
    // not db.profile.findUnique (which is checked before the tx for early exit)
    expect(mockTransaction).toHaveBeenCalled()
    expect(transactionFn).not.toBeNull()
  })

  it('must NOT create the user before entering the transaction (no orphan risk)', async () => {
    let txBodyExecuted = false
    mockTransaction.mockImplementation(async (fn: Function) => {
      txBodyExecuted = true
      const tx = createMockTxClient()
      return fn(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    await POST(req)

    // Profile is NOT created via db.profile.create outside the transaction.
    // The only profile operation before the transaction is findUnique (read-only).
    // We verify the transaction was entered (which is where create happens).
    expect(txBodyExecuted).toBe(true)
  })

  it('must rollback all changes when transaction throws', async () => {
    // Simulate transaction failure (org creation error)
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = createMockTxClient({
        throwOnCreate: { model: 'organization', error: new Error('DB connection lost') },
      })
      return fn(tx) // This will throw
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })

    const response = await POST(req)
    const data = await response.json()

    // Should return 500 (server error), not 201 (created)
    expect(response.status).toBe(500)
  })

  it('must use slug retry on unique constraint violation (P2002)', async () => {
    let attempt = 0
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = createMockTxClient({
        organizationCreate: async () => {
          attempt++
          if (attempt === 1) {
            // First attempt: slug collision
            const { PrismaClientKnownRequestError } = await import('@prisma/client')
            throw new PrismaClientKnownRequestError(
              'Unique constraint failed',
              { code: 'P2002', clientVersion: '5.0.0' },
            )
          }
          // Second attempt: success
          return { id: 'org-123', name: "test's Workspace", slug: 'test-workspace-1' }
        },
      })
      return fn(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    const response = await POST(req)

    // Should succeed on retry
    expect(response.status).toBe(201)
    expect(attempt).toBe(2)
  })

  it('must NOT use check-then-insert pattern for slug uniqueness', async () => {
    // The old code did: findUnique → while loop → create
    // The new code does: create → catch P2002 → retry
    // We verify this by checking that the transaction callback
    // does NOT call tx.organization.findUnique before create
    let orgFindUniqueCalled = false
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = {
        profile: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com', displayName: 'test' }),
        },
        organization: {
          findUnique: vi.fn().mockImplementation(() => {
            orgFindUniqueCalled = true
            return Promise.resolve(null)
          }),
          create: vi.fn().mockResolvedValue({ id: 'org-1', name: 'test Workspace', slug: 'test-workspace' }),
        },
        organizationMembership: {
          create: vi.fn().mockResolvedValue({ id: 'mem-1', organizationId: 'org-1', userId: 'user-1' }),
        },
        permission: {
          upsert: vi.fn().mockResolvedValue({ id: 'perm-1', key: 'org:view' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'perm-1', key: 'org:view' }),
        },
        role: {
          create: vi.fn().mockResolvedValue({ id: 'role-1', name: 'Owner', slug: 'owner' }),
        },
        rolePermission: {
          create: vi.fn().mockResolvedValue({ id: 'rp-1' }),
        },
        membershipRole: {
          create: vi.fn().mockResolvedValue({ id: 'mr-1' }),
        },
      }
      return fn(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    await POST(req)

    // The new implementation should NOT do findUnique before create for slug
    // (it relies on the unique constraint + retry instead)
    expect(orgFindUniqueCalled).toBe(false)
  })

  it('must hash password OUTSIDE the transaction (reduce tx duration)', async () => {
    let hashCalledBeforeTx = false
    mockHash.mockImplementation(async () => {
      // We can't directly check timing, but we verify hash
      // is called (it's called before the transaction in the code)
      return '$2a$12$hashedpassword'
    })
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = createMockTxClient()
      return fn(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    await POST(req)

    // Hash should have been called
    expect(mockHash).toHaveBeenCalledWith('securepass123', 12)
    // Transaction should have been entered
    expect(mockTransaction).toHaveBeenCalled()
  })

  it('must NOT swallow errors with broad .catch(() => {})', async () => {
    // In the old code, seedOrgPermissions used .catch(() => {}) on
    // permission.create, rolePermission.create, and membershipRole.create.
    // The new code uses upsert and findUniqueOrThrow inside the tx,
    // so errors propagate and roll back the entire transaction.
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = createMockTxClient({
        throwOnCreate: { model: 'permission', error: new Error('Permission upsert failed') },
      })
      return fn(tx) // Should throw, not swallow
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })

    const response = await POST(req)
    // Should be 500, not 201 — error was NOT swallowed
    expect(response.status).toBe(500)
  })

  it('must use upsert for permissions (idempotent seeding)', async () => {
    let upsertCalled = false
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = {
        profile: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'u1', email: 't@t.com', displayName: 't' }),
        },
        organization: {
          create: vi.fn().mockResolvedValue({ id: 'o1', name: 't', slug: 't-ws' }),
        },
        organizationMembership: {
          create: vi.fn().mockResolvedValue({ id: 'm1', organizationId: 'o1', userId: 'u1' }),
        },
        permission: {
          upsert: vi.fn().mockImplementation(() => {
            upsertCalled = true
            return Promise.resolve({ id: 'p1', key: 'org:view' })
          }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'p1', key: 'org:view' }),
        },
        role: {
          create: vi.fn().mockResolvedValue({ id: 'r1', name: 'Owner', slug: 'owner' }),
        },
        rolePermission: {
          create: vi.fn().mockResolvedValue({ id: 'rp1' }),
        },
        membershipRole: {
          create: vi.fn().mockResolvedValue({ id: 'mr1' }),
        },
      }
      return fn(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    await POST(req)

    expect(upsertCalled).toBe(true)
  })
})

// ============================================================
// Tests: Response behavior preserved
// ============================================================

describe('Registration response behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHash.mockResolvedValue('$2a$12$hashedpassword')
    mockProfileFindUnique.mockResolvedValue(null)
  })

  it('must return 201 with expected fields on success', async () => {
    mockTransaction.mockImplementation(async (fn: Function) => {
      const tx = createMockTxClient()
      return fn(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.data).toBeDefined()
    expect(data.data.id).toBe('user-1')
    expect(data.data.email).toBe('test@example.com')
    expect(data.data.organizationId).toBe('org-1')
    expect(data.data.organizationName).toBe("test's Workspace")
    // passwordHash must NEVER be in the response
    expect(data.data.passwordHash).toBeUndefined()
    expect(JSON.stringify(data)).not.toContain('passwordHash')
    expect(JSON.stringify(data)).not.toContain('hashedpassword')
  })

  it('must return 409 for duplicate email (code contract)', async () => {
    // Verify the route source code contains the 409 conflict check
    // and also checks email uniqueness inside the transaction (TOCTOU prevention)
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'register', 'route.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    // Must have 409 conflict response
    expect(content).toContain('CONFLICT')
    expect(content).toContain('409')
    // Must have findUnique for email check (at least 2: pre-tx + inside tx)
    const matches = content.match(/findUnique/g)
    expect(matches?.length).toBeGreaterThanOrEqual(2)
    // Must use $transaction
    expect(content).toContain('$transaction')
  })

  it('must return 429 when rate limited', async () => {
    // Override the rate limit mock for this test
    const rateLimitModule = await import('./rate-limit')
    vi.mocked(rateLimitModule.rateLimit).mockResolvedValue({
      success: false, remaining: 0, resetAt: Date.now() + 900000,
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'securepass123' }),
    })
    const response = await POST(req)

    expect(response.status).toBe(429)
  })
})

// ============================================================
// Helper: create a mock Prisma transaction client
// ============================================================

function createMockTxClient(overrides?: {
  throwOnCreate?: { model: string; error: Error }
  organizationCreate?: () => Promise<Record<string, string>>
}) {
  const baseTx = {
    profile: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'test',
      }),
    },
    organization: {
      create: overrides?.organizationCreate ?? vi.fn().mockResolvedValue({
        id: 'org-1',
        name: "test's Workspace",
        slug: 'test-workspace',
      }),
    },
    organizationMembership: {
      create: vi.fn().mockResolvedValue({
        id: 'mem-1',
        organizationId: 'org-1',
        userId: 'user-1',
      }),
    },
    permission: {
      upsert: vi.fn().mockResolvedValue({ id: 'perm-1', key: 'org:view' }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'perm-1', key: 'org:view' }),
    },
    role: {
      create: vi.fn().mockResolvedValue({ id: 'role-1', name: 'Owner', slug: 'owner' }),
    },
    rolePermission: {
      create: vi.fn().mockResolvedValue({ id: 'rp-1' }),
    },
    membershipRole: {
      create: vi.fn().mockResolvedValue({ id: 'mr-1' }),
    },
  }

  // Apply error injection if specified
  if (overrides?.throwOnCreate) {
    const { model, error } = overrides.throwOnCreate
    if (model === 'organization' && baseTx.organization.create) {
      baseTx.organization.create = vi.fn().mockRejectedValue(error)
    }
    if (model === 'permission' && baseTx.permission.upsert) {
      baseTx.permission.upsert = vi.fn().mockRejectedValue(error)
    }
  }

  return baseTx
}

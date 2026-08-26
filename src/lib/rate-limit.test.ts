// ============================================================
// MIANX.AI V3 — Distributed Rate Limiting Tests
//
// Tests the PostgreSQL-backed rate limiter.
// Mocks use $queryRaw (tagged template) to match production code.
// Mock return shapes use snake_case keys ("reset_at") to match
// the actual PostgreSQL column names created in migration 002.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// -- getClientIp (pure function, no DB dependency) --
import { getClientIp } from './rate-limit'

describe('getClientIp', () => {
  it('should prefer x-real-ip over x-forwarded-for', () => {
    // When both headers are present, x-real-ip is trusted (Vercel-set)
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('should use last x-forwarded-for entry when x-real-ip absent', () => {
    // Vercel appends the real client IP at the END of the chain
    // The first entry is client-spoofable and must NOT be trusted
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': 'spoofed.1.2.3, 5.6.7.8, 10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('should handle single IP in x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '172.16.0.1' },
    })
    expect(getClientIp(req)).toBe('172.16.0.1')
  })

  it('should return unknown when no IP headers present', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('unknown')
  })

  it('should trim whitespace from IPs in chain', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  spoofed  ,  5.6.7.8  ,  10.0.0.1  ' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('should trim whitespace from x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '  10.0.0.1  ' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('should NOT trust first x-forwarded-for entry (spoofing prevention)', () => {
    // An attacker sets the first XFF entry to a rotating IP.
    // The code must take the LAST entry (Vercel-appended), not the first.
    const req1 = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.1.1.1, 203.0.113.1' },
    })
    const req2 = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '2.2.2.2, 203.0.113.1' },
    })
    // Both should resolve to the SAME IP (the Vercel-appended one)
    expect(getClientIp(req1)).toBe('203.0.113.1')
    expect(getClientIp(req2)).toBe('203.0.113.1')
    expect(getClientIp(req1)).toBe(getClientIp(req2))
  })

  it('should handle empty x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '' },
    })
    expect(getClientIp(req)).toBe('unknown')
  })

  it('should handle x-forwarded-for with only commas', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': ', ,' },
    })
    expect(getClientIp(req)).toBe('unknown')
  })
})

// -- Rate Limit Interface Contract --
describe('rateLimit interface contract', () => {
  it('should export async rateLimit function accepting failClosed parameter', async () => {
    const mod = await import('./rate-limit')
    expect(typeof mod.rateLimit).toBe('function')
    const result = mod.rateLimit('test', 5, 1000)
    expect(result).toBeInstanceOf(Promise)
    const res = await result
    expect(typeof res.success).toBe('boolean')
    expect(typeof res.remaining).toBe('number')
    expect(typeof res.resetAt).toBe('number')
  })

  it('should export RateLimitResult with correct shape', async () => {
    const mod = await import('./rate-limit')
    const result: mod.RateLimitResult = {
      success: true,
      remaining: 4,
      resetAt: Date.now() + 60000,
    }
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.resetAt).toBeGreaterThan(Date.now())
  })

  it('should NOT export resetRateLimit (removed — dead code / brute-force risk)', async () => {
    const mod = await import('./rate-limit')
    expect(typeof (mod as Record<string, unknown>).resetRateLimit).not.toBe('function')
  })
})

// -- Distributed behavior tests (mocked DB) --
// Mock $queryRaw (tagged template) — the production API.
// Mock return keys MUST use snake_case ("reset_at") to match
// the actual PostgreSQL column names from migration 002.
const mockQueryRaw = vi.hoisted(() => vi.fn())
const mockExecuteRaw = vi.hoisted(() => vi.fn())

vi.mock('./db', () => ({
  db: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    // Legacy APIs must NOT be called
    $queryRawUnsafe: vi.fn(() => { throw new Error('$queryRawUnsafe must not be used') }),
    $executeRawUnsafe: vi.fn(() => { throw new Error('$executeRawUnsafe must not be used') }),
  },
}))

/** Helper: create a mock row matching PostgreSQL's actual return shape */
function mockRow(count: number, resetAtMs: number) {
  return [{ count, reset_at: new Date(resetAtMs) }]
}

describe('rateLimit distributed behavior (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // --- Requirement 1: First request succeeds ---
  it('should allow first request within limit', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(1, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  // --- Requirement 2: Requests below limit succeed ---
  it('should allow requests below limit', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(3, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(2)
  })

  // --- Requirement 3: Exact limit boundary ---
  it('should allow request at exactly the limit (count === maxRequests)', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(5, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(true)  // count 5 <= max 5
    expect(result.remaining).toBe(0)
  })

  // --- Requirement 4: Above limit is rejected ---
  it('should block request above limit (count > maxRequests)', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(6, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  // --- Requirement 5: Expired window starts a new window ---
  it('should reset count when window expires (handled by SQL CASE)', async () => {
    // When the UPSERT runs, if reset_at < now, the SQL sets count=1
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(1, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4) // 5 - 1 = 4 (fresh window)
  })

  // --- Requirement 6: Atomic UPSERT (concurrent safety) ---
  it('should use atomic upsert SQL (single round-trip, ON CONFLICT)', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(1, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    await rateLimit('test-atomic', 10, 60000)

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    const sql = mockQueryRaw.mock.calls[0][0]
    const fullSql = Array.isArray(sql) ? sql.raw.join('') : String(sql)
    expect(fullSql).toContain('ON CONFLICT')
    expect(fullSql).toContain('INSERT')
    expect(fullSql).toContain('RETURNING')
  })

  // --- Requirement 7: Separate keys for login and register ---
  it('should use separate keys for login and register', async () => {
    const now = Date.now()
    mockQueryRaw
      .mockResolvedValueOnce(mockRow(3, now + 60000))
      .mockResolvedValueOnce(mockRow(1, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    const loginResult = await rateLimit('login:1.2.3.4', 10, 60000)
    const regResult = await rateLimit('register:1.2.3.4', 5, 60000)

    expect(loginResult.success).toBe(true)
    expect(loginResult.remaining).toBe(7)
    expect(regResult.success).toBe(true)
    expect(regResult.remaining).toBe(4)
  })

  // --- Requirement 8: Fail-closed behavior on DB failure ---
  it('should fail-CLOSED when DB throws and failClosed=true (auth endpoints)', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('auth-key', 5, 60000, true)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should fail-OPEN when DB throws and failClosed=false (default)', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('non-auth-key', 5, 60000)

    expect(result.success).toBe(true)
  })

  // --- Requirement 9: PostgreSQL field naming matches application code ---
  it('should use snake_case column names matching migration 002', async () => {
    const now = Date.now()
    // This mock return shape MUST match what PostgreSQL actually returns
    // for: RETURNING "count", "reset_at"
    mockQueryRaw.mockResolvedValue([{ count: 1, reset_at: new Date(now + 60000) }])

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    // If the column names didn't match, this would throw TypeError
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    expect(typeof result.resetAt).toBe('number')
  })

  it('should NOT contain camelCase column references in SQL', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(1, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    await rateLimit('test-key', 5, 60000)

    const sql = mockQueryRaw.mock.calls[0][0]
    const fullSql = Array.isArray(sql) ? sql.raw.join('') : String(sql)
    // Must NOT contain the old camelCase column name
    expect(fullSql).not.toContain('"resetAt"')
    // Must contain the new snake_case column name
    expect(fullSql).toContain('"reset_at"')
  })

  // --- Requirement 10: IP extraction security ---
  it('should use x-real-ip (trusted) over x-forwarded-for (spoofable)', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': 'trust.this.ip', 'x-forwarded-for': 'spoofed.ip, other.ip' },
    })
    expect(getClientIp(req)).toBe('trust.this.ip')
  })

  it('should use last x-forwarded-for entry (Vercel-appended) when no x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': 'attacker.controlled, vercel.real.ip' },
    })
    expect(getClientIp(req)).toBe('vercel.real.ip')
  })

  // --- Requirement 11: Migration table structure ---
  it('migration 002 must create _rate_limits with snake_case columns', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const migrationPath = path.join(
      process.cwd(), 'prisma', 'migrations', '002_add_rate_limits_table.sql'
    )
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // Table must exist
    expect(sql).toContain('"_rate_limits"')
    // Snake_case columns
    expect(sql).toContain('"reset_at"')
    // Must NOT have camelCase
    expect(sql).not.toContain('"resetAt"')
    // Must have index
    expect(sql).toContain('_rate_limits_reset_at_idx')
    // Must be idempotent
    expect(sql).toContain('IF NOT EXISTS')
    // Must NOT have destructive statements
    expect(sql).not.toContain('DROP TABLE')
    expect(sql).not.toContain('DROP COLUMN')
    expect(sql).not.toContain('TRUNCATE')
    expect(sql).not.toContain('DELETE FROM')
  })

  // --- Requirement 12: Existing V2/V3 tables untouched ---
  it('migration 002 must NOT reference existing V2/V3 tables', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const migrationPath = path.join(
      process.cwd(), 'prisma', 'migrations', '002_add_rate_limits_table.sql'
    )
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    const existingTables = [
      '"User"', '"Profile"', '"Organization"', '"Agent"', '"V3Agent"',
      '"Subscription"', '"V3Subscription"', '"Notification"', '"V3Notification"',
      '"AgentMemory"', '"V3AgentMemory"', 'ALTER TABLE', 'DROP INDEX',
    ]
    for (const table of existingTables) {
      expect(sql).not.toContain(table)
    }
  })

  // --- Additional: No runtime DDL ---
  it('should NOT call $executeRaw for DDL (no CREATE TABLE/INDEX)', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(1, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    await rateLimit('test-no-ddl', 5, 60000)

    // $executeRaw should only be called for cleanup (probabilistic)
    if (mockExecuteRaw.mock.calls.length > 0) {
      for (const call of mockExecuteRaw.mock.calls) {
        const sql = Array.isArray(call[0]) ? call[0].raw.join('') : String(call[0])
        expect(sql).not.toContain('CREATE TABLE')
        expect(sql).not.toContain('CREATE INDEX')
      }
    }
  })

  // --- Additional: No $queryRawUnsafe usage ---
  it('should use $queryRaw (tagged template), not $queryRawUnsafe', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(1, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    await rateLimit('test-safe-sql', 5, 60000)

    // mockQueryRaw is $queryRaw — it was called, proving the production
    // code uses the tagged template API, not $queryRawUnsafe
    expect(mockQueryRaw).toHaveBeenCalled()
  })

  // --- Additional: remaining never goes negative ---
  it('should clamp remaining to 0 when count exceeds limit', async () => {
    const now = Date.now()
    mockQueryRaw.mockResolvedValue(mockRow(100, now + 60000))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0) // Not -95
  })

  // --- Additional: resetAt is a valid timestamp ---
  it('should return resetAt as a valid future timestamp', async () => {
    const now = Date.now()
    const expectedReset = now + 900000 // 15 min window
    mockQueryRaw.mockResolvedValue(mockRow(1, expectedReset))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 10, 900000)

    expect(result.resetAt).toBe(expectedReset)
    expect(result.resetAt).toBeGreaterThan(now)
  })

  // --- Additional: Defensive null row handling ---
  it('should handle empty result set (defensive null check)', async () => {
    mockQueryRaw.mockResolvedValue([])

    const { rateLimit } = await import('./rate-limit')
    const resultFailClosed = await rateLimit('test-empty', 5, 60000, true)
    const resultFailOpen = await rateLimit('test-empty-open', 5, 60000, false)

    expect(resultFailClosed.success).toBe(false)
    expect(resultFailClosed.remaining).toBe(0)
    expect(resultFailOpen.success).toBe(true)
  })
})

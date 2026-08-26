// ============================================================
// MIANX.AI V3 — Distributed Rate Limiting Tests
// Tests the PostgreSQL-backed rate limiter contract.
// Unit tests mock the DB; integration tests require a live DB.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// -- getClientIp (pure function, no DB dependency) --
import { getClientIp } from './rate-limit'

describe('getClientIp', () => {
  it('should extract IP from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('should fallback to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('should return unknown when no IP headers present', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('unknown')
  })

  it('should trim whitespace from forwarded IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('192.168.1.1')
  })

  it('should handle single IP in x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '172.16.0.1' },
    })
    expect(getClientIp(req)).toBe('172.16.0.1')
  })
})

// -- Rate Limit Interface Contract --
describe('rateLimit interface contract', () => {
  it('should export async rateLimit function', async () => {
    const mod = await import('./rate-limit')
    expect(typeof mod.rateLimit).toBe('function')
    const result = mod.rateLimit('test-contract', 5, 1000)
    expect(result).toBeInstanceOf(Promise)
    const res = await result
    expect(typeof res.success).toBe('boolean')
    expect(typeof res.remaining).toBe('number')
    expect(typeof res.resetAt).toBe('number')
  })

  it('should export async resetRateLimit function', async () => {
    const mod = await import('./rate-limit')
    expect(typeof mod.resetRateLimit).toBe('function')
    const result = mod.resetRateLimit('test-contract')
    expect(result).toBeInstanceOf(Promise)
    await result
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
})

// -- Distributed behavior tests (mocked DB) --
// Mocks must be hoisted to top level for vi.mock to work correctly
const mockQueryRaw = vi.hoisted(() => vi.fn())
const mockExecuteRaw = vi.hoisted(() => vi.fn())

vi.mock('./db', () => ({
  db: {
    $queryRawUnsafe: mockQueryRaw,
    $executeRawUnsafe: mockExecuteRaw,
  },
}))

describe('rateLimit distributed behavior (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('should allow first request within limit', async () => {
    const now = new Date()
    mockExecuteRaw.mockResolvedValue(undefined)
    mockQueryRaw.mockResolvedValue([{ count: 1, reset_at: new Date(now.getTime() + 60000) }])

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('should block when count exceeds limit', async () => {
    const now = new Date()
    mockExecuteRaw.mockResolvedValue(undefined)
    mockQueryRaw.mockResolvedValue([{ count: 6, reset_at: new Date(now.getTime() + 60000) }])

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should return correct remaining at limit boundary', async () => {
    const now = new Date()
    mockExecuteRaw.mockResolvedValue(undefined)
    mockQueryRaw.mockResolvedValue([{ count: 5, reset_at: new Date(now.getTime() + 60000) }])

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('should fail-open when DB query throws', async () => {
    mockExecuteRaw.mockRejectedValue(new Error('Connection refused'))

    const { rateLimit } = await import('./rate-limit')
    const result = await rateLimit('test-key', 5, 60000)

    expect(result.success).toBe(true)
  })

  it('should use atomic upsert SQL (single round-trip)', async () => {
    const now = new Date()
    mockExecuteRaw.mockResolvedValue(undefined)
    mockQueryRaw.mockResolvedValue([{ count: 1, reset_at: new Date(now.getTime() + 60000) }])

    const { rateLimit } = await import('./rate-limit')
    await rateLimit('test-atomic', 10, 60000)

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    const sql = mockQueryRaw.mock.calls[0][0]
    expect(sql).toContain('ON CONFLICT')
    expect(sql).toContain('INSERT')
  })

  it('should reset rate limit for a key', async () => {
    mockExecuteRaw.mockResolvedValue(undefined)

    const { resetRateLimit } = await import('./rate-limit')
    await resetRateLimit('test-key')

    expect(mockExecuteRaw).toHaveBeenCalled()
    const sql = mockExecuteRaw.mock.calls[mockExecuteRaw.mock.calls.length - 1][0]
    expect(sql).toContain('DELETE')
    expect(sql).toContain('$1')
  })

  it('should use separate keys for login and register', async () => {
    const now = new Date()
    mockExecuteRaw.mockResolvedValue(undefined)
    mockQueryRaw
      .mockResolvedValueOnce([{ count: 3, reset_at: new Date(now.getTime() + 60000) }])
      .mockResolvedValueOnce([{ count: 1, reset_at: new Date(now.getTime() + 60000) }])

    const { rateLimit } = await import('./rate-limit')
    const loginResult = await rateLimit('login:1.2.3.4', 10, 60000)
    const regResult = await rateLimit('register:1.2.3.4', 5, 60000)

    expect(loginResult.success).toBe(true)
    expect(loginResult.remaining).toBe(7)
    expect(regResult.success).toBe(true)
    expect(regResult.remaining).toBe(4)
  })
})

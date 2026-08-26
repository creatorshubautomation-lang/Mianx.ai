// ============================================================
// MIANX.AI V3 — Distributed Rate Limiting
// PostgreSQL-backed rate limiter for Vercel serverless.
//
// Uses a shared _rate_limits table so concurrent serverless
// instances enforce the same counters atomically.
// The table is created by a Prisma migration, never at request time.
// ============================================================

import { db } from './db'

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Clean up expired entries older than the given timestamp.
 * Called probabilistically (~10% of requests) to avoid unnecessary writes.
 */
async function cleanupExpired(now: Date): Promise<void> {
  if (Math.random() > 0.1) return
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM "_rate_limits" WHERE "reset_at" < $1`,
      now,
    )
  } catch {
    // Cleanup failure is non-critical; the primary limiter operation still runs.
  }
}

/**
 * Check and increment rate limit for a given key using an atomic upsert.
 *
 * Database errors fail closed. Authentication endpoints must not silently
 * lose brute-force protection when the limiter's backing store is unavailable.
 */
export async function rateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000,
): Promise<RateLimitResult> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  await cleanupExpired(now)

  try {
    const result = await db.$queryRawUnsafe<Array<{ count: number; reset_at: Date }>>(`
      INSERT INTO "_rate_limits" ("key", "count", "reset_at")
      VALUES ($1, 1, $2)
      ON CONFLICT ("key") DO UPDATE
        SET
          "count" = CASE
            WHEN "_rate_limits"."reset_at" < $3 THEN 1
            ELSE "_rate_limits"."count" + 1
          END,
          "reset_at" = CASE
            WHEN "_rate_limits"."reset_at" < $3 THEN $2
            ELSE "_rate_limits"."reset_at"
          END
      RETURNING "count", "reset_at"
    `, key, resetAt, now)

    const row = result[0]
    if (!row) {
      return { success: false, remaining: 0, resetAt: resetAt.getTime() }
    }

    const remaining = Math.max(0, maxRequests - row.count)
    return {
      success: row.count <= maxRequests,
      remaining,
      resetAt: row.reset_at.getTime(),
    }
  } catch {
    // Fail closed: auth rate limiting is a security control, not an optional
    // availability feature. Callers should return HTTP 429 on this result.
    return { success: false, remaining: 0, resetAt: resetAt.getTime() }
  }
}

/**
 * Reset rate limit for a given key after a successful authentication flow.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(`DELETE FROM "_rate_limits" WHERE "key" = $1`, key)
  } catch {
    // Non-critical: the next successful request remains protected by the window.
  }
}

/**
 * Get client IP from trusted proxy headers.
 * Vercel provides x-real-ip; when falling back to X-Forwarded-For,
 * use the last hop rather than the client-controlled first value.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const values = forwarded.split(',').map((value) => value.trim()).filter(Boolean)
    const last = values.at(-1)
    if (last) return last
  }

  return 'unknown'
}

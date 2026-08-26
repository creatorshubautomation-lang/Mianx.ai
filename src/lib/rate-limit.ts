// ============================================================
// MIANX.AI V3 — Distributed Rate Limiting
// PostgreSQL-backed rate limiter for Vercel serverless.
//
// Uses the _rate_limits table (created via migration 002)
// so concurrent serverless instances enforce the same counters
// atomically via a single UPSERT statement.
//
// SECURITY POLICY (fail-closed for auth endpoints):
//   If the rate-limit database operation fails, auth requests
//   are REJECTED with 429. This is intentional — when we cannot
//   verify a request is not an attack, we must assume it is.
//   Non-auth callers can pass failClosed: false for fail-open.
//
// IP TRUST (Vercel deployment):
//   Vercel sets x-real-ip to the actual client IP (trusted).
//   x-forwarded-for is client-spoofable (first entry = untrusted).
//   This code prefers x-real-ip, falls back to last XFF entry
//   (Vercel-appended), then 'unknown'.
// ============================================================

import { db } from './db'

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Clean up expired entries older than the given timestamp.
 * Called probabilistically (~10% of requests) to reduce bloat.
 * Cleanup failure is non-critical — expired rows are harmless
 * because the UPSERT CASE statement resets them on next use.
 */
async function cleanupExpired(now: Date): Promise<void> {
  if (Math.random() > 0.1) return
  try {
    await db.$executeRaw`DELETE FROM "_rate_limits" WHERE "reset_at" < ${now}`
  } catch {
    // Non-critical: expired rows get reset by UPSERT anyway
  }
}

/**
 * Check and increment rate limit for a given key using atomic upsert.
 *
 * The entire check-and-increment happens in a single SQL statement
 * so concurrent serverless instances cannot race.
 *
 * IMPORTANT: Column names in SQL and TypeScript MUST match.
 * The migration creates columns in snake_case ("reset_at").
 * PostgreSQL returns unquoted identifiers as-is. The pg driver
 * preserves the exact column name from RowDescription.
 * Therefore RETURNING "count", "reset_at" returns object keys
 * `count` and `reset_at` — matching the TypeScript type below.
 *
 * @param key - Unique identifier (e.g., "login:1.2.3.4" or "register:1.2.3.4")
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param failClosed - If true, reject request on DB failure (use for auth endpoints)
 * @returns RateLimitResult with success flag and metadata
 */
export async function rateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000,
  failClosed: boolean = false,
): Promise<RateLimitResult> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  // Run cleanup probabilistically (non-critical, best-effort)
  await cleanupExpired(now)

  try {
    // Atomic upsert: insert new entry or increment existing if within window.
    // If the window has expired, reset count to 1 and start a new window.
    // Uses Prisma.$queryRaw (tagged template) for automatic parameterization.
    //
    // PostgreSQL executes this as a single atomic statement with
    // row-level locking on ON CONFLICT, preventing concurrent races.
    const result = await db.$queryRaw<Array<{ count: number; reset_at: Date }>>`
      INSERT INTO "_rate_limits" ("key", "count", "reset_at")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE
        SET
          "count" = CASE
            WHEN "_rate_limits"."reset_at" < ${now} THEN 1
            ELSE "_rate_limits"."count" + 1
          END,
          "reset_at" = CASE
            WHEN "_rate_limits"."reset_at" < ${now} THEN ${resetAt}
            ELSE "_rate_limits"."reset_at"
          END
      RETURNING "count", "reset_at"
    `

    const row = result[0]
    if (!row) {
      // Defensive: UPSERT should always return a row, but if it
      // doesn't, fail according to the security policy.
      if (failClosed) {
        return { success: false, remaining: 0, resetAt: resetAt.getTime() }
      }
      return { success: true, remaining: maxRequests - 1, resetAt: resetAt.getTime() }
    }

    const remaining = Math.max(0, maxRequests - row.count)
    return {
      success: row.count <= maxRequests,
      remaining,
      resetAt: row.reset_at.getTime(),
    }
  } catch {
    // DATABASE FAILURE — security policy decision:
    //
    // fail-closed (auth endpoints): Reject the request.
    //   If we can't check the rate limit, we must assume the
    //   worst — the client could be brute-forcing. Returning 429
    //   is safer than allowing unbounded attempts.
    //   The error message does NOT leak internal details.
    //
    // fail-open (non-auth): Allow through for availability.
    if (failClosed) {
      return { success: false, remaining: 0, resetAt: resetAt.getTime() }
    }
    return { success: true, remaining: maxRequests - 1, resetAt: resetAt.getTime() }
  }
}

/**
 * Get client IP from request headers.
 *
 * Trust hierarchy for Vercel deployments:
 *   1. x-real-ip — Set by Vercel to the actual client IP. TRUSTED.
 *   2. x-forwarded-for (last entry) — Vercel appends the real
 *      client IP at the end of the chain. The FIRST entry is
 *      client-settable and NOT trusted.
 *   3. 'unknown' — Fallback when no trusted header is available.
 *
 * IMPORTANT: The old implementation took the FIRST x-forwarded-for
 * entry, which is client-spoofable. An attacker could rotate it
 * on every request to bypass per-IP rate limits.
 */
export function getClientIp(request: Request): string {
  // Prefer x-real-ip — set by Vercel, cannot be client-spoofed
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  // Fall back to x-forwarded-for — take LAST entry (Vercel-appended)
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim()).filter(Boolean)
    if (ips.length > 0) {
      return ips[ips.length - 1]
    }
  }

  return 'unknown'
}

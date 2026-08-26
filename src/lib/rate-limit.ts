// ============================================================
// MIANX.AI V3 — Distributed Rate Limiting
// PostgreSQL-backed rate limiter for Vercel serverless.
//
// Uses a shared _rate_limits table so concurrent serverless
// instances enforce the same counters atomically.
//
// Table is created at runtime via CREATE TABLE IF NOT EXISTS
// (infrastructure initialization, not a schema migration).
// ============================================================

import { db } from './db'

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Ensure the rate limits table exists.
 * Idempotent — safe to call on every cold start.
 * This is runtime infrastructure init, not a schema migration.
 */
let tableEnsured = false
async function ensureTable(): Promise<void> {
  if (tableEnsured) return
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_rate_limits" (
        "key"       TEXT PRIMARY KEY,
        "count"     INTEGER NOT NULL DEFAULT 1,
        "resetAt"   TIMESTAMPTZ NOT NULL
      )
    `)
    // Index for cleanup queries
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "_rate_limits_resetAt_idx" ON "_rate_limits" ("resetAt")
    `)
    tableEnsured = true
  } catch {
    // If table creation fails, rate limiting degrades to allow-through.
    // This is fail-open for availability; auth endpoints still validate credentials.
    // In practice, Supabase PostgreSQL is highly available.
  }
}

/**
 * Clean up expired entries older than the given timestamp.
 * Called probabilistically (~10% of requests) to avoid unnecessary writes.
 */
async function cleanupExpired(now: Date): Promise<void> {
  if (Math.random() > 0.1) return // ~10% chance to run cleanup
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM "_rate_limits" WHERE "resetAt" < $1`,
      now,
    )
  } catch {
    // Cleanup failure is non-critical
  }
}

/**
 * Check and increment rate limit for a given key using atomic upsert.
 *
 * The entire check-and-increment happens in a single SQL statement
 * so concurrent serverless instances cannot race.
 *
 * @param key - Unique identifier (e.g., "login:1.2.3.4" or "register:1.2.3.4")
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns RateLimitResult with success flag and metadata
 */
export async function rateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000,
): Promise<RateLimitResult> {
  await ensureTable()

  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  // Run cleanup probabilistically
  await cleanupExpired(now)

  try {
    // Atomic upsert: insert new entry or increment existing if within window
    // If the window has expired, reset count to 1 and start a new window
    const result = await db.$queryRawUnsafe<Array<{ count: number; reset_at: Date }>>(`
      INSERT INTO "_rate_limits" ("key", "count", "resetAt")
      VALUES ($1, 1, $2)
      ON CONFLICT ("key") DO UPDATE
        SET
          "count" = CASE
            WHEN "_rate_limits"."resetAt" < $3 THEN 1
            ELSE "_rate_limits"."count" + 1
          END,
          "resetAt" = CASE
            WHEN "_rate_limits"."resetAt" < $3 THEN $2
            ELSE "_rate_limits"."resetAt"
          END
      RETURNING "count", "resetAt"
    `, key, resetAt, now)

    const row = result[0]
    const remaining = Math.max(0, maxRequests - row.count)
    return {
      success: row.count <= maxRequests,
      remaining,
      resetAt: row.reset_at.getTime(),
    }
  } catch {
    // DB failure — fail open for availability.
    // Auth endpoints still perform full credential validation.
    return { success: true, remaining: maxRequests - 1, resetAt: resetAt.getTime() }
  }
}

/**
 * Reset rate limit for a given key (e.g., after successful auth).
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(`DELETE FROM "_rate_limits" WHERE "key" = $1`, key)
  } catch {
    // Non-critical
  }
}

/**
 * Get client IP from request headers.
 * Falls back to 'unknown' if no IP can be determined.
 */
export function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
}

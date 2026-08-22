// ============================================================
// MIANX.AI V3 — Rate Limiting
// In-memory rate limiter for login/registration endpoints
// ============================================================

/**
 * Simple in-memory rate limiter using a sliding window.
 * For production, replace with Redis-based distributed rate limiting.
 */

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given key.
 *
 * @param key - Unique identifier (e.g., IP address, email)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns RateLimitResult with success flag and metadata
 */
export function rateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000,
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now >= existing.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  if (existing.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count++
  return { success: true, remaining: maxRequests - existing.count, resetAt: existing.resetAt }
}

/**
 * Reset rate limit for a given key (e.g., after successful auth).
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
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
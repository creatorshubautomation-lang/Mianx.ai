// Lightweight rate limiter with Upstash Redis support.
//
// When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set,
// uses Upstash Ratelimit (sliding window) for true global limits on
// serverless platforms. Otherwise falls back to an in-memory token
// bucket that is per-instance only.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─────────────────────────────────────────────
//  In-memory fallback (per-instance)
// ─────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodically clear stale buckets so memory doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

// ─────────────────────────────────────────────
//  Upstash Ratelimit (global, lazy-init)
// ─────────────────────────────────────────────

// Cache one Ratelimit instance per (limit, windowSeconds) pair because
// each combination needs its own slidingWindow configuration.
const upstashInstances = new Map<string, Ratelimit>();

function getUpstashInstance(
  limit: number,
  windowSeconds: number,
): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cacheKey = `${limit}:${windowSeconds}`;
  let instance = upstashInstances.get(cacheKey);
  if (instance) return instance;

  const redis = new Redis({ url, token });
  instance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: true,
    prefix: "mianx:rl",
  });
  upstashInstances.set(cacheKey, instance);
  return instance;
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check + consume a rate limit slot for `key`.
 *
 * When Upstash Redis env vars are configured the call goes through the
 * Upstash sliding-window ratelimiter (global across all serverless
 * instances). On any Upstash error — or when env vars are missing — the
 * in-memory fallback is used instead.
 *
 * @param key      Unique identifier, e.g. `login:{ip}` or `chat:{userId}`
 * @param limit    Max requests allowed within the window
 * @param windowMs Window size in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const upstash = getUpstashInstance(limit, windowSeconds);

  if (upstash) {
    try {
      const result = await upstash.limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset, // Date → ms timestamp via valueOf()
      };
    } catch (e) {
      console.error(
        "[rate-limit] Upstash error, falling back to in-memory:",
        e,
      );
    }
  }

  return inMemoryRateLimit(key, limit, windowMs);
}

/** Best-effort client identifier from request headers (IP via proxy headers). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

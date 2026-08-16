// ─────────────────────────────────────────────
// Unit Tests: Rate Limiter (In-Memory Fallback)
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

describe("Rate Limiter — In-Memory Fallback", () => {
  beforeEach(() => {
    // Clear env vars so we always test in-memory path
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  it("should allow requests under the limit", async () => {
    const result = await rateLimit("test-key", 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(0);
  });

  it("should track remaining correctly", async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(await rateLimit("track-key", 5, 60000));
    }
    expect(results[0].remaining).toBe(4);
    expect(results[1].remaining).toBe(3);
    expect(results[2].remaining).toBe(2);
  });

  it("should block requests when limit exceeded", async () => {
    for (let i = 0; i < 3; i++) {
      await rateLimit("block-key", 3, 60000);
    }
    const result = await rateLimit("block-key", 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should reset after window expires (simulate with new key offset)", async () => {
    // This tests the logic concept — in reality we'd need to mock Date.now()
    const result1 = await rateLimit("reset-key", 1, 1); // 1ms window
    expect(result1.allowed).toBe(true);
    // The window is 1ms, so after a tiny delay it should reset
    await new Promise(resolve => setTimeout(resolve, 5));
    const result2 = await rateLimit("reset-key", 1, 1);
    expect(result2.allowed).toBe(true);
  });

  it("should track different keys independently", async () => {
    const r1 = await rateLimit("key-a", 1, 60000);
    const r2 = await rateLimit("key-b", 1, 60000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);

    const r3 = await rateLimit("key-a", 1, 60000);
    expect(r3.allowed).toBe(false);
    const r4 = await rateLimit("key-b", 1, 60000);
    expect(r4.allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("should extract IP from x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("should extract IP from x-real-ip when no forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("should return 'unknown' when no IP headers", () => {
    const req = new Request("http://localhost");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("should handle empty x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "" },
    });
    expect(getClientIp(req)).toBe("unknown");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  CONTENT_GENERATION_RATE_LIMIT,
  MemoryRateLimiter,
  T0_DETECTION_RATE_LIMIT,
  formatRateLimitUserMessage,
} from "./memoryRateLimit";

describe("memoryRateLimit", () => {
  const limiter = new MemoryRateLimiter();

  afterEach(() => {
    limiter.reset();
  });

  it("allows requests within limit", () => {
    const key = "test:user:1";
    for (let i = 0; i < CONTENT_GENERATION_RATE_LIMIT.maxRequests; i++) {
      expect(limiter.check(key, CONTENT_GENERATION_RATE_LIMIT)).toEqual({ allowed: true });
    }
  });

  it("blocks content generation after 3 requests per minute", () => {
    const key = "content-gen:user:42";
    for (let i = 0; i < 3; i++) {
      expect(limiter.check(key, CONTENT_GENERATION_RATE_LIMIT).allowed).toBe(true);
    }
    const blocked = limiter.check(key, CONTENT_GENERATION_RATE_LIMIT);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(formatRateLimitUserMessage(blocked.retryAfterMs)).toMatch(/^操作太频繁，请\d+分钟后再试$/);
    }
  });

  it("blocks T0 detection after 1 request per hour", () => {
    const key = "t0-detect:project:9";
    expect(limiter.check(key, T0_DETECTION_RATE_LIMIT).allowed).toBe(true);
    const blocked = limiter.check(key, T0_DETECTION_RATE_LIMIT);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(formatRateLimitUserMessage(blocked.retryAfterMs)).toContain("分钟后再试");
    }
  });

  it("formats at least 1 minute in user message", () => {
    expect(formatRateLimitUserMessage(500)).toBe("操作太频繁，请1分钟后再试");
    expect(formatRateLimitUserMessage(90_000)).toBe("操作太频繁，请2分钟后再试");
  });
});

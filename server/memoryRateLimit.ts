import { TRPCError } from "@trpc/server";

export const CONTENT_GENERATION_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 3,
} as const;

export const T0_DETECTION_RATE_LIMIT = {
  windowMs: 60 * 60_000,
  maxRequests: 1,
} as const;

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/** 将剩余等待时间格式化为「请 X 分钟后再试」文案（至少 1 分钟）。 */
export function formatRateLimitUserMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `操作太频繁，请${minutes}分钟后再试`;
}

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  check(key: string, config: RateLimitConfig): RateLimitCheckResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter(t => t > windowStart);

    if (timestamps.length >= config.maxRequests) {
      const oldestInWindow = timestamps[0] ?? now;
      const retryAfterMs = Math.max(0, oldestInWindow + config.windowMs - now);
      return { allowed: false, retryAfterMs };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return { allowed: true };
  }

  /** 测试用：清空计数 */
  reset(): void {
    this.buckets.clear();
  }
}

export const geoApiRateLimiter = new MemoryRateLimiter();

export function assertContentGenerationRateLimit(userId: number): void {
  const result = geoApiRateLimiter.check(
    `content-gen:user:${userId}`,
    CONTENT_GENERATION_RATE_LIMIT,
  );
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: formatRateLimitUserMessage(result.retryAfterMs),
    });
  }
}

export function assertT0DetectionRateLimit(projectId: number): void {
  const result = geoApiRateLimiter.check(
    `t0-detect:project:${projectId}`,
    T0_DETECTION_RATE_LIMIT,
  );
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: formatRateLimitUserMessage(result.retryAfterMs),
    });
  }
}

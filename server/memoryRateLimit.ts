import { TRPCError } from "@trpc/server";
import { GEO_SYSTEM_CONFIG_DEFAULTS } from "@shared/geoSystemConfig";
import {
  getContentGenerationRateLimitConfig,
  getT0DetectionRateLimitConfig,
} from "./geoSystemConfigStore";

/** 内置默认限流（测试与无 DB 场景） */
export const CONTENT_GENERATION_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: GEO_SYSTEM_CONFIG_DEFAULTS.contentGenerationPerMinuteLimit,
} as const;

export const T0_DETECTION_RATE_LIMIT = {
  windowMs: 60 * 60_000,
  maxRequests: GEO_SYSTEM_CONFIG_DEFAULTS.t0DetectionPerHourLimit,
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

export async function assertContentGenerationRateLimit(userId: number): Promise<void> {
  const config = await getContentGenerationRateLimitConfig();
  const result = geoApiRateLimiter.check(`content-gen:user:${userId}`, config);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: formatRateLimitUserMessage(result.retryAfterMs),
    });
  }
}

export async function assertT0DetectionRateLimit(projectId: number): Promise<void> {
  const config = await getT0DetectionRateLimitConfig();
  const result = geoApiRateLimiter.check(`t0-detect:project:${projectId}`, config);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: formatRateLimitUserMessage(result.retryAfterMs),
    });
  }
}

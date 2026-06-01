/** GEO-V1.1-Generation-Retry：内容生成连续失败与重试提示 */

export const MAX_CONTENT_GENERATION_CONSECUTIVE_FAILURES = 3;

export const CONTENT_GENERATION_RETRY_EXHAUSTED_MESSAGE =
  "生成多次失败，请检查企业资料是否完整";

export const CONTENT_GENERATION_REGENERATE_LABEL = "重新生成";

export function isContentGenerationRetryExhausted(failCount: number): boolean {
  return failCount >= MAX_CONTENT_GENERATION_CONSECUTIVE_FAILURES;
}

/** 同一平台连续失败时累加，换平台则从 1 开始 */
export function nextConsecutiveGenerationFailCount(
  platformKey: string,
  previous: { platformKey: string; failCount: number } | null | undefined,
): number {
  if (previous?.platformKey === platformKey) {
    return previous.failCount + 1;
  }
  return 1;
}

export function resolveContentGenerationFailureDisplay(input: {
  failCount: number;
  lastError?: string | null;
}): {
  message: string;
  exhausted: boolean;
  canRegenerate: boolean;
} {
  const exhausted = isContentGenerationRetryExhausted(input.failCount);
  if (exhausted) {
    return {
      message: CONTENT_GENERATION_RETRY_EXHAUSTED_MESSAGE,
      exhausted: true,
      canRegenerate: false,
    };
  }
  const trimmed = input.lastError?.trim();
  return {
    message: trimmed || "内容生成失败，请稍后重试",
    exhausted: false,
    canRegenerate: true,
  };
}

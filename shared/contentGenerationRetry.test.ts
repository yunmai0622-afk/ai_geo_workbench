import { describe, expect, it } from "vitest";
import {
  CONTENT_GENERATION_RETRY_EXHAUSTED_MESSAGE,
  MAX_CONTENT_GENERATION_CONSECUTIVE_FAILURES,
  nextConsecutiveGenerationFailCount,
  resolveContentGenerationFailureDisplay,
} from "./contentGenerationRetry";

describe("GEO-V1.1-Generation-Retry", () => {
  it("exhausts after 3 consecutive failures on same platform", () => {
    expect(MAX_CONTENT_GENERATION_CONSECUTIVE_FAILURES).toBe(3);
    let prev: { platformKey: string; failCount: number } | null = null;
    for (let i = 1; i <= 3; i++) {
      const failCount = nextConsecutiveGenerationFailCount("zhihu", prev);
      expect(failCount).toBe(i);
      prev = { platformKey: "zhihu", failCount };
    }
    const display = resolveContentGenerationFailureDisplay({ failCount: 3, lastError: "AI 不可用" });
    expect(display.exhausted).toBe(true);
    expect(display.canRegenerate).toBe(false);
    expect(display.message).toBe(CONTENT_GENERATION_RETRY_EXHAUSTED_MESSAGE);
  });

  it("resets fail count when platform changes", () => {
    const afterSwitch = nextConsecutiveGenerationFailCount("wechat", {
      platformKey: "zhihu",
      failCount: 2,
    });
    expect(afterSwitch).toBe(1);
  });

  it("keeps last error before exhaustion", () => {
    const display = resolveContentGenerationFailureDisplay({
      failCount: 2,
      lastError: "企业资料还缺少：产品服务",
    });
    expect(display.canRegenerate).toBe(true);
    expect(display.message).toContain("产品服务");
  });
});

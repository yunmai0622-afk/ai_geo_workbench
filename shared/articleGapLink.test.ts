import { describe, expect, it } from "vitest";
import {
  buildArticleGapDisplayLine,
  computeQuestionMentionRateChange,
  normalizeQuestionTextForMatch,
} from "./articleGapLink";

describe("articleGapLink", () => {
  it("formats customer-facing gap display line", () => {
    expect(buildArticleGapDisplayLine("竞品对比", "小鹅通和海豚知道哪个更适合知识付费？")).toBe(
      "本文针对缺口：竞品对比类问题 - 小鹅通和海豚知道哪个更适合知识付费？",
    );
  });

  it("normalizes question text for matching", () => {
    expect(normalizeQuestionTextForMatch("  a   b  ")).toBe("a b");
    expect(normalizeQuestionTextForMatch("   ")).toBeNull();
  });

  it("computes per-question mention rate delta between T0 and T1", () => {
    const result = computeQuestionMentionRateChange({
      baseRuns: [{ mentionedCompany: true }, { mentionedCompany: false }, { mentionedCompany: false }],
      compareRuns: [{ mentionedCompany: true }, { mentionedCompany: true }],
    });
    expect(result.hasData).toBe(true);
    expect(result.baseMentionRate).toBeCloseTo(1 / 3);
    expect(result.compareMentionRate).toBe(1);
    expect(result.mentionRateDelta).toBeCloseTo(2 / 3);
    expect(result.summaryLine).toContain("优化前基线");
    expect(result.summaryLine).toContain("7天后复测");
  });
});

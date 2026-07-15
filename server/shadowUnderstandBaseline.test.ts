import { describe, expect, it } from "vitest";
import { assertShadowBaselineScope, classifyShadowDifference, SHADOW_QUESTIONS } from "./shadowUnderstandBaseline";

describe("210001 shadow baseline", () => {
  it("persists one fixed localized question for every dimension", () => {
    expect(SHADOW_QUESTIONS).toHaveLength(8);
    expect(new Set(SHADOW_QUESTIONS.map(q => q.dimension)).size).toBe(8);
    expect(SHADOW_QUESTIONS.every(q => q.locale === "zh-CN" && q.scenario && q.audience)).toBe(true);
  });
  it("refuses global v2, other projects and v2 writes", () => {
    expect(() => assertShadowBaselineScope(210001, false, "shadow_read", "legacy")).not.toThrow();
    expect(() => assertShadowBaselineScope(210002, false, "shadow_read", "legacy")).toThrow();
    expect(() => assertShadowBaselineScope(210001, true, "shadow_read", "legacy")).toThrow();
    expect(() => assertShadowBaselineScope(210001, false, "v2_primary", "v2")).toThrow();
  });
  it("does not force incomparable scores to match", () => {
    expect(classifyShadowDifference({ legacyCount: 8, v2QuestionCount: 8, completedQuestions: 8, methodologyComparable: false, unresolvedConflict: true }))
      .toEqual(["incompatible_methodology", "requires_manual_review"]);
  });
});

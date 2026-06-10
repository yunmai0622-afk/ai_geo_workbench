import { describe, expect, it } from "vitest";
import {
  buildWizardStep8GeoGoalSuggestions,
  resolveWizardStep8HasAiTestData,
  suggestWizardStep8TargetPercent,
  WIZARD_STEP8_RATE_EMPTY_HINT,
} from "./wizardStep8GeoGoalDisplay";

describe("wizardStep8GeoGoalDisplay", () => {
  it("无实测数据时展示空态提示，不生成建议目标", () => {
    const result = buildWizardStep8GeoGoalSuggestions({
      brandMentionRate: null,
      recommendRate: null,
      hasAiTestData: false,
    });
    expect(result.mention.hasMeasuredData).toBe(false);
    expect(result.mention.suggestedTargetPercent).toBeNull();
    expect(result.mention.emptyHint).toBe(WIZARD_STEP8_RATE_EMPTY_HINT);
    expect(result.recommend.hasMeasuredData).toBe(false);
  });

  it("有实测数据时生成当前率、行业参考与建议目标", () => {
    const result = buildWizardStep8GeoGoalSuggestions({
      brandMentionRate: 0.18,
      recommendRate: 0.08,
      hasAiTestData: true,
    });
    expect(result.mention.currentRatePercent).toBe(18);
    expect(result.mention.industryReferenceLabel).toBe("30-50%");
    expect(result.mention.suggestedTargetPercent).toBe(30);
    expect(result.recommend.currentRatePercent).toBe(8);
    expect(result.recommend.suggestedTargetPercent).toBe(20);
  });

  it("建议目标随当前表现递进", () => {
    expect(suggestWizardStep8TargetPercent(18, 30, 50)).toBe(30);
    expect(suggestWizardStep8TargetPercent(35, 30, 50)).toBe(50);
    expect(suggestWizardStep8TargetPercent(55, 30, 50)).toBe(65);
  });

  it("识别是否已有 AI 实测数据", () => {
    expect(
      resolveWizardStep8HasAiTestData({
        hasCompletedT0Baseline: true,
        aiTestResultCount: 0,
        brandMentionRate: null,
        recommendRate: null,
      }),
    ).toBe(true);
    expect(
      resolveWizardStep8HasAiTestData({
        hasCompletedT0Baseline: false,
        aiTestResultCount: 5,
        brandMentionRate: 0.2,
        recommendRate: null,
      }),
    ).toBe(true);
    expect(
      resolveWizardStep8HasAiTestData({
        hasCompletedT0Baseline: false,
        aiTestResultCount: 0,
        brandMentionRate: null,
        recommendRate: null,
      }),
    ).toBe(false);
  });
});

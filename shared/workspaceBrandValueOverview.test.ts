import { describe, expect, it } from "vitest";
import {
  buildCompetitivePressureCopy,
  buildMonthlyPlanCompletionBenefitLines,
  resolveAiBrandStatusConclusion,
} from "./workspaceBrandValueOverview";

describe("workspaceBrandValueOverview", () => {
  it("resolves one-line AI brand status conclusion", () => {
    expect(
      resolveAiBrandStatusConclusion({
        mentionRatePct: 60,
        recommendRatePct: 50,
        competitorRatePct: 30,
      }),
    ).toBe("当前AI已能识别并推荐你的品牌，保持内容更新可巩固优势。");

    expect(
      resolveAiBrandStatusConclusion({
        mentionRatePct: 55,
        recommendRatePct: 35,
        competitorRatePct: 60,
      }),
    ).toBe("当前AI已能识别你的品牌，但在推荐场景中竞品占位更强。");

    expect(
      resolveAiBrandStatusConclusion({
        mentionRatePct: 45,
        recommendRatePct: 15,
        competitorRatePct: 20,
      }),
    ).toBe("AI对你的品牌有一定认知，但缺少足够的推荐理由。");

    expect(
      resolveAiBrandStatusConclusion({
        mentionRatePct: 20,
        recommendRatePct: 10,
        competitorRatePct: 70,
      }),
    ).toBe("当前AI对你品牌的认知不足，推荐场景中竞品更容易被提到。");
  });

  it("shows competitive pressure only when competitor rate exceeds recommend rate", () => {
    expect(
      buildCompetitivePressureCopy({
        mentionRatePct: 40,
        recommendRatePct: 20,
        competitorRatePct: 55,
      }),
    ).toContain("竞品出现率55%");
    expect(
      buildCompetitivePressureCopy({
        mentionRatePct: 40,
        recommendRatePct: 30,
        competitorRatePct: 20,
      }),
    ).toBeNull();
  });

  it("builds monthly plan completion benefit lines from plan data", () => {
    const lines = buildMonthlyPlanCompletionBenefitLines({
      progress: { totalCount: 5 },
      tasks: [
        { relatedQuestionId: 1, taskType: "content_generation" },
        { relatedQuestionId: 2, taskType: "content_generation" },
        { relatedQuestionId: 2, taskType: "profile_completion" },
      ],
      boundPublishAccountCount: 3,
    });
    expect(lines.some(line => line.text.includes("5 个优化任务"))).toBe(true);
    expect(lines.some(line => line.text.includes("2 个高价值AI搜索问题"))).toBe(true);
    expect(lines.some(line => line.text.includes("3 个内容发布平台"))).toBe(true);
    expect(lines.some(line => line.text.includes("7/14/30天AI复测依据"))).toBe(true);
  });
});

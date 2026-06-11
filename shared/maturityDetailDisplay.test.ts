import { describe, expect, it } from "vitest";
import { buildMaturityReport } from "./geoMaturityScoring";
import {
  buildMaturityDimensionDetailCards,
  buildMaturityNextActionItems,
  buildTopWeaknessHighlights,
  resolveMaturityDimensionConclusion,
  resolveMaturityDimensionStatus,
  resolveWeakestDimension,
  resolveWeakestDimensionAction,
} from "./maturityDetailDisplay";

describe("maturityDetailDisplay", () => {
  const report = buildMaturityReport({
    scores: {
      brandIdentityScore: 90,
      categoryPositioningScore: 70,
      questionCoverageScore: 40,
      sourceGraphScore: 30,
      trustEvidenceScore: 10,
      aiTestPerformanceScore: 0,
      totalScore: 45,
      calculationDetail: {},
    },
    calculatedAt: new Date("2026-06-09T08:00:00Z"),
  });

  it("resolves dimension status tiers", () => {
    expect(resolveMaturityDimensionStatus(85)).toBe("优秀");
    expect(resolveMaturityDimensionStatus(65)).toBe("良好");
    expect(resolveMaturityDimensionStatus(35)).toBe("待改善");
    expect(resolveMaturityDimensionStatus(10)).toBe("未建立");
  });

  it("resolves customer-facing conclusion by score band", () => {
    expect(resolveMaturityDimensionConclusion(0)).toBe("暂无数据/严重不足");
    expect(resolveMaturityDimensionConclusion(20)).toBe("暂无数据/严重不足");
    expect(resolveMaturityDimensionConclusion(21)).toBe("明显不足，需优先补充");
    expect(resolveMaturityDimensionConclusion(50)).toBe("基础具备，仍有较大提升空间");
    expect(resolveMaturityDimensionConclusion(70)).toBe("良好，可进一步强化");
    expect(resolveMaturityDimensionConclusion(90)).toBe("优秀");
  });

  it("builds six dimension cards with entry paths and conclusions", () => {
    const cards = buildMaturityDimensionDetailCards(report);
    expect(cards).toHaveLength(6);
    expect(cards.find(c => c.key === "questionCoverage")?.path).toBe("/questions");
    expect(cards.find(c => c.key === "trustEvidence")?.ctaLabel).toBe("去添加证据");
    expect(cards.find(c => c.key === "aiTestPerformance")?.conclusion).toBe("暂无数据/严重不足");
  });

  it("builds top three weaknesses sorted by score ascending", () => {
    const highlights = buildTopWeaknessHighlights(report);
    expect(highlights).toHaveLength(3);
    expect(highlights[0]?.key).toBe("aiTestPerformance");
    expect(highlights[1]?.key).toBe("trustEvidence");
    expect(highlights[2]?.key).toBe("sourceGraph");
  });

  it("resolves weakest dimension action for sidebar CTA", () => {
    const action = resolveWeakestDimensionAction(report);
    expect(action?.key).toBe("aiTestPerformance");
    expect(action?.path).toBe("/ai-diagnosis");
  });

  it("builds three prioritized next actions from weakest dimensions", () => {
    const actions = buildMaturityNextActionItems(report);
    expect(actions).toHaveLength(3);
    expect(actions[0]?.dimensionKey).toBe("aiTestPerformance");
  });

  it("resolves weakest dimension", () => {
    expect(resolveWeakestDimension(report)?.key).toBe("aiTestPerformance");
  });
});

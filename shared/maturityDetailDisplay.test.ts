import { describe, expect, it } from "vitest";
import { buildMaturityReport } from "./geoMaturityScoring";
import {
  buildMaturityDimensionDetailCards,
  buildMaturityNextActionItems,
  resolveMaturityDimensionStatus,
  resolveWeakestDimension,
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

  it("builds six dimension cards with entry paths", () => {
    const cards = buildMaturityDimensionDetailCards(report);
    expect(cards).toHaveLength(6);
    expect(cards.find(c => c.key === "questionCoverage")?.path).toBe("/questions");
    expect(cards.find(c => c.key === "trustEvidence")?.ctaLabel).toBe("去添加证据");
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

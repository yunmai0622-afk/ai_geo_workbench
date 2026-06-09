import { describe, expect, it } from "vitest";
import {
  buildMaturityReport,
  calculateAiTestPerformanceScore,
  calculateBrandIdentityScore,
  calculateCategoryPositioningScore,
  calculateGeoMaturityScores,
  calculateQuestionCoverageScore,
  calculateSourceGraphScore,
  calculateWeightedTotalScore,
  resolveEntityConsistencyBonus,
  resolveMaturityStage,
} from "./geoMaturityScoring";

describe("geoMaturityScoring", () => {
  it("scores brand identity with entity consistency tiers", () => {
    const full = calculateBrandIdentityScore({
      profile: {
        brandName: "测试品牌",
        officialWebsite: "https://example.com",
        oneLiner: "一句话介绍",
      },
      entityChecks: [{ status: "consistent" }, { status: "consistent" }],
      brandSourceCount: 3,
    });
    expect(full.score).toBe(100);

    const partial = resolveEntityConsistencyBonus([
      { status: "consistent" },
      { status: "missing" },
    ]);
    expect(partial.points).toBe(15);
    expect(partial.status).toBe("partial_consistent");
  });

  it("scores category positioning from five fields", () => {
    const result = calculateCategoryPositioningScore({
      industryTag: "SaaS",
      productDesc: "产品描述",
      keyPoints: ["a", "b", "c"],
      keywords: ["k1", "k2", "k3"],
      competitorDifference: "差异化",
    });
    expect(result.score).toBe(100);
  });

  it("applies question coverage tiers and six-category bonus", () => {
    const base = calculateQuestionCoverageScore(
      Array.from({ length: 25 }, () => ({ enabled: 1, searchPoolType: "brand_search" })),
    );
    expect(base.score).toBe(80);

    const withBonus = calculateQuestionCoverageScore([
      { enabled: 1, searchPoolType: "brand_search" },
      { enabled: 1, searchPoolType: "category_recommend" },
      { enabled: 1, searchPoolType: "scene_need" },
      { enabled: 1, searchPoolType: "comparison" },
      { enabled: 1, searchPoolType: "long_tail" },
      { enabled: 1, searchPoolType: "geo_region" },
      ...Array.from({ length: 24 }, () => ({ enabled: 1, searchPoolType: "brand_search" })),
    ]);
    expect(withBonus.score).toBe(100);
  });

  it("scores source graph with bonuses capped at 100", () => {
    const result = calculateSourceGraphScore([
      { platform: "official_site", aiCitationConfirmed: true },
      { platform: "zhihu" },
      { platform: "xiaohongshu" },
      { platform: "media" },
      { platform: "third_party" },
      { platform: "case_page" },
      { platform: "other" },
      { platform: "other2" },
    ]);
    expect(result.score).toBe(100);
  });

  it("computes AI test performance from mention and recommend rates", () => {
    const empty = calculateAiTestPerformanceScore([]);
    expect(empty.score).toBe(0);

    const mixed = calculateAiTestPerformanceScore([
      { mentionedCompany: true, recommendedCompany: true },
      { mentionedCompany: true, recommendedCompany: false },
      { mentionedCompany: false, recommendedCompany: false },
      { mentionedCompany: false, recommendedCompany: true },
    ]);
    expect(mixed.score).toBe(clamp(0.5 * 60 + 0.5 * 40));
  });

  it("resolves maturity stages by total score bands", () => {
    expect(resolveMaturityStage(10).stage).toBe("AI盲区期");
    expect(resolveMaturityStage(30).stage).toBe("初步建档期");
    expect(resolveMaturityStage(50).stage).toBe("信源建设期");
    expect(resolveMaturityStage(70).stage).toBe("可见增长期");
    expect(resolveMaturityStage(90).stage).toBe("稳定推荐期");
  });

  it("builds report with top weaknesses and next actions", () => {
    const scores = calculateGeoMaturityScores({
      profile: { brandName: "品牌" },
      entityChecks: [],
      brandSources: [],
      questions: [],
      trustEvidence: {
        verifiedCount: 0,
        draftCount: 0,
        rejectedCount: 0,
        totalTrustEvidenceCount: 0,
        customerCaseCount: 0,
      },
      aiTestRuns: [],
    });
    const report = buildMaturityReport({ scores, calculatedAt: new Date("2026-06-09") });
    expect(report.dimensions).toHaveLength(6);
    expect(report.topWeaknesses).toHaveLength(3);
    expect(report.nextActions).toHaveLength(3);
    expect(report.calculatedAt).toContain("2026");
  });

  it("calculates weighted total score", () => {
    const total = calculateWeightedTotalScore({
      brandIdentityScore: 80,
      categoryPositioningScore: 60,
      questionCoverageScore: 40,
      sourceGraphScore: 50,
      trustEvidenceScore: 30,
      aiTestPerformanceScore: 20,
      totalScore: 0,
      calculationDetail: {},
    });
    expect(total).toBe(46);
  });
});

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

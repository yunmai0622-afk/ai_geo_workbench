import { describe, expect, it } from "vitest";
import {
  buildUnifiedQualityGateArticle,
  computeAverageGeoQualityScore,
  dedupeLatestQualityScoreRows,
  getGeoQualityScoreTier,
  resolveEffectiveGeoQualityScore,
  resolveFriendlyQualityFailHints,
  resolveQualityCardView,
} from "./geoQualityScoreDisplay";

describe("geoQualityScoreDisplay", () => {
  it("maps score tiers", () => {
    expect(getGeoQualityScoreTier(95).label).toBe("优秀");
    expect(getGeoQualityScoreTier(90).label).toBe("优秀");
    expect(getGeoQualityScoreTier(89).label).toBe("良好");
    expect(getGeoQualityScoreTier(70).label).toBe("良好");
    expect(getGeoQualityScoreTier(69).label).toBe("一般");
    expect(getGeoQualityScoreTier(60).label).toBe("一般");
    expect(getGeoQualityScoreTier(59).label).toBe("需优化");
  });

  it("builds card view when score exists", () => {
    const view = resolveQualityCardView({
      geoQualityScore: 82,
      geoQualityRecommendation: "publish",
    });
    expect(view?.score).toBe(82);
    expect(view?.tier.label).toBe("良好");
  });

  it("returns friendly fail hints from detail", () => {
    const hints = resolveFriendlyQualityFailHints({
      geoQualityScore: 45,
      geoQualityRecommendation: "reject",
      geoQualityDetail: {
        total: 45,
        recommendation: "reject",
        suggestions: ["建议补充案例内容"],
        scores: {
          brand_entity: { score: 12, max: 20, reason: "品牌提及偏弱" },
          question_match: { score: 10, max: 20, reason: "未紧扣问题" },
          ai_citable_structure: { score: 8, max: 20, reason: "结构一般" },
          case_evidence: { score: 2, max: 15, reason: "reject" },
          competitor_comparison: { score: 8, max: 15, reason: "缺少对比" },
          platform_friendly: { score: 5, max: 10, reason: "ok" },
        },
      },
    });
    expect(hints[0]).toBe("建议补充案例内容");
    expect(hints.some(h => h.includes("案例"))).toBe(true);
    expect(hints.some(h => h.toLowerCase().includes("reject"))).toBe(false);
  });

  it("averages scored cards only", () => {
    expect(computeAverageGeoQualityScore([90, 70, null])).toBe(80);
    expect(computeAverageGeoQualityScore([null, undefined])).toBeNull();
  });

  it("prefers fresh article geo score over legacy row", () => {
    const article = { geoQualityScore: 88, geoQualityRecommendation: "publish", geoQualityStale: 0 };
    expect(resolveEffectiveGeoQualityScore(article, { totalScore: 70 })).toBe(88);
    const unified = buildUnifiedQualityGateArticle(article, { totalScore: 70 });
    expect(unified.qualityPasses).toBe(true);
  });

  it("dedupes latest quality rows per article", () => {
    const rows = dedupeLatestQualityScoreRows([
      { articleId: 1, totalScore: 88 },
      { articleId: 1, totalScore: 70 },
      { articleId: 2, totalScore: 60 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.totalScore).toBe(88);
  });
});

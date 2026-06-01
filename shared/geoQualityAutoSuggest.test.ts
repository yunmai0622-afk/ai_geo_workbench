import { describe, expect, it } from "vitest";
import {
  GEO_QUALITY_AUTO_SUGGEST_SCORE_THRESHOLD,
  GEO_QUALITY_OPTIMIZATION_SUGGESTIONS,
  resolveGeoQualityOptimizationSuggestions,
} from "./geoQualityAutoSuggest";

const baseDetail = {
  total: 65,
  recommendation: "revise" as const,
  suggestions: [],
  scores: {
    brand_entity: { score: 14, max: 20, reason: "品牌提及尚可" },
    question_match: { score: 12, max: 20, reason: "问题覆盖一般" },
    ai_citable_structure: { score: 13, max: 20, reason: "结构尚可" },
    case_evidence: { score: 4, max: 15, reason: "缺少具体客户案例" },
    competitor_comparison: { score: 10, max: 15, reason: "竞品对比偏弱" },
    platform_friendly: { score: 3, max: 10, reason: "标题未包含核心关键词" },
  },
};

describe("geoQualityAutoSuggest", () => {
  it("returns empty when score is at or above threshold", () => {
    expect(
      resolveGeoQualityOptimizationSuggestions({
        geoQualityScore: GEO_QUALITY_AUTO_SUGGEST_SCORE_THRESHOLD,
        geoQualityRecommendation: "revise",
        geoQualityDetail: baseDetail,
        title: "短标题",
        markdownContent: "x".repeat(100),
      }),
    ).toEqual([]);
  });

  it("maps dimensions and length to fixed suggestions below 70", () => {
    const suggestions = resolveGeoQualityOptimizationSuggestions({
      geoQualityScore: 65,
      geoQualityRecommendation: "revise",
      geoQualityDetail: baseDetail,
      title: "品牌介绍",
      markdownContent: "正文较短",
    });
    expect(suggestions).toContain(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingCase);
    expect(suggestions).toContain(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.unclearTitle);
    expect(suggestions).toContain(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.contentTooShort);
  });

  it("suggests data support when case_evidence reason mentions data", () => {
    const suggestions = resolveGeoQualityOptimizationSuggestions({
      geoQualityScore: 62,
      geoQualityRecommendation: "revise",
      geoQualityDetail: {
        ...baseDetail,
        scores: {
          ...baseDetail.scores,
          case_evidence: { score: 3, max: 15, reason: "缺少具体数字与数据支撑" },
          platform_friendly: { score: 8, max: 10, reason: "结构清晰" },
        },
      },
      title: "含关键词的标题示例",
      markdownContent: "x".repeat(2200),
    });
    expect(suggestions).toContain(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.missingData);
    expect(suggestions).not.toContain(GEO_QUALITY_OPTIMIZATION_SUGGESTIONS.contentTooShort);
  });

  it("skips suggestions when quality score is stale", () => {
    expect(
      resolveGeoQualityOptimizationSuggestions({
        geoQualityScore: 55,
        geoQualityRecommendation: "reject",
        geoQualityStale: true,
        geoQualityDetail: baseDetail,
        title: "t",
        markdownContent: "short",
      }),
    ).toEqual([]);
  });
});

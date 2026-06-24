import { describe, expect, it } from "vitest";
import {
  buildQuestionPoolGapOverview,
  buildSearchPoolOverviewMetrics,
  filterQuestionsRequiringEntityAnchor,
  filterQuestionsRequiringSourceType,
  formatQuestionPoolGapMetricValue,
  groupQuestionsBySearchPoolType,
  mapLegacyTypeToSearchPoolType,
  mapSearchPoolTypeToLegacyQuestionType,
  parseTargetKeywordsInput,
  resolveSearchPoolTypeRenewalSceneLabel,
  type SearchPoolQuestionRow,
} from "./questionSearchPool";

const sampleQuestions: SearchPoolQuestionRow[] = [
  {
    id: 1,
    questionText: "品牌 A 怎么样？",
    questionType: "品牌认知",
    enabled: 1,
    searchPoolType: "brand_search",
    requiredSourceTypes: ["official_site", "zhihu"],
    requiredEntityAnchors: ["brand_name"],
    priorityLevel: "high",
    lastTestResult: "mentioned",
  },
  {
    id: 2,
    questionText: "行业推荐",
    questionType: "行业推荐",
    enabled: 1,
    searchPoolType: "category_recommend",
    requiredSourceTypes: ["media"],
    requiredEntityAnchors: ["keywords"],
    priorityLevel: "medium",
    lastTestResult: "not_mentioned",
  },
  {
    id: 3,
    questionText: "竞品对比",
    questionType: "竞品对比",
    enabled: 1,
    searchPoolType: "comparison",
    requiredSourceTypes: ["official_site"],
    requiredEntityAnchors: ["case"],
    lastTestResult: "competitor_won",
  },
];

describe("questionSearchPool", () => {
  it("maps search pool type to legacy question type", () => {
    expect(mapSearchPoolTypeToLegacyQuestionType("brand_search")).toBe("品牌认知");
    expect(mapSearchPoolTypeToLegacyQuestionType("scene_need")).toBe("scenario_need");
  });

  it("maps searchPoolType to customer-facing renewal scene labels", () => {
    expect(resolveSearchPoolTypeRenewalSceneLabel("scene_need")).toBe("场景需求");
    expect(resolveSearchPoolTypeRenewalSceneLabel("brand_recognition")).toBe("品牌认知");
    expect(resolveSearchPoolTypeRenewalSceneLabel("brand_search")).toBe("品牌认知");
    expect(resolveSearchPoolTypeRenewalSceneLabel("industry_recommendation")).toBe("行业推荐");
    expect(resolveSearchPoolTypeRenewalSceneLabel("category_recommend")).toBe("行业推荐");
    expect(resolveSearchPoolTypeRenewalSceneLabel("long_tail_conversion")).toBe("长尾转化");
    expect(resolveSearchPoolTypeRenewalSceneLabel("long_tail")).toBe("长尾转化");
    expect(resolveSearchPoolTypeRenewalSceneLabel("competitor_comparison")).toBe("竞品对比");
    expect(resolveSearchPoolTypeRenewalSceneLabel("comparison")).toBe("竞品对比");
    expect(resolveSearchPoolTypeRenewalSceneLabel("local_industry")).toBe("地域/行业");
    expect(resolveSearchPoolTypeRenewalSceneLabel("geo_region")).toBe("地域/行业");
    expect(resolveSearchPoolTypeRenewalSceneLabel("unknown_type")).toBe("相关");
    expect(resolveSearchPoolTypeRenewalSceneLabel(null)).toBe("相关");
  });

  it("maps legacy question type to search pool type", () => {
    expect(mapLegacyTypeToSearchPoolType("品牌认知")).toBe("brand_search");
    expect(mapLegacyTypeToSearchPoolType("scenario_need")).toBe("scene_need");
    expect(mapLegacyTypeToSearchPoolType("痛点解决")).toBe("scene_need");
  });

  it("builds overview metrics", () => {
    const metrics = buildSearchPoolOverviewMetrics(sampleQuestions);
    expect(metrics.total).toBe(3);
    expect(metrics.covered).toBe(1);
    expect(metrics.notMentioned).toBe(1);
    expect(metrics.competitorWon).toBe(1);
    expect(metrics.highPriority).toBe(1);
  });

  it("groups by search pool type including empty tabs", () => {
    const grouped = groupQuestionsBySearchPoolType(sampleQuestions);
    expect(grouped.brand_search).toHaveLength(1);
    expect(grouped.category_recommend).toHaveLength(1);
    expect(grouped.comparison).toHaveLength(1);
    expect(grouped.scene_need).toHaveLength(0);
    expect(grouped.long_tail).toHaveLength(0);
    expect(grouped.geo_region).toHaveLength(0);
  });

  it("filters questions requiring source type", () => {
    const official = filterQuestionsRequiringSourceType(sampleQuestions, "official_site");
    expect(official.map(q => q.id)).toEqual([1, 3]);
  });

  it("filters questions requiring entity anchor", () => {
    const brand = filterQuestionsRequiringEntityAnchor(sampleQuestions, "brand_name");
    expect(brand.map(q => q.id)).toEqual([1]);
  });

  it("parses target keywords input", () => {
    expect(parseTargetKeywordsInput("GEO, 品牌,认知")).toEqual(["GEO", "品牌", "认知"]);
  });

  it("builds gap overview with diagnosis guard", () => {
    const withDiagnosis = buildQuestionPoolGapOverview({
      questions: sampleQuestions,
      contentTaskCount: 4,
      hasDiagnosisData: true,
    });
    expect(withDiagnosis.uncoveredQuestions).toBe(2);
    expect(withDiagnosis.generatedContentTasks).toBe(4);

    const withoutDiagnosis = buildQuestionPoolGapOverview({
      questions: sampleQuestions,
      contentTaskCount: 0,
      hasDiagnosisData: false,
    });
    expect(formatQuestionPoolGapMetricValue(withoutDiagnosis.uncoveredQuestions, false)).toBe("暂无诊断数据");
  });
});

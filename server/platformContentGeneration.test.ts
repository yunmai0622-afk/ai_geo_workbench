import { describe, expect, it } from "vitest";
import {
  PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE,
  PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE,
  PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE,
  toPlatformContentGenerationError,
} from "@shared/platformContentGenerationErrors";
import { buildDefaultPlatformStrategy } from "@shared/platformContentRules";
import {
  assertEnterpriseProfileForPlatformGeneration,
  assertPlatformContentStrategyParams,
} from "./platformContentGenerationPreconditions";
import {
  enrichGenerationBasisForDraft,
  generateGeoArticleTopics,
  validateGenerationBasis,
  type P11ProjectLike,
  type P11TaskLike,
} from "./geoArticleLogic";

const project: P11ProjectLike = {
  id: 1,
  enterpriseName: "测试企业",
  industry: "教育",
  targetCustomers: "企业客户",
  coreSellingPoints: "AI 增长",
  competitorNames: [],
  coreKeywords: ["AI 搜索"],
  website: "https://example.com",
  productIntro: "企业级 AI 内容平台",
};

const tasks: P11TaskLike[] = [
  {
    id: 1,
    taskType: "行业文章",
    taskName: "补齐知乎选型内容",
    priority: "P1",
    generationReason: "AI 未充分提及品牌",
    executionSuggestion: "建议撰写场景指南",
    expectedImpact: "提升可见度",
    status: "todo",
  },
];

describe("platform content generation errors (P0)", () => {
  it("maps profile, params, and AI failures to customer messages", () => {
    expect(toPlatformContentGenerationError("缺少生成依据：竞品差距")).toBe(
      PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE,
    );
    expect(toPlatformContentGenerationError("请填写目标问题")).toBe(PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE);
    expect(toPlatformContentGenerationError("LLM invoke failed: 503")).toBe(PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE);
  });

  it("rejects missing platform params", () => {
    const partial = buildDefaultPlatformStrategy({ targetQuestion: "" });
    expect(() => assertPlatformContentStrategyParams(partial)).toThrow(PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE);
  });

  it("rejects insufficient enterprise profile", () => {
    const strategy = buildDefaultPlatformStrategy({ targetQuestion: "如何选型？" });
    expect(() =>
      assertEnterpriseProfileForPlatformGeneration(
        { ...project, productIntro: "" },
        { profile: null },
        strategy,
      ),
    ).toThrow(PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE);
  });

  it("accepts platform targetQuestion when DB has no questions after enrich", () => {
    const [topic] = generateGeoArticleTopics({ project, tasks });
    const strategy = buildDefaultPlatformStrategy({
      targetQuestion: "中小企业如何选择 GEO 服务商？",
    });
    const basis = enrichGenerationBasisForDraft(
      {
        customerQuestionId: 0,
        customerQuestion: "",
        contentGap: topic.contentGap ?? "",
        optimizationTaskId: tasks[0].id,
        optimizationTask: tasks[0].taskName,
        notRecommendedReason: tasks[0].generationReason ?? "",
        competitorGap: "",
        competitorNames: [],
        sourceAnalysisIds: [],
        sourceQuestionIds: [],
        manualReviewConclusion: "复核",
        assetLibraryUsage: {
          enterpriseMaterials: [],
          competitorMaterials: [],
          customerCaseUsage: { used: false, status: "待补充", references: [] },
          complianceRules: [],
          contentStyles: [],
          publishStrategy: [],
          missingEvidenceNotes: [],
        },
      },
      { project, topic, task: tasks[0], platformStrategy: strategy },
    );
    expect(basis.customerQuestion).toBe(strategy.targetQuestion);
    expect(basis.competitorGap.length).toBeGreaterThan(0);
    expect(() => validateGenerationBasis(basis)).not.toThrow();
  });
});

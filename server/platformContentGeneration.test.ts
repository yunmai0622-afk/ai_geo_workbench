import { describe, expect, it } from "vitest";
import {
  PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE,
  PLATFORM_CONTENT_AI_AUTH_FAILED_MESSAGE,
  PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
  PLATFORM_CONTENT_AI_RATE_LIMIT_MESSAGE,
  PLATFORM_CONTENT_AI_TIMEOUT_MESSAGE,
  PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE,
  PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
  PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE,
  PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE,
  PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE,
  PLATFORM_CONTENT_STALE_TOPICS_MESSAGE,
  PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE,
  PLATFORM_CONTENT_GEO_STRUCTURE_OPTIMIZING_MESSAGE,
  PLATFORM_CONTENT_QC_MANUAL_REVIEW_MESSAGE,
  toPlatformContentGenerationError,
} from "@shared/platformContentGenerationErrors";
import { classifyPlatformContentLlmError, isNonLlmPlatformContentError } from "@shared/platformContentLlmErrors";
import { diagnoseLlmProviderEnv } from "@shared/llmEnvDiagnostics";
import { buildDefaultPlatformStrategy } from "@shared/platformContentRules";
import {
  assertEnterpriseProfileForPlatformGeneration,
  assertPlatformContentStrategyParams,
} from "./platformContentGenerationPreconditions";
import { buildPlatformContentStrategyMeta } from "@shared/platformContentRules";
import {
  buildAssetLibraryUsage,
  buildGenerationBasis,
  buildGeoArticleBodyFromTemplate,
  ensurePlatformCollectableMarkdown,
  enrichGenerationBasisForDraft,
  generateGeoArticleTopics,
  validateGenerationBasis,
  validateGeoCollectableStructure,
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
  it("maps profile, params, diagnosis gate, and AI failures to customer messages", () => {
    expect(toPlatformContentGenerationError("企业资料还缺少：产品服务。请先完善后再生成。")).toContain(
      "企业资料还缺少",
    );
    expect(toPlatformContentGenerationError("请填写目标问题")).toBe(PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE);
    expect(toPlatformContentGenerationError("LLM invoke failed: 503")).toBe(PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE);
    expect(toPlatformContentGenerationError("OPENAI_API_KEY is not configured")).toBe(
      PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
    );
    expect(toPlatformContentGenerationError("OpenAI LLM invoke failed: status=401 Unauthorized")).toBe(
      PLATFORM_CONTENT_AI_AUTH_FAILED_MESSAGE,
    );
    expect(toPlatformContentGenerationError("LLM invoke failed: 429 Too Many Requests")).toBe(
      PLATFORM_CONTENT_AI_RATE_LIMIT_MESSAGE,
    );
    expect(toPlatformContentGenerationError("OpenAI request timed out after 180000ms")).toBe(
      PLATFORM_CONTENT_AI_TIMEOUT_MESSAGE,
    );
    expect(classifyPlatformContentLlmError("OPENAI_API_KEY is not configured").code).toBe("not_configured");
    expect(classifyPlatformContentLlmError("status=403").code).toBe("auth_failed");
    expect(classifyPlatformContentLlmError("429 rate limit").code).toBe("rate_limit");
    expect(classifyPlatformContentLlmError("OPENAI_TIMEOUT").code).toBe("timeout");
    expect(
      classifyPlatformContentLlmError("生成的内容未通过 GEO 结构校验（## 便于引用的要点）").code,
    ).toBe("not_llm_error");
    expect(isNonLlmPlatformContentError("文章缺少 GEO 可收录结构：## 便于引用的要点，不能生成。")).toBe(true);
    expect(
      toPlatformContentGenerationError("文章缺少 GEO 可收录结构：## 便于引用的要点，不能生成。"),
    ).toBe(PLATFORM_CONTENT_GEO_STRUCTURE_OPTIMIZING_MESSAGE);
    expect(PLATFORM_CONTENT_QC_MANUAL_REVIEW_MESSAGE).toContain("人工检查");
    expect(diagnoseLlmProviderEnv().provider).toBeTruthy();
    expect(toPlatformContentGenerationError("请先完成 AI 语义分析，再生成优化任务")).toBe(
      PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE,
    );
    expect(toPlatformContentGenerationError("请先生成优化任务，再生成内容模板")).toBe(
      PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
    );
    expect(toPlatformContentGenerationError("文章选题必须绑定优化任务，不能生成无来源文章")).toBe(
      PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE,
    );
    expect(toPlatformContentGenerationError("缺少生成依据：竞品差距")).toContain("生成依据还缺少");
    expect(toPlatformContentGenerationError("文章选题不存在")).toBe(PLATFORM_CONTENT_STALE_TOPICS_MESSAGE);
    expect(toPlatformContentGenerationError("文章选题不存在")).not.toBe(PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE);
    expect(toPlatformContentGenerationError("无权访问该客户项目")).toBe(PLATFORM_CONTENT_PROJECT_ACCESS_MESSAGE);
  });

  it("rejects missing platform params", () => {
    const partial = buildDefaultPlatformStrategy({ targetQuestion: "" });
    expect(() => assertPlatformContentStrategyParams(partial)).toThrow(PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE);
  });

  it("rejects insufficient enterprise profile with specific labels", () => {
    const strategy = buildDefaultPlatformStrategy({ targetQuestion: "如何选型？" });
    expect(() =>
      assertEnterpriseProfileForPlatformGeneration(
        { ...project, productIntro: "" },
        { profile: null },
        strategy,
      ),
    ).toThrow(/企业资料还缺少/);
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

  it("test-template body includes platform GEO sections when platform strategy is set", () => {
    const strategy = buildDefaultPlatformStrategy({
      targetPublishPlatform: "zhihu",
      targetQuestion: "知识付费平台怎么选？",
    });
    const [topic] = generateGeoArticleTopics({ project, tasks });
    let basis = buildGenerationBasis({ project, topic, task: tasks[0], questions: [], analyses: [] });
    basis.platformContentStrategy = buildPlatformContentStrategyMeta(strategy) as unknown as Record<string, unknown>;
    basis = enrichGenerationBasisForDraft(basis, { project, topic, task: tasks[0], platformStrategy: strategy });
    const body = buildGeoArticleBodyFromTemplate({
      project,
      topic,
      task: tasks[0],
      basis,
      structure: {
        summary: "摘要",
        actionGuide: "行动",
        unsuitableCustomers: "不适合",
        suitableCustomers: "适合",
        conclusion: "结论",
        updatedAt: "2026-05-26",
      },
      snippets: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
        { question: "Q3", answer: "A3" },
      ],
      evidence: { questionsText: "", gaps: "", reasons: "", competitors: [] },
      assetUsage: buildAssetLibraryUsage(null),
      assetLibrary: null,
      enterpriseEvidenceText: "企业资料",
      competitorEvidenceText: "竞品资料",
      wovenReasons: "原因",
      wovenGaps: "缺口",
      materialDigest: "材料",
      evidenceGapText: "待核验",
    });
    expect(body).toMatch(/## 便于引用的要点/);
    expect(body).not.toMatch(/## 平台适配说明/);
    expect(body).not.toMatch(/## GEO 质量自检说明/);
    expect(validateGeoCollectableStructure(body, undefined, basis)).toEqual([]);
  });

  it("repairs LLM-like markdown missing platform GEO tail sections before validation", () => {
    const strategy = buildDefaultPlatformStrategy({
      targetPublishPlatform: "zhihu",
      targetQuestion: "知识付费平台怎么选？",
    });
    const [topic] = generateGeoArticleTopics({ project, tasks });
    let basis = buildGenerationBasis({ project, topic, task: tasks[0], questions: [], analyses: [] });
    basis.platformContentStrategy = buildPlatformContentStrategyMeta(strategy) as unknown as Record<string, unknown>;
    basis = enrichGenerationBasisForDraft(basis, { project, topic, task: tasks[0], platformStrategy: strategy });
    const snippets = [
      { question: "Q1", answer: "A1" },
      { question: "Q2", answer: "A2" },
      { question: "Q3", answer: "A3" },
    ];
    const llmLike = [
      "# 知识付费平台怎么选？",
      "## 直接回答",
      "先给结论：按场景选型。",
      "## 判断依据",
      "依据公开资料整理。",
      "## 实操建议",
      "分步执行即可。",
      "## 便于引用的要点",
      "### Q1",
      "A1",
      "### Q2",
      "A2",
      "### Q3",
      "A3",
    ].join("\n\n");
    const repaired = ensurePlatformCollectableMarkdown(llmLike, snippets, basis);
    expect(repaired).not.toMatch(/## 平台适配说明/);
    expect(repaired).not.toMatch(/## GEO 质量自检说明/);
    expect(repaired).toMatch(/## 便于引用的要点/);
    expect(validateGeoCollectableStructure(repaired, snippets, basis)).toEqual([]);
  });

  it("maps GEO structure validation errors to optimizing copy, not generic AI unavailable", () => {
    expect(toPlatformContentGenerationError("文章缺少 GEO 可收录结构：## 平台适配说明，不能生成。")).toBe(
      PLATFORM_CONTENT_GEO_STRUCTURE_OPTIMIZING_MESSAGE,
    );
    expect(toPlatformContentGenerationError("文章缺少 GEO 可收录结构：## 平台适配说明，不能生成。")).not.toBe(
      PLATFORM_CONTENT_AI_UNAVAILABLE_MESSAGE,
    );
    expect(toPlatformContentGenerationError("文章缺少 GEO 可收录结构：## 平台适配说明，不能生成。")).not.toBe(
      PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
    );
  });
});

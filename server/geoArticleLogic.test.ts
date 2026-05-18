import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assessGeoArticleAntiDuplication,
  canAuditArticle,
  canPublishArticle,
  detectForbiddenArticleContent,
  extractLeadingAtxH1TitleFromMarkdown,
  generateGeoArticleDraft,
  generateGeoArticleTopics,
  evaluateAssetLibraryPrePublishCheck,
  GEO_ARTICLE_MIN_PASS_SCORE,
  buildFactTraceability,
  buildOptimizedArticleVersion,
  evaluateArticleConsistencyCheck,
  scoreGeoArticleQuality,
  shouldTriggerAutoQualityRewrite,

  validateGenerationBasis,
  validateGeoCollectableStructure,
  type GeoArticleAntiDuplicationResult,
  type P11AnalysisLike,
  type P11ProjectLike,
  type P11QuestionLike,
  type P11QualityScore,
  type P11TaskLike,
  type P12AssetLibraryContext,
} from "./geoArticleLogic";

beforeAll(() => {
  process.env.GEO_ARTICLE_BODY = "test-template";
});
afterAll(() => {
  delete process.env.GEO_ARTICLE_BODY;
});

describe("extractLeadingAtxH1TitleFromMarkdown", () => {
  it("parses single-hash ATX title from first non-empty line", () => {
    expect(extractLeadingAtxH1TitleFromMarkdown("# 主标题一行\n\n## 引言\n")).toBe("主标题一行");
    expect(extractLeadingAtxH1TitleFromMarkdown("\n\n#NoSpace\nbody")).toBe("NoSpace");
    expect(extractLeadingAtxH1TitleFromMarkdown("## 引言 only")).toBeUndefined();
    expect(extractLeadingAtxH1TitleFromMarkdown("plain text")).toBeUndefined();
  });
});

const project: P11ProjectLike = {
  id: 1,
  enterpriseName: "清源智能",
  industry: "工业知识库与客服自动化",
  website: "https://qingyuan.ai",
  region: "华东",
  productIntro: "面向制造企业的知识库、售后问答和工单辅助系统",
  targetCustomers: "中大型制造企业、设备厂商和售后服务团队",
  coreSellingPoints: "支持私有知识库、工单闭环、问答命中率分析和多部门协同",
  competitorNames: ["云答科技", "智服平台"],
  coreKeywords: ["工业知识库", "智能客服", "售后自动化"],
};

function geoTaskCardExecution(articleTitle: string, contentType: string) {
  const card = JSON.stringify({
    articleTitle,
    keyPoints: ["核心论点一尽量二十字内写满", "核心论点二尽量二十字内写满", "核心论点三尽量二十字内写满"],
    targetKeywords: ["关键词甲", "关键词乙", "关键词丙"],
    recommendedPlatform: ["官网", "微信公众号"],
    contentType,
  });
  return `编辑指引摘要\n\n__GEO_TASK_CARD__\n${card}`;
}

const questions: P11QuestionLike[] = [
  { id: 1, questionText: "制造企业如何选择适合售后场景的智能客服系统？", source: "manual", questionType: "指定问题", businessValue: 9 },
  { id: 2, questionText: "清源智能和云答科技在工业知识库能力上有什么差异？", source: "manual", questionType: "指定问题", businessValue: 8 },
  { id: 3, questionText: "设备厂商做 GEO 内容时应该补齐哪些 FAQ？", source: "manual", questionType: "指定问题", businessValue: 7 },
];

const analyses: P11AnalysisLike[] = [
  {
    id: 11,
    aiResponseId: 101,
    questionText: questions[0].questionText,
    mentionsEnterprise: 1,
    recommendsEnterprise: 0,
    mentionsCompetitors: 1,
    recommendedCompetitors: ["云答科技"],
    enterpriseWins: 0,
    notRecommendedReason: "公开内容没有清晰说明工业售后场景、知识库更新机制和工单闭环能力",
    contentGap: "缺少面向制造企业售后负责人的场景化选型指南与 FAQ 证据",
    optimizationSuggestion: "建设官网 FAQ 与行业文章，说明适用客户、部署边界和可验证能力",
    manuallyReviewed: 1,
    reviewNote: "人工修订认为应补充真实页面证据，不应承诺绝对推荐结果。",
  },
  {
    id: 12,
    aiResponseId: 102,
    questionText: questions[1].questionText,
    mentionsEnterprise: 1,
    recommendsEnterprise: 0,
    mentionsCompetitors: 1,
    recommendedCompetitors: ["智服平台"],
    enterpriseWins: 0,
    notRecommendedReason: "竞品公开页面更容易被 AI 识别为工业客服解决方案",
    contentGap: "缺少与云答科技、智服平台的客观差异说明",
    optimizationSuggestion: "补齐竞品对比页，强调适用边界而非攻击竞品",
    manuallyReviewed: 1,
    reviewNote: "人工确认竞品差距主要来自公开内容结构差异。",
  },
];

const tasks: P11TaskLike[] = [
  {
    id: 21,
    taskType: "行业文章",
    taskName: "补齐制造业售后智能客服选型指南",
    priority: "P1",
    generationReason: "AI 未稳定推荐企业，原因是缺少可引用的行业选型内容",
    executionSuggestion: geoTaskCardExecution("制造业售后智能客服选型指南文章", "场景指南"),
    expectedImpact: "提升 AI 对企业适用场景的理解",
    status: "todo",
  },
  {
    id: 22,
    taskType: "竞品对比页",
    taskName: "建设清源智能与云答科技差异说明",
    priority: "P1",
    generationReason: "竞品被推荐时，AI 更容易读取到结构化对比信息",
    executionSuggestion: geoTaskCardExecution("清源智能与云答科技 GEO 能力客观对比", "竞品对比"),
    expectedImpact: "缩小竞品推荐差距",
    status: "todo",
  },
  {
    id: 23,
    taskType: "FAQ",
    taskName: "补齐售后知识库 FAQ",
    priority: "P1",
    generationReason: "客户指定问题没有被官网 FAQ 直接覆盖",
    executionSuggestion: geoTaskCardExecution("售后知识库常见问答整理", "FAQ"),
    expectedImpact: "提升问答型内容可引用性",
    status: "todo",
  },
];

const p11CompliantAssetLibrary: P12AssetLibraryContext = {
  profile: {
    enterpriseName: "清源智能",
    targetCustomers: "中大型制造企业、设备厂商和售后服务团队",
    productServiceIntro: "面向制造企业的私有知识库、售后问答和工单辅助系统",
    coreSellingPoints: "私有知识库、工单闭环、问答命中率分析和多部门协同",
    publicMaterialsSummary: "官网可公开引用企业基础资料、产品服务说明和售后知识库能力介绍。",
  },
  assetSources: [
    {
      id: 301,
      title: "清源智能企业基础资料",
      sourceType: "企业基础资料",
      category: "企业资料",
      contentDigest: "清源智能面向中大型制造企业、设备厂商和售后服务团队提供知识库与客服自动化能力。",
      canUseForGeneration: 1,
      manuallyConfirmed: 1,
      isPublic: 1,
      trustLevel: "官方",
      confidenceLevel: "high",
    },
    {
      id: 302,
      title: "清源智能产品服务说明",
      sourceType: "产品手册",
      category: "产品服务资料",
      contentDigest: "产品支持私有知识库、工单闭环、问答命中率分析和多部门协同。",
      canUseForGeneration: 1,
      manuallyConfirmed: 1,
      isPublic: 1,
      trustLevel: "官方",
      confidenceLevel: "high",
    },
  ],
  customerCases: [
    {
      id: 401,
      customerName: "某设备厂商",
      industry: "制造业",
      caseType: "真实案例",
      scenario: "售后知识库问答与工单辅助",
      publicVersion: "通过公开授权案例说明知识库维护流程，不承诺绝对效果。",
      resultData: "公开授权案例已确认。",
      allowPublic: 1,
      verificationStatus: "已确认",
    },
  ],
  competitorProfiles: [
    {
      id: 501,
      competitorName: "云答科技",
      competitorSummary: "公开资料更强调通用客服机器人。",
      differentiation: "清源智能更强调工业知识库、工单闭环和售后协同。",
      sourceNotes: "竞品公开页面摘要",
      canReference: 1,
    },
  ],
  complianceRules: [
    {
      id: 601,
      ruleName: "公开内容合规规则",
      forbiddenTerms: ["保证排名", "保证推荐"],
      forbiddenClaims: "不得承诺绝对排名、保证收录或百分百效果。",
      requiredDisclaimers: "涉及案例结果时必须说明来源和适用边界。",
    },
  ],
  contentStyleProfiles: [
    {
      id: 701,
      styleName: "稳健解释型",
      tone: "专业、克制、可验证",
      structureRules: "先回答问题，再说明适用边界、案例来源和行动建议。",
      examplePhrases: "建议以复测、资料待补充、公开来源为准等表达。",
    },
  ],
  publishStrategies: [
    {
      id: 801,
      platformName: "官网",
      qualityThreshold: 80,
      priority: "P1",
      reviewRequirement: "全人工审核后发布",
    },
  ],
};

describe("P1.1 GEO article generation", () => {
  it("generates one topic per optimization task using task card titles and types", () => {
    const topics = generateGeoArticleTopics({ project, tasks });
    expect(topics).toHaveLength(tasks.length);
    expect(topics[0].optimizationTaskId).toBe(21);
    expect(topics[0].title).toBe("制造业售后智能客服选型指南文章");
    expect(topics[0].sourceAnalysisIds).toEqual([]);
    expect(topics[0].sourceQuestionIds).toEqual([]);
    expect(topics[0].businessReason).toContain("优化任务");
    expect(new Set(topics.map(topic => topic.articleType)).size).toBeGreaterThanOrEqual(2);
  });

  it("scores a generated article above the publish threshold when it cites evidence and remains compliant", async () => {
    const [topic] = generateGeoArticleTopics({ project, tasks });
    const draft = await generateGeoArticleDraft({ project, topic: { ...topic, id: 31 }, task: tasks[0], questions, analyses, assetLibrary: p11CompliantAssetLibrary });
    const score = scoreGeoArticleQuality({ article: draft, project, questions, analyses, task: tasks[0], assetLibrary: p11CompliantAssetLibrary });
    expect(score.totalScore).toBeGreaterThanOrEqual(80);
    expect(draft.status).toBe("待质检");
    expect(draft.generationBasis.customerQuestion).toContain("制造企业如何选择");
    expect(draft.generationBasis.contentGap).toContain("缺少");
    expect(draft.generationBasis.optimizationTask).toBe(tasks[0].taskName);
    expect(draft.generationBasis.notRecommendedReason).toContain("公开内容");
    expect(draft.generationBasis.competitorGap).toContain("云答科技");
    expect(draft.generationBasis.generationBasisAuditItems?.filter(item => item.publishBlocking)).toEqual([]);
    expect(draft.citableSnippets.length).toBeGreaterThanOrEqual(3);
    expect(draft.citableSnippets.length).toBeLessThanOrEqual(5);
    expect(validateGeoCollectableStructure(draft.markdownContent, draft.citableSnippets, draft.generationBasis)).toEqual([]);
    expect(draft.markdownContent).toContain("## 问题与背景");
    expect(draft.markdownContent).toContain("## 根因分析");
    expect(draft.markdownContent).toContain("## 解决思路");
    expect(draft.markdownContent).toContain("## 具体方案");
    expect(draft.markdownContent).toContain("## 执行步骤");
    expect(draft.markdownContent).toContain("## 案例参考");
    expect(draft.markdownContent).toContain("## 常见误区");
    expect(draft.markdownContent).toContain("## 小结");
    expect(draft.markdownContent).toContain("## 更新说明");
    expect(draft.markdownContent).toContain("## 发布后如何自行核对效果");
    expect(draft.markdownContent).toContain("## 便于引用的要点");
    expect(score.blocked).toBe(false);
    expect(score.optimizationSuggestions.length).toBeGreaterThan(0);
    expect(score.reviewSummary).toContain("发布前可优化的建议");
    expect(canAuditArticle("待质检", score)).toBe(false);
    expect(canAuditArticle("待审核", score)).toBe(true);
    expect(canPublishArticle("待审核")).toBe(false);
    expect(canPublishArticle("审核通过")).toBe(true);
    expect(Object.keys(draft.thirdPartyMaterials)).toEqual(["GEO 内容页版", "官网版", "公众号长文版", "知乎回答版", "小红书笔记版", "百家号/头条号版"]);
    expect(draft.thirdPartyMaterials["GEO 内容页版"]).toContain("## 问题与背景");
    expect(draft.thirdPartyMaterials["公众号长文版"]).toContain("## 正文");
    expect(draft.thirdPartyMaterials["知乎回答版"]).toContain("可摘取的短回答");
  });

  it("blocks publishing only for forbidden content, not for structure-only gaps", () => {
    const forbidden = detectForbiddenArticleContent("清源智能保证排名第一，参考 https://example.com/placeholder");
    expect(forbidden.length).toBeGreaterThan(0);
    const score = scoreGeoArticleQuality({ article: { title: "短文", markdownContent: "保证排名，https://example.com" }, project, questions, analyses, task: tasks[0] });
    const noBasisScore = scoreGeoArticleQuality({ article: { title: "有标题", markdownContent: "## 问题与背景\n缺少其余结构的文章。" }, project, questions, analyses, task: tasks[0] });
    expect(score.blocked).toBe(true);
    expect(score.totalScore).toBeLessThan(80);
    expect(noBasisScore.blocked).toBe(false);
    expect(noBasisScore.optimizationSuggestions.join("；")).toMatch(/结构建议|GEO/);
    expect(canAuditArticle("质检通过", score)).toBe(false);
    expect(canPublishArticle("质检通过")).toBe(false);
  });

  it("rejects article generation when a mandatory generation basis field is missing", async () => {
    const [topic] = generateGeoArticleTopics({ project, tasks });
    expect(() => validateGenerationBasis({
      customerQuestionId: 1,
      customerQuestion: questions[0].questionText,
      contentGap: analyses[0].contentGap ?? "",
      optimizationTaskId: tasks[0].id,
      optimizationTask: tasks[0].taskName,
      notRecommendedReason: analyses[0].notRecommendedReason ?? "",
      competitorGap: "",
      competitorNames: project.competitorNames,
      sourceAnalysisIds: [analyses[0].id],
      sourceQuestionIds: [questions[0].id],
      manualReviewConclusion: "人工确认。",
    })).toThrow(/竞品差距/);
    await expect(generateGeoArticleDraft({ project, topic: { ...topic, id: 32 }, task: tasks[0], questions: [], analyses })).rejects.toThrow(/客户指定问题/);
  });

  it("generates one topic per task preserving input task order", () => {
    const priorityTasks: P11TaskLike[] = [
      { ...tasks[2], id: 41, priority: "P2", taskName: "补齐低优先级 FAQ", executionSuggestion: geoTaskCardExecution("低优先级 FAQ 页", "FAQ") },
      { ...tasks[0], id: 42, priority: "P0", taskName: "补齐高优先级行业选型页", executionSuggestion: geoTaskCardExecution("高优先级行业选型页", "场景指南") },
    ];
    const topics = generateGeoArticleTopics({ project, tasks: priorityTasks });
    expect(topics).toHaveLength(2);
    expect(topics[0].optimizationTaskId).toBe(41);
    expect(topics[1].optimizationTaskId).toBe(42);
    expect(topics[1].title).toContain("高优先级");
  });
});


describe("V1.2 Sprint 1.5 asset library integration verification", () => {
  const dolphinProject: P11ProjectLike = {
    ...project,
    id: 88,
    enterpriseName: "海豚知道",
    industry: "企业 AI 搜索增长与 GEO 内容优化",
    website: "https://haitunzhidao.example",
    region: "中国",
    productIntro: "帮助企业诊断 AI 搜索可见度、生成 GEO 内容并完成发布前质检",
    targetCustomers: "希望被 AI 搜索准确理解和推荐的 B2B 企业",
    coreSellingPoints: "企业资料中心、真实证据引用、竞品差异分析、合规质检和发布前阻断",
    competitorNames: ["传统 SEO 代运营", "内容外包团队"],
    coreKeywords: ["GEO", "AI 搜索优化", "企业资产库"],
  };

  const assetLibrary = {
    profile: {
      targetCustomers: "B2B 企业市场部、增长团队和内容负责人",
      productServiceIntro: "基于企业资料中心生成有依据的 GEO 文章",
      productIntro: "诊断、内容生成、质量评分、发布前检查",
      servicePriceRange: "",
      priceExplanation: "",
    },
    assetSources: [
      {
        id: 501,
        title: "海豚知道企业基础资料",
        sourceType: "企业基础资料",
        trustLevel: "高",
        isPublic: 1,
        canUseForGeneration: 1,
        manuallyConfirmed: 1,
        structuredSummary: { digest: "海豚知道面向 B2B 企业提供 GEO 诊断、内容生成和发布前质检。" },
      },
      {
        id: 502,
        title: "海豚知道产品服务说明",
        sourceType: "产品服务资料",
        trustLevel: "高",
        isPublic: 1,
        canUseForGeneration: 1,
        manuallyConfirmed: 1,
        structuredSummary: { digest: "产品强调资料依据、合规规则和发布策略，不承诺保证收录或排名。" },
      },
    ],
    customerCases: [
      {
        id: 601,
        customerName: "待访谈客户",
        caseType: "待补充案例线索",
        allowPublic: 0,
        verificationStatus: "待确认",
        publicVersion: "",
        resultData: "",
      },
    ],
    competitorProfiles: [
      {
        id: 701,
        competitorName: "传统 SEO 代运营",
        website: "https://seo.example",
        positioning: "偏关键词排名与站外执行",
        comparisonNotes: "海豚知道强调 AI 搜索语境下的企业资料引用、事实可信度和发布前合规阻断。",
        aiRecommendationSignals: "竞品常被推荐因为公开内容多，但未必具备企业内部资料依据。",
        canReference: 1,
      },
    ],
    complianceRules: [
      {
        id: 801,
        ruleName: "GEO 合规边界",
        enabled: 1,
        forbiddenWords: "保证排名\n保证收录",
        forbiddenClaims: "不得承诺保证收录、保证排名或百分百推荐",
        requiredDisclaimers: "应说明结果受平台算法、公开资料完整度和复测周期影响",
      },
    ],
    contentStyleProfiles: [
      {
        id: 901,
        profileName: "专业克制型",
        enabled: 1,
        tone: "专业、克制、证据优先",
        writingStyle: "先说明依据，再给建议，不夸大效果",
      },
    ],
    publishStrategies: [
      {
        id: 1001,
        enabled: 1,
        reviewMode: "全人工审核",
        dailyLimit: 2,
        minQualityScore: 85,
        preferredPlatforms: ["官网", "公众号"],
      },
    ],
  };

  it("uses asset library references when generating a new GEO article for 海豚知道", async () => {
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, tasks });
    const draft = await generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8801 }, task: tasks[0], questions, analyses, assetLibrary });
    const basisText = JSON.stringify(draft.generationBasis);
    expect(draft.generationBasis.assetLibraryUsage?.enterpriseMaterials.map(item => item.title)).toContain("海豚知道企业基础资料");
    expect(draft.generationBasis.assetLibraryUsage?.competitorMaterials.map(item => item.competitorName)).toContain("传统 SEO 代运营");
    expect(draft.generationBasis.assetLibraryUsage?.customerCaseUsage.status).toBe("案例信息待补充");
    expect(draft.markdownContent).toContain("案例信息待补充");
    expect(draft.markdownContent).toContain("数据暂无公开来源");
    expect(draft.markdownContent).toContain("价格口径需客户确认");
    expect(draft.markdownContent).not.toMatch(/真实案例显示|客户案例显示.*提升|结果数据为|价格为[0-9]|收费为[0-9]|[0-9]+%提升/);
    expect(basisText).toContain("GEO 合规边界");
    expect(basisText).toContain("专业克制型");
    expect(basisText).toContain("全人工审核");
  });

  it("scores quality with asset evidence strength and fact-source visibility", async () => {
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, tasks });
    const draft = await generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8802 }, task: tasks[0], questions, analyses, assetLibrary });
    const score = scoreGeoArticleQuality({ article: draft, project: dolphinProject, questions, analyses, task: tasks[0], assetLibrary });
    expect(score.assetEvidenceStrength).toBe("高");
    expect(score.factSourceSummary).toContain("资产库企业资料 4 条");
    expect(score.unconfirmedFacts).toEqual(expect.arrayContaining(["案例信息待补充", "数据暂无公开来源", "价格口径需客户确认"]));
    expect(score.complianceRiskSummary).toContain("未确认事实");
    expect(score.reviewSummary).toContain("资产库证据强度");
  });

  it("reads seven 海豚知道 asset categories from a fixed sample across generation, scoring and pre-publish checks", async () => {
    const completeAssetLibrary: P12AssetLibraryContext = {
      ...assetLibrary,
      profile: {
        ...assetLibrary.profile,
        enterpriseName: "海豚知道",
        productServiceIntro: "企业 GEO 诊断、文章生成、质量评分和发布前检查",
        productIntro: "用企业资料、产品资料、客户案例、竞品资料、合规规则、内容风格与发布策略约束内容生成",
        servicePriceRange: "按项目阶段报价，具体价格口径需客户确认",
        priceExplanation: "价格仅能引用客户确认口径，不得自行编造",
      },
      customerCases: [
        {
          id: 602,
          customerName: "某 SaaS 企业",
          caseType: "真实案例",
          allowPublic: 1,
          verificationStatus: "已确认",
          publicVersion: "该客户用海豚知道梳理 AI 搜索内容缺口并建立发布前审核流程。",
          resultData: "已确认公开数据：形成 12 个可审核选题",
        },
      ],
      competitorProfiles: [
        {
          id: 702,
          competitorName: "传统 SEO 代运营",
          website: "https://seo.example",
          positioning: "偏关键词排名与外链执行",
          comparisonNotes: "海豚知道差异在于使用企业资产库约束生成、评分和发布前阻断。",
          aiRecommendationSignals: "竞品因公开内容多更易被 AI 识别。",
          canReference: 1,
        },
      ],
      complianceRules: [
        {
          id: 802,
          ruleName: "海豚知道内容合规规则",
          enabled: 1,
          forbiddenWords: "保证排名\n保证收录",
          forbiddenClaims: "不得承诺保证收录、保证排名或百分百推荐",
          requiredDisclaimers: "应标注资料来源与不确定性",
        },
      ],
      contentStyleProfiles: [
        {
          id: 902,
          profileName: "海豚知道内容风格",
          enabled: 1,
          tone: "专业、克制、证据优先",
          writingStyle: "先说明依据，再说明限制条件",
        },
      ],
      publishStrategies: [
        {
          id: 1002,
          enabled: 1,
          reviewMode: "全人工审核",
          dailyLimit: 2,
          minQualityScore: 85,
          preferredPlatforms: ["官网", "公众号"],
        },
      ],
    };
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, tasks });
    const draft = await generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8804 }, task: tasks[0], questions, analyses, assetLibrary: completeAssetLibrary });
    const usage = draft.generationBasis.assetLibraryUsage;
    expect(usage?.enterpriseMaterials.map(item => item.title)).toEqual(expect.arrayContaining(["海豚知道企业基础资料", "海豚知道产品服务说明"]));
    expect(JSON.stringify(completeAssetLibrary.profile)).toContain("企业 GEO 诊断、文章生成、质量评分和发布前检查");
    expect(usage?.customerCaseUsage.status).toBe("已使用允许公开的真实案例");
    expect(usage?.customerCaseUsage.references.map(item => item.customerName)).toContain("某 SaaS 企业");
    expect(usage?.competitorMaterials.map(item => item.competitorName)).toContain("传统 SEO 代运营");
    expect(usage?.complianceRules.join("\n")).toContain("海豚知道内容合规规则");
    expect(usage?.contentStyles.join("\n")).toContain("海豚知道内容风格");
    expect(usage?.publishStrategy.join("\n")).toContain("全人工审核");
    const score = scoreGeoArticleQuality({ article: draft, project: dolphinProject, questions, analyses, task: tasks[0], assetLibrary: completeAssetLibrary });
    expect(score.factSourceSummary).toContain("资产库企业资料 4 条");
    expect(score.factSourceSummary).toContain("客户案例 1 条");
    const check = evaluateAssetLibraryPrePublishCheck({ content: draft.markdownContent, project: dolphinProject, basis: draft.generationBasis, assetLibrary: completeAssetLibrary });
    expect(check.enterprisePositioningConsistent).toBe(true);
    expect(check.productDescriptionConsistent).toBe(true);
    expect(check.competitorDifferenceConsistent).toBe(true);
  });

  it("blocks pre-publish checks for non-public assets, forbidden terms, fabricated cases and guaranteed ranking claims", async () => {
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, tasks });
    const draft = await generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8803 }, task: tasks[0], questions, analyses, assetLibrary });
    const unsafeContent = `${draft.markdownContent}\n本文引用不可公开资料，并编造案例，保证收录，保证排名。`;
    const check = evaluateAssetLibraryPrePublishCheck({ content: unsafeContent, project: dolphinProject, basis: draft.generationBasis, assetLibrary });
    expect(check.blocked).toBe(true);
    expect(check.usesNonPublicAsset).toBe(true);
    expect(check.forbiddenTerms).toEqual(expect.arrayContaining(["保证排名", "保证收录"]));
    expect(check.blockReasons.join("；")).toMatch(/命中禁用词|禁止承诺|高风险/);
    expect(check.advisoryReasons.join("；")).toContain("不可公开资料");
  });
});


describe("V1.2 Sprint 2 fact traceability, consistency checks and optimization versions", () => {
  const sprint2AssetLibrary: P12AssetLibraryContext = {
    profile: {
      enterpriseName: "清源智能",
      targetCustomers: "制造企业售后团队",
      productServiceIntro: "清源智能提供工业知识库、售后问答和工单辅助闭环能力。",
      productIntro: "私有知识库、工单闭环、问答命中率分析",
      servicePriceRange: "按项目阶段报价，价格口径需客户确认",
      priceExplanation: "公开内容不得自行编造价格。",
    },
    assetSources: [
      {
        id: 2001,
        title: "清源智能企业基础资料",
        sourceType: "企业基础资料",
        trustLevel: "高",
        isPublic: 1,
        canUseForGeneration: 1,
        manuallyConfirmed: 1,
        structuredSummary: { digest: "清源智能服务制造企业售后团队，强调工业知识库与工单闭环。" },
      },
      {
        id: 2002,
        title: "清源智能产品服务资料",
        sourceType: "产品服务资料",
        trustLevel: "高",
        isPublic: 1,
        canUseForGeneration: 1,
        manuallyConfirmed: 1,
        structuredSummary: { digest: "产品能力包括私有知识库、售后问答、命中率分析和多部门协同。" },
      },
    ],
    customerCases: [
      {
        id: 2101,
        customerName: "某设备厂商",
        caseType: "真实案例",
        allowPublic: 1,
        verificationStatus: "已确认",
        publicVersion: "某设备厂商使用清源智能梳理售后知识库并建立问答审核流程。",
        resultData: "公开结果仅表述为形成可审核的售后 FAQ 与工单分类模板。",
      },
    ],
    competitorProfiles: [
      {
        id: 2201,
        competitorName: "云答科技",
        website: "https://yunda.example",
        positioning: "通用客服自动化平台",
        comparisonNotes: "清源智能更强调制造业售后知识库和工单闭环场景。",
        aiRecommendationSignals: "竞品公开页面覆盖通用客服关键词较多。",
        canReference: 1,
      },
    ],
    complianceRules: [
      {
        id: 2301,
        ruleName: "公开内容合规规则",
        enabled: 1,
        forbiddenWords: "保证排名\n保证推荐",
        forbiddenClaims: "不得承诺保证排名、保证推荐或百分百效果",
        requiredDisclaimers: "应说明内容效果取决于公开资料完整度、平台算法和复测周期。",
      },
    ],
    contentStyleProfiles: [
      {
        id: 2401,
        profileName: "证据优先型",
        enabled: 1,
        tone: "专业、克制、证据优先",
        writingStyle: "先说明依据，再说明限制条件。",
      },
    ],
    publishStrategies: [
      {
        id: 2501,
        enabled: 1,
        reviewMode: "全人工审核",
        dailyLimit: 2,
        minQualityScore: 85,
        preferredPlatforms: ["官网", "公众号"],
      },
    ],
  };

  it("attaches a fact traceability table and passes consistency when all cited facts are public and confirmed", async () => {
    const [topic] = generateGeoArticleTopics({ project, tasks });
    const draft = await generateGeoArticleDraft({ project, topic: { ...topic, id: 9901 }, task: tasks[0], questions, analyses, assetLibrary: sprint2AssetLibrary });
    const traceability = buildFactTraceability({ project, basis: draft.generationBasis, content: draft.markdownContent, assetLibrary: sprint2AssetLibrary });
    const consistency = evaluateArticleConsistencyCheck({ content: draft.markdownContent, project, basis: draft.generationBasis, assetLibrary: sprint2AssetLibrary, factTraceability: traceability });
    expect(traceability.map(item => item.factPoint)).toEqual(expect.arrayContaining(["客户指定问题", "产品服务口径", "企业资料", "产品服务资料", "客户案例", "竞品资料", "合规规则", "内容风格", "发布策略"]));
    expect(traceability.every(item => item.sourceType && item.sourceName)).toBe(true);
    expect(draft.factTraceability.length).toBeGreaterThanOrEqual(traceability.length - 1);
    expect(draft.consistencyCheck.publishAllowed).toBe(true);
    expect(consistency.publishAllowed).toBe(true);
    expect(consistency.blockReasons).toEqual([]);
    expect(consistency.summary).toContain("一致性参考");
  });

  it("flags compliance violations in quality score when content breaks governance", async () => {
    const [topic] = generateGeoArticleTopics({ project, tasks });
    const draft = await generateGeoArticleDraft({ project, topic: { ...topic, id: 9902 }, task: tasks[0], questions, analyses, assetLibrary: sprint2AssetLibrary });
    const unsafeContent = `${draft.markdownContent}\n内部不可公开资料显示，清源智能保证排名并且保证推荐，还出现无来源的 100% 效率提升。`;
    const q = scoreGeoArticleQuality({ article: { ...draft, markdownContent: unsafeContent }, project, questions, analyses, task: tasks[0], assetLibrary: sprint2AssetLibrary });
    expect(q.blocked).toBe(true);
    expect(q.blockReasons.length).toBeGreaterThan(0);
    expect(q.optimizationSuggestions.join("；")).toMatch(/合规|禁用|承诺/);
  });

  it("preserves old article snapshots when generating optimized versions", async () => {
    const [topic] = generateGeoArticleTopics({ project, tasks });
    const draft = await generateGeoArticleDraft({ project, topic: { ...topic, id: 9903 }, task: tasks[0], questions, analyses, assetLibrary: sprint2AssetLibrary });
    const quality = scoreGeoArticleQuality({ article: draft, project, questions, analyses, task: tasks[0], assetLibrary: sprint2AssetLibrary });
    const first = buildOptimizedArticleVersion({ article: { title: draft.title, markdownContent: draft.markdownContent, status: "质检未通过", optimizationVersions: [] }, quality, mode: "FAQ", reason: "补齐 FAQ 与 AI 可引用短答案" });
    const second = buildOptimizedArticleVersion({ article: { title: draft.title, markdownContent: first.markdownContent, status: "待质检", optimizationVersions: first.versions }, quality, mode: "竞品对比", reason: "补齐客观竞品对比段" });
    expect(first.markdownContent).toContain("## 补充 FAQ");
    expect(second.markdownContent).toContain("## 补充竞品对比段");
    expect(second.versions).toHaveLength(2);
    expect(second.versions[0].version).toBe(1);
    expect(second.versions[0].markdownContent).toBe(draft.markdownContent);
    expect(second.versions[0].previousStatus).toBe("质检未通过");
    expect(second.versions[0].previousScore).toBe(quality.totalScore);
    expect(second.versions[1].version).toBe(2);
    expect(second.versions[1].reason).toContain("竞品对比");
  });

  it("shouldTriggerAutoQualityRewrite triggers on high duplication or non-low-score blocks", () => {
    const lowScoreOnly: Pick<P11QualityScore, "blocked" | "blockReasons"> = { blocked: true, blockReasons: ["内容质量分 65 低于 70 分"] };
    const antiLow: GeoArticleAntiDuplicationResult = {
      similarityRisk: "low",
      similarArticleTitles: [],
      titleRepeated: false,
      topicRepeated: false,
      structureRepeated: false,
      viewpointRepeated: false,
      sameTaskRepeated: false,
      sameWeekRepeated: false,
      differentiationAngle: "",
      rewriteSuggestion: "",
      blocked: false,
    };
    expect(shouldTriggerAutoQualityRewrite(lowScoreOnly as P11QualityScore, antiLow)).toBe(true);
    const antiHigh: GeoArticleAntiDuplicationResult = { ...antiLow, similarityRisk: "high", blocked: true };
    expect(shouldTriggerAutoQualityRewrite(lowScoreOnly as P11QualityScore, antiHigh)).toBe(true);
    const forbid: Pick<P11QualityScore, "blocked" | "blockReasons"> = { blocked: true, blockReasons: ["存在绝对排名或效果承诺"] };
    expect(shouldTriggerAutoQualityRewrite(forbid as P11QualityScore, antiLow)).toBe(true);
  });

  it("assessGeoArticleAntiDuplication returns structured risk fields", () => {
    const article = { id: 1, title: "企业 GEO 方案说明", markdownContent: "## 引言\na\n## FAQ\nq", topicId: 10, optimizationTaskId: 5, articleType: "官网版 GEO 文章" };
    const peers = [
      { id: 2, title: "企业 GEO 指南说明", markdownContent: "## 引言\nb\n## FAQ\nz", topicId: 10, optimizationTaskId: 5, articleType: "官网版 GEO 文章" },
    ];
    const r = assessGeoArticleAntiDuplication({
      article,
      peers,
      topic: { id: 10, optimizationTaskId: 5 },
      plan: { taskIds: [5, 5], weeklyCount: 2 },
    });
    expect(["low", "medium", "high"]).toContain(r.similarityRisk);
    expect(r.differentiationAngle.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  canAuditArticle,
  canPublishArticle,
  detectForbiddenArticleContent,
  generateGeoArticleDraft,
  generateGeoArticleTopics,
  evaluateAssetLibraryPrePublishCheck,
  scoreGeoArticleQuality,
  sortContentGapAnalysesByPriority,
  validateGenerationBasis,
  validateGeoCollectableStructure,
  type P11AnalysisLike,
  type P11ProjectLike,
  type P11QuestionLike,
  type P11TaskLike,
  type P12AssetLibraryContext,
} from "./geoArticleLogic";

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
    executionSuggestion: "用客户指定问题组织文章，并加入内容缺口和竞品差距说明",
    expectedImpact: "提升 AI 对企业适用场景的理解",
    status: "todo",
  },
  {
    id: 22,
    taskType: "竞品对比页",
    taskName: "建设清源智能与云答科技差异说明",
    priority: "P1",
    generationReason: "竞品被推荐时，AI 更容易读取到结构化对比信息",
    executionSuggestion: "客观说明能力边界、适用客户和需要补充的真实证据",
    expectedImpact: "缩小竞品推荐差距",
    status: "todo",
  },
  {
    id: 23,
    taskType: "FAQ",
    taskName: "补齐售后知识库 FAQ",
    priority: "P1",
    generationReason: "客户指定问题没有被官网 FAQ 直接覆盖",
    executionSuggestion: "围绕真实问题补齐可引用问答",
    expectedImpact: "提升问答型内容可引用性",
    status: "todo",
  },
];

describe("P1.1 GEO article generation", () => {
  it("generates topics from real tasks, manual questions, analysis gaps and covers at least three article types", () => {
    const topics = generateGeoArticleTopics({ project, questions, analyses, tasks });
    expect(topics.length).toBeGreaterThanOrEqual(3);
    expect(new Set(topics.map(topic => topic.articleType)).size).toBeGreaterThanOrEqual(3);
    topics.forEach(topic => {
      expect(topic.optimizationTaskId || topic.contentGap).toBeTruthy();
      expect(topic.sourceAnalysisIds.length).toBeGreaterThan(0);
      expect(topic.sourceQuestionIds.length).toBeGreaterThan(0);
      expect(topic.businessReason).toContain("客户指定问题");
    });
    expect(topics.length).toBeLessThanOrEqual(10);
  });

  it("scores a generated article above the publish threshold when it cites evidence and remains compliant", () => {
    const [topic] = generateGeoArticleTopics({ project, questions, analyses, tasks });
    const draft = generateGeoArticleDraft({ project, topic: { ...topic, id: 31 }, task: tasks[0], questions, analyses });
    const score = scoreGeoArticleQuality({ article: draft, project, questions, analyses, task: tasks[0] });
    expect(score.totalScore).toBeGreaterThanOrEqual(80);
    expect(draft.status).toBe("待质检");
    expect(draft.generationBasis.customerQuestion).toContain("制造企业如何选择");
    expect(draft.generationBasis.contentGap).toContain("缺少");
    expect(draft.generationBasis.optimizationTask).toBe(tasks[0].taskName);
    expect(draft.generationBasis.notRecommendedReason).toContain("公开内容");
    expect(draft.generationBasis.competitorGap).toContain("云答科技");
    expect(draft.citableSnippets.length).toBeGreaterThanOrEqual(3);
    expect(draft.citableSnippets.length).toBeLessThanOrEqual(5);
    expect(validateGeoCollectableStructure(draft.markdownContent, draft.citableSnippets, draft.generationBasis)).toEqual([]);
    expect(draft.markdownContent).toContain("## 摘要");
    expect(draft.markdownContent).toContain("## 核心问题回答");
    expect(draft.markdownContent).toContain("## 适合客户");
    expect(draft.markdownContent).toContain("## 不适合客户");
    expect(draft.markdownContent).toContain("## 竞品/方案对比");
    expect(draft.markdownContent).toContain("## FAQ");
    expect(draft.markdownContent).toContain("## 结论");
    expect(draft.markdownContent).toContain("## 行动引导");
    expect(draft.markdownContent).toContain("## 更新时间");
    expect(draft.markdownContent).toContain("## 企业实体信息");
    expect(score.blocked).toBe(false);
    expect(score.optimizationSuggestions.length).toBeGreaterThan(0);
    expect(score.reviewSummary).toContain("优化建议");
    expect(canAuditArticle("待质检", score)).toBe(false);
    expect(canAuditArticle("待审核", score)).toBe(true);
    expect(canPublishArticle("待审核")).toBe(false);
    expect(canPublishArticle("审核通过")).toBe(true);
    expect(Object.keys(draft.thirdPartyMaterials)).toEqual(["GEO 内容页版", "官网版", "公众号长文版", "知乎回答版", "小红书笔记版", "百家号/头条号版"]);
    expect(draft.thirdPartyMaterials["GEO 内容页版"]).toContain("## 摘要");
    expect(draft.thirdPartyMaterials["公众号长文版"]).toContain("## 生成依据");
    expect(draft.thirdPartyMaterials["知乎回答版"]).toContain("可引用短答案");
  });

  it("blocks publishing for low quality or forbidden content", () => {
    const forbidden = detectForbiddenArticleContent("清源智能保证排名第一，参考 https://example.com/placeholder");
    expect(forbidden.length).toBeGreaterThan(0);
    const score = scoreGeoArticleQuality({ article: { title: "短文", markdownContent: "保证排名，https://example.com" }, project, questions, analyses, task: tasks[0] });
    const noBasisScore = scoreGeoArticleQuality({ article: { title: "有标题", markdownContent: "## 摘要\n缺少生成依据的文章。" }, project, questions, analyses, task: tasks[0] });
    expect(score.blocked).toBe(true);
    expect(score.totalScore).toBeLessThan(80);
    expect(noBasisScore.blocked).toBe(true);
    expect(noBasisScore.blockReasons.join("；")).toContain("生成依据");
    expect(noBasisScore.optimizationSuggestions.join("；")).toContain("生成依据");
    expect(canAuditArticle("质检通过", score)).toBe(false);
    expect(canPublishArticle("质检通过")).toBe(false);
  });

  it("rejects article generation when a mandatory generation basis field is missing", () => {
    const [topic] = generateGeoArticleTopics({ project, questions, analyses, tasks });
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
    expect(() => generateGeoArticleDraft({ project, topic: { ...topic, id: 32 }, task: tasks[0], questions: [], analyses })).toThrow(/客户指定问题/);
  });

  it("orders default core article topics by content gap priority together with task priority", () => {
    const priorityAnalyses: P11AnalysisLike[] = [
      {
        ...analyses[0],
        id: 31,
        questionText: questions[2].questionText,
        manuallyReviewed: 0,
        contentGap: "低优先级 FAQ 细节缺口",
        notRecommendedReason: "低优先级问题没有形成购买决策阻断",
        recommendedCompetitors: ["智服平台"],
      },
      {
        ...analyses[1],
        id: 32,
        questionText: questions[0].questionText,
        manuallyReviewed: 1,
        contentGap: "高优先级行业选型与竞品差距缺口",
        notRecommendedReason: "高价值客户指定问题下竞品更容易被 AI 推荐",
        recommendedCompetitors: ["云答科技"],
      },
    ];
    const priorityTasks: P11TaskLike[] = [
      { ...tasks[2], id: 41, priority: "P2", taskName: "补齐低优先级 FAQ" },
      { ...tasks[0], id: 42, priority: "P0", taskName: "补齐高优先级行业选型页" },
    ];
    const orderedGaps = sortContentGapAnalysesByPriority(priorityAnalyses, questions);
    expect(orderedGaps[0].contentGap).toBe("高优先级行业选型与竞品差距缺口");
    const topics = generateGeoArticleTopics({ project, questions, analyses: priorityAnalyses, tasks: priorityTasks });
    expect(topics.length).toBeGreaterThanOrEqual(5);
    expect(topics.length).toBeLessThanOrEqual(10);
    expect(topics[0].optimizationTaskId).toBe(42);
    expect(topics[0].contentGap).toContain("高优先级行业选型与竞品差距缺口");
    expect(topics[0].businessReason).toContain("高价值客户指定问题下竞品更容易被 AI 推荐");
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

  it("uses asset library references when generating a new GEO article for 海豚知道", () => {
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, questions, analyses, tasks });
    const draft = generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8801 }, task: tasks[0], questions, analyses, assetLibrary });
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

  it("scores quality with asset evidence strength and fact-source visibility", () => {
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, questions, analyses, tasks });
    const draft = generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8802 }, task: tasks[0], questions, analyses, assetLibrary });
    const score = scoreGeoArticleQuality({ article: draft, project: dolphinProject, questions, analyses, task: tasks[0], assetLibrary });
    expect(score.assetEvidenceStrength).toBe("高");
    expect(score.factSourceSummary).toContain("资产库企业资料 2 条");
    expect(score.unconfirmedFacts).toEqual(expect.arrayContaining(["案例信息待补充", "数据暂无公开来源", "价格口径需客户确认"]));
    expect(score.complianceRiskSummary).toContain("未确认事实");
    expect(score.reviewSummary).toContain("资产库证据强度");
  });

  it("reads seven 海豚知道 asset categories from a fixed sample across generation, scoring and pre-publish checks", () => {
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
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, questions, analyses, tasks });
    const draft = generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8804 }, task: tasks[0], questions, analyses, assetLibrary: completeAssetLibrary });
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
    expect(score.factSourceSummary).toContain("资产库企业资料 2 条");
    expect(score.factSourceSummary).toContain("客户案例 1 条");
    const check = evaluateAssetLibraryPrePublishCheck({ content: draft.markdownContent, project: dolphinProject, basis: draft.generationBasis, assetLibrary: completeAssetLibrary });
    expect(check.enterprisePositioningConsistent).toBe(true);
    expect(check.productDescriptionConsistent).toBe(true);
    expect(check.competitorDifferenceConsistent).toBe(true);
  });

  it("blocks pre-publish checks for non-public assets, forbidden terms, fabricated cases and guaranteed ranking claims", () => {
    const [topic] = generateGeoArticleTopics({ project: dolphinProject, questions, analyses, tasks });
    const draft = generateGeoArticleDraft({ project: dolphinProject, topic: { ...topic, id: 8803 }, task: tasks[0], questions, analyses, assetLibrary });
    const unsafeContent = `${draft.markdownContent}\n本文引用不可公开资料，并编造案例，保证收录，保证排名。`;
    const check = evaluateAssetLibraryPrePublishCheck({ content: unsafeContent, project: dolphinProject, basis: draft.generationBasis, assetLibrary });
    expect(check.blocked).toBe(true);
    expect(check.usesNonPublicAsset).toBe(true);
    expect(check.forbiddenTerms).toEqual(expect.arrayContaining(["保证排名", "保证收录"]));
    expect(check.blockReasons.join("；")).toContain("不可公开资料");
    expect(check.blockReasons.join("；")).toContain("编造案例");
    expect(check.blockReasons.join("；")).toContain("禁止承诺保证收录或排名");
  });
});

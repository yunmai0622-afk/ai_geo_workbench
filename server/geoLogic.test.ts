import { describe, expect, it } from "vitest";
import {
  calculateGeoScore,
  generateContentTemplates,
  generateOptimizationTasks,
  generateReportMarkdown,
  getVisibilityLevel,
  questionSources,
  questionTypes,
  resolveEffectiveAnalysisResult,
  resolveEffectiveAnalysisResults,
  type AnalysisLike,
  type ProjectLike,
} from "./geoLogic";

const project: ProjectLike = {
  id: 1,
  enterpriseName: "示例科技",
  industry: "企业服务",
  website: "https://example.com",
  region: "中国",
  productIntro: "面向企业的 AI 搜索增长诊断服务",
  targetCustomers: "B2B 企业市场部和增长负责人",
  coreSellingPoints: "可诊断、可评分、可转化为内容任务",
  competitorNames: ["竞品甲", "竞品乙"],
  coreKeywords: ["GEO", "AI 可见度"],
};

const analyses: AnalysisLike[] = [
  {
    mentionsEnterprise: 1,
    recommendsEnterprise: 1,
    mentionsCompetitors: 1,
    recommendedCompetitors: ["竞品甲"],
    enterpriseWins: 1,
    hasMisconception: 0,
    contentGap: "",
    optimizationSuggestion: "补充官网首页摘要",
    recommendationReason: "回答明确推荐本企业",
    notRecommendedReason: "",
    questionText: "企业服务 GEO 工具怎么选？",
  },
  {
    mentionsEnterprise: 1,
    recommendsEnterprise: 0,
    mentionsCompetitors: 1,
    recommendedCompetitors: ["竞品乙"],
    enterpriseWins: 0,
    hasMisconception: 1,
    contentGap: "缺少客户案例证据",
    optimizationSuggestion: "补充客户案例页",
    recommendationReason: "",
    notRecommendedReason: "AI 认为公开案例不足",
    questionText: "示例科技和竞品甲有什么区别？",
  },
  {
    mentionsEnterprise: 0,
    recommendsEnterprise: 0,
    mentionsCompetitors: 0,
    recommendedCompetitors: [],
    enterpriseWins: 0,
    hasMisconception: 0,
    contentGap: "缺少 FAQ 与产品功能说明",
    optimizationSuggestion: "补充 FAQ 和产品页",
    recommendationReason: "",
    notRecommendedReason: "AI 未识别企业",
    questionText: "AI 可见度诊断服务商有哪些？",
  },
  {
    mentionsEnterprise: 1,
    recommendsEnterprise: 1,
    mentionsCompetitors: 0,
    recommendedCompetitors: [],
    enterpriseWins: 1,
    hasMisconception: 0,
    contentGap: "",
    optimizationSuggestion: "保持核心卖点一致",
    recommendationReason: "回答推荐本企业并给出理由",
    notRecommendedReason: "",
    questionText: "B2B 企业市场部如何做 AI 搜索增长？",
  },
];

const dolphinProject: ProjectLike = {
  id: 2,
  enterpriseName: "海豚知道",
  industry: "知识付费 SaaS 与企业 AI 经营系统",
  website: "https://example.com/dolphin",
  region: "中国",
  productIntro: "面向知识付费老师和教育培训机构的课程售卖、直播转化、私域经营、AI 定位、AI 诊断和 AI 经营系统。",
  targetCustomers: "知识付费老师、教育培训机构、内容创业者和企业服务客户",
  coreSellingPoints: "课程售卖、直播转化、私域经营、AI 定位、AI 诊断、AI 经营系统",
  competitorNames: ["小鹅通", "有赞教育", "荔枝微课"],
  coreKeywords: ["知识付费 SaaS", "老师卖课平台", "AI 经营系统", "AI 定位", "AI 诊断"],
};

const dolphinAnalyses: AnalysisLike[] = Array.from({ length: 10 }, (_, index) => ({
  mentionsEnterprise: index < 2 ? 1 : 0,
  recommendsEnterprise: index === 0 ? 1 : 0,
  mentionsCompetitors: index < 6 ? 1 : 0,
  recommendedCompetitors: index < 6 ? [index % 2 === 0 ? "小鹅通" : "有赞教育"] : [],
  enterpriseWins: index === 0 ? 1 : 0,
  hasMisconception: index === 9 ? 1 : 0,
  contentGap: index === 0 ? "" : ["缺少官网定位页", "缺少客户案例证据", "缺少 FAQ", "缺少竞品对比页", "缺少行业选型文章"][index % 5],
  optimizationSuggestion: "补充官网定位、FAQ、竞品对比、案例采集和行业选型内容",
  recommendationReason: index === 0 ? "回答认为海豚知道覆盖课程售卖、直播转化和 AI 诊断" : "",
  notRecommendedReason: index === 0 ? "" : "AI 更容易引用竞品公开资料，缺少海豚知道的可验证内容资产",
  questionText: [
    "知识付费 SaaS 平台哪个好？",
    "海豚知道和小鹅通有什么区别？",
    "老师卖课平台怎么选？",
    "教育培训机构适合什么 SaaS 系统？",
    "企业 AI 经营系统有哪些服务商？",
    "知识付费公司怎么搭建 AI 运营诊断系统？",
    "直播转化和私域经营用什么工具？",
    "AI 定位服务商怎么选择？",
    "有赞教育和小鹅通哪个更适合课程售卖？",
    "知识付费企业如何做 AI 诊断？",
  ][index],
}));

describe("GEO 评分与等级", () => {
  it("按指定权重计算总分并输出维度得分", () => {
    const score = calculateGeoScore(analyses);

    expect(score.aiVisibilityScore).toBe(75);
    expect(score.aiRecommendationScore).toBe(50);
    expect(score.competitorWinScore).toBe(50);
    expect(score.cognitionAccuracyScore).toBe(75);
    expect(score.contentAssetScore).toBe(50);
    expect(score.totalScore).toBe(60);
    expect(score.visibilityLevel).toBe("良好可见");
    const reviewedScore = calculateGeoScore(resolveEffectiveAnalysisResults([
      {
        ...analyses[2],
        manuallyReviewed: 1,
        manualOverrideJson: {
          mentionsEnterprise: true,
          recommendsEnterprise: true,
          mentionsCompetitors: true,
          recommendedCompetitors: ["竞品甲"],
          enterpriseWins: true,
          hasMisconception: false,
          contentGap: "人工修订后的内容缺口",
          optimizationSuggestion: "人工修订后的优化建议",
        },
      },
    ]));
    expect(reviewedScore.totalScore).toBe(85);
    expect(reviewedScore.aiRecommendationScore).toBe(100);
    expect(questionTypes).toContain("指定问题");
    expect(questionSources).toEqual(["ai_generated", "manual", "csv"]);
    expect(score.calculationDetail.weights).toEqual({
      aiVisibility: "25%",
      aiRecommendation: "25%",
      competitorWin: "20%",
      cognitionAccuracy: "15%",
      contentAsset: "15%",
    });
  });

  it("覆盖四档可见度等级边界", () => {
    expect(getVisibilityLevel(0)).toBe("弱可见");
    expect(getVisibilityLevel(39)).toBe("弱可见");
    expect(getVisibilityLevel(40)).toBe("初步可见");
    expect(getVisibilityLevel(59)).toBe("初步可见");
    expect(getVisibilityLevel(60)).toBe("良好可见");
    expect(getVisibilityLevel(79)).toBe("良好可见");
    expect(getVisibilityLevel(80)).toBe("强势推荐");
    expect(getVisibilityLevel(100)).toBe("强势推荐");
  });

  it("没有分析结果时拒绝评分，避免假数据", () => {
    expect(() => calculateGeoScore([])).toThrow("缺少 AI 分析结果");
  });
});

describe("优化任务、内容模板与报告", () => {
  it("根据真实分析结果生成七类优化任务", () => {
    const tasks = generateOptimizationTasks(project, analyses);

    expect(tasks.map(task => task.taskType)).toEqual([
      "官网首页",
      "产品页",
      "竞品对比页",
      "FAQ",
      "客户案例",
      "行业文章",
      "社媒内容",
    ]);
    expect(tasks.every(task => task.taskName && task.generationReason && task.executionSuggestion && task.expectedImpact && task.status)).toBe(true);

    const reviewedAnalysis = resolveEffectiveAnalysisResult({
      ...analyses[2],
      manuallyReviewed: true,
      manualOverrideJson: {
        mentionsEnterprise: false,
        recommendsEnterprise: false,
        mentionsCompetitors: false,
        recommendedCompetitors: [],
        enterpriseWins: false,
        hasMisconception: true,
        contentGap: "人工修订：缺少官网定位页与权威 FAQ",
        optimizationSuggestion: "人工修订：优先补官网定位页与 FAQ",
      },
    });
    const reviewedTasks = generateOptimizationTasks(project, [reviewedAnalysis]);
    expect(reviewedTasks[0].executionSuggestion).toContain("人工修订：缺少官网定位页与权威 FAQ");
  });

  it("没有分析结果时拒绝生成优化任务", () => {
    expect(() => generateOptimizationTasks(project, [])).toThrow("缺少 AI 分析结果");
  });

  it("根据优化任务生成五类内容模板并绑定任务", () => {
    const tasks = generateOptimizationTasks(project, analyses);
    const templates = generateContentTemplates(project, tasks.map((task, index) => ({ id: index + 1, ...task })));

    expect(templates.map(template => template.templateType)).toEqual([
      "官网首页模板",
      "FAQ 模板",
      "竞品对比页模板",
      "客户案例页模板",
      "行业选型文章模板",
    ]);
    expect(templates.every(template => template.optimizationTaskId && template.title.includes("模板") && template.markdownContent.startsWith("#"))).toBe(true);

    const homepageTemplate = templates.find(template => template.templateType === "官网首页模板");
    const faqTemplate = templates.find(template => template.templateType === "FAQ 模板");
    const competitorTemplate = templates.find(template => template.templateType === "竞品对比页模板");
    const caseTemplate = templates.find(template => template.templateType === "客户案例页模板");
    const industryTemplate = templates.find(template => template.templateType === "行业选型文章模板");

    ["一句话品牌定位", "适合哪些客户", "不适合哪些客户", "核心产品/服务", "核心优势", "与竞品差异", "客户案例入口", "常见问题", "行动引导"].forEach(section => {
      expect(homepageTemplate?.markdownContent).toContain(section);
    });
    expect((faqTemplate?.markdownContent.match(/## \d+\./g) ?? []).length).toBeGreaterThanOrEqual(20);
    [project.enterpriseName, project.industry, project.coreSellingPoints, project.competitorNames[0]].forEach(projectSpecificText => {
      expect(faqTemplate?.markdownContent).toContain(projectSpecificText);
    });
    ["两类企业分别适合谁", "功能/服务能力对比", "目标客户对比", "使用场景对比", "服务模式对比", "优势与不足", "选择建议", "FAQ"].forEach(section => {
      expect(competitorTemplate?.markdownContent).toContain(section);
    });
    expect(caseTemplate?.markdownContent).toContain("客户案例采集模板");
    expect(caseTemplate?.markdownContent).toContain("不能编造");
    ["客户背景", "原始问题", "解决方案", "执行过程", "结果数据", "客户反馈"].forEach(section => {
      expect(caseTemplate?.markdownContent).toContain(section);
    });
    ["行业背景", "常见误区", "判断服务商是否靠谱的标准", "主流方案对比", "适合不同企业的选择建议", "FAQ", "行动引导"].forEach(section => {
      expect(industryTemplate?.markdownContent).toContain(section);
    });
  });

  it("没有优化任务时拒绝生成内容模板", () => {
    expect(() => generateContentTemplates(project, [])).toThrow("缺少优化任务");
  });

  it("生成客户交付级老板版 Markdown 诊断报告并包含固定结构", () => {
    const score = calculateGeoScore(dolphinAnalyses);
    const report = generateReportMarkdown(dolphinProject, { totalScore: score.totalScore, visibilityLevel: score.visibilityLevel }, dolphinAnalyses, { totalQuestions: 50, aiGeneratedQuestions: 40, specifiedQuestions: 10 });

    expect(report.oneSentenceConclusion).toContain("海豚知道");
    expect(report.totalScore).toBe(25);
    expect(report.mentionRecommendationSummary).toContain("共分析 10 条 AI 回答");
    expect(report.markdownContent).toContain("当前问题库共 50 条问题");
    expect(report.markdownContent).toContain("AI 生成问题 40 条");
    expect(report.markdownContent).toContain("客户指定问题 10 条");
    const reviewedReport = generateReportMarkdown(dolphinProject, { totalScore: score.totalScore, visibilityLevel: score.visibilityLevel }, resolveEffectiveAnalysisResults([
      {
        ...dolphinAnalyses[5],
        manuallyReviewed: true,
        manualOverrideJson: {
          mentionsEnterprise: true,
          recommendsEnterprise: true,
          mentionsCompetitors: false,
          recommendedCompetitors: [],
          enterpriseWins: true,
          recommendationReason: "人工修订后确认海豚知道在该回答中被推荐",
          notRecommendedReason: "",
          hasMisconception: false,
          contentGap: "人工修订后确认缺口为行业选型文章不足",
          optimizationSuggestion: "人工修订建议优先补行业选型文章",
        },
      },
    ]));
    expect(reviewedReport.markdownContent).toContain("人工修订后确认海豚知道在该回答中被推荐");
    expect(report.markdownContent).toContain("**50 条问题**");
    expect(report.markdownContent).toContain("**10 条客户指定问题**");
    expect(report.mentionRecommendationSummary).toContain("2 条提到本企业");
    expect(report.mentionRecommendationSummary).toContain("1 条推荐本企业");
    expect(report.mentionRecommendationSummary).toContain("1 条在竞品对比中体现本企业胜出");
    expect(report.competitorAnalysis).toContain("小鹅通");
    expect(report.coreProblems).toContain("AI 更容易引用竞品公开资料");
    expect(report.contentGaps).toContain("缺少客户案例证据");
    expect(report.thirtyDayActions).toContain("P0");
    expect(report.thirtyDayActions).toContain("30 天");
    expect(report.markdownContent.length).toBeGreaterThan(2000);
    expect(report.markdownContent.length).toBeLessThan(12000);
    expect(report.markdownContent).toContain("25 分");
    expect(report.markdownContent).toContain("弱可见");
    expect(report.markdownContent).toContain("被提及 **2 次**");
    expect(report.markdownContent).toContain("被推荐 **1 次**");
    expect(report.markdownContent).toContain("胜出 **1 次**");
    expect(report.markdownContent).toContain("本报告基于 海豚知道 的真实项目信息");
    expect(report.markdownContent).toContain("内容缺口诊断");
    expect(report.markdownContent).toContain("关键内容模板摘要");
    expect(report.markdownContent).toContain("下一轮复测建议");
    [
      "## 1. 报告摘要",
      "## 2. 一句话结论",
      "## 3. GEO 总分与分项评分",
      "## 4. AI 可见度分析",
      "## 5. AI 推荐与竞品对比",
      "## 6. AI 品牌认知问题",
      "## 7. 内容缺口诊断",
      "## 8. 30 天 GEO 优化行动计划",
      "## 9. 关键内容模板摘要",
      "## 10. 下一轮复测建议",
    ].forEach(section => {
      expect(report.markdownContent).toContain(section);
    });
  });

  it("没有分析结果时拒绝生成诊断报告", () => {
    expect(() => generateReportMarkdown(project, { totalScore: 0, visibilityLevel: "弱可见" }, [])).toThrow("缺少 AI 分析结果");
  });
});

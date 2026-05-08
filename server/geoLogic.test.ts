import { describe, expect, it } from "vitest";
import {
  calculateGeoScore,
  generateContentTemplates,
  generateOptimizationTasks,
  generateReportMarkdown,
  getVisibilityLevel,
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
  },
];

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
  });

  it("没有分析结果时拒绝生成优化任务", () => {
    expect(() => generateOptimizationTasks(project, [])).toThrow("缺少 AI 分析结果");
  });

  it("根据优化任务生成五类内容模板", () => {
    const tasks = generateOptimizationTasks(project, analyses);
    const templates = generateContentTemplates(project, tasks.map((task, index) => ({ id: index + 1, ...task })));

    expect(templates.map(template => template.templateType)).toEqual([
      "官网首页模板",
      "FAQ 模板",
      "竞品对比页模板",
      "客户案例页模板",
      "行业选型文章模板",
    ]);
    expect(templates.every(template => template.title.includes("模板") && template.markdownContent.startsWith("#"))).toBe(true);
  });

  it("没有优化任务时拒绝生成内容模板", () => {
    expect(() => generateContentTemplates(project, [])).toThrow("缺少优化任务");
  });

  it("生成老板版 Markdown 诊断报告并包含要求字段", () => {
    const score = calculateGeoScore(analyses);
    const report = generateReportMarkdown(project, { totalScore: score.totalScore, visibilityLevel: score.visibilityLevel }, analyses);

    expect(report.oneSentenceConclusion).toContain("示例科技");
    expect(report.totalScore).toBe(60);
    expect(report.mentionRecommendationSummary).toContain("共分析 4 条 AI 回答");
    expect(report.competitorAnalysis).toContain("竞品甲");
    expect(report.coreProblems).toContain("AI 认为公开案例不足");
    expect(report.contentGaps).toContain("缺少客户案例证据");
    expect(report.thirtyDayActions).toContain("第 1 周");
    expect(report.markdownContent).toContain("## 一句话结论");
    expect(report.markdownContent).toContain("## GEO 总分");
    expect(report.markdownContent).toContain("## AI 是否提到和推荐我");
    expect(report.markdownContent).toContain("## 竞品情况");
    expect(report.markdownContent).toContain("## 核心问题");
    expect(report.markdownContent).toContain("## 内容缺口");
    expect(report.markdownContent).toContain("## 30 天优化动作");
  });

  it("没有分析结果时拒绝生成诊断报告", () => {
    expect(() => generateReportMarkdown(project, { totalScore: 0, visibilityLevel: "弱可见" }, [])).toThrow("缺少 AI 分析结果");
  });
});

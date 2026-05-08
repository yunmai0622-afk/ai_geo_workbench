export const questionTypes = ["品牌认知", "行业推荐", "竞品对比", "痛点解决", "价格选型", "高意向成交"] as const;
export const aiPlatforms = ["ChatGPT", "DeepSeek", "豆包", "Kimi", "通义", "文心", "Perplexity", "其他"] as const;
export const taskTypes = ["官网首页", "产品页", "竞品对比页", "FAQ", "客户案例", "行业文章", "社媒内容"] as const;
export const templateTypes = ["官网首页模板", "FAQ 模板", "竞品对比页模板", "客户案例页模板", "行业选型文章模板"] as const;

export type QuestionType = (typeof questionTypes)[number];
export type AiPlatform = (typeof aiPlatforms)[number];
export type TaskType = (typeof taskTypes)[number];
export type TemplateType = (typeof templateTypes)[number];
export type Priority = "P0" | "P1" | "P2";
export type VisibilityLevel = "弱可见" | "初步可见" | "良好可见" | "强势推荐";

export type AnalysisLike = {
  mentionsEnterprise: number;
  recommendsEnterprise: number;
  mentionsCompetitors: number;
  recommendedCompetitors: string[];
  enterpriseWins: number;
  hasMisconception: number;
  contentGap?: string | null;
  optimizationSuggestion?: string | null;
  recommendationReason?: string | null;
  notRecommendedReason?: string | null;
};

export type ProjectLike = {
  id: number;
  enterpriseName: string;
  industry: string;
  website: string;
  region: string;
  productIntro: string;
  targetCustomers: string;
  coreSellingPoints: string;
  competitorNames: string[];
  coreKeywords: string[];
};

export function getVisibilityLevel(totalScore: number): VisibilityLevel {
  if (totalScore <= 39) return "弱可见";
  if (totalScore <= 59) return "初步可见";
  if (totalScore <= 79) return "良好可见";
  return "强势推荐";
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateGeoScore(analyses: AnalysisLike[]) {
  if (analyses.length === 0) {
    throw new Error("缺少 AI 分析结果，无法计算 GEO 评分。");
  }

  const count = analyses.length;
  const mentioned = analyses.filter(item => item.mentionsEnterprise === 1).length;
  const recommended = analyses.filter(item => item.recommendsEnterprise === 1).length;
  const enterpriseWins = analyses.filter(item => item.enterpriseWins === 1).length;
  const accurate = analyses.filter(item => item.hasMisconception !== 1).length;
  const noGap = analyses.filter(item => !item.contentGap || item.contentGap.trim().length === 0).length;

  const aiVisibilityScore = clampPercent((mentioned / count) * 100);
  const aiRecommendationScore = clampPercent((recommended / count) * 100);
  const competitorWinScore = clampPercent((enterpriseWins / count) * 100);
  const cognitionAccuracyScore = clampPercent((accurate / count) * 100);
  const contentAssetScore = clampPercent((noGap / count) * 100);
  const totalScore = clampPercent(
    aiVisibilityScore * 0.25 +
      aiRecommendationScore * 0.25 +
      competitorWinScore * 0.2 +
      cognitionAccuracyScore * 0.15 +
      contentAssetScore * 0.15,
  );

  return {
    aiVisibilityScore,
    aiRecommendationScore,
    competitorWinScore,
    cognitionAccuracyScore,
    contentAssetScore,
    totalScore,
    visibilityLevel: getVisibilityLevel(totalScore),
    calculationDetail: {
      sampleCount: count,
      mentioned,
      recommended,
      enterpriseWins,
      accurate,
      noGap,
      weights: {
        aiVisibility: "25%",
        aiRecommendation: "25%",
        competitorWin: "20%",
        cognitionAccuracy: "15%",
        contentAsset: "15%",
      },
    },
  };
}

function hasGap(analyses: AnalysisLike[], keyword: string) {
  return analyses.some(item => `${item.contentGap ?? ""}${item.optimizationSuggestion ?? ""}${item.notRecommendedReason ?? ""}`.includes(keyword));
}

export function generateOptimizationTasks(project: ProjectLike, analyses: AnalysisLike[]) {
  if (analyses.length === 0) {
    throw new Error("缺少 AI 分析结果，无法生成优化任务。");
  }

  const notRecommendedCount = analyses.filter(item => item.recommendsEnterprise !== 1).length;
  const misconceptionCount = analyses.filter(item => item.hasMisconception === 1).length;
  const competitorCount = analyses.filter(item => item.mentionsCompetitors === 1 || item.recommendedCompetitors.length > 0).length;
  const commonGap = analyses.map(item => item.contentGap).filter(Boolean).slice(0, 3).join("；") || "AI 回答中缺少可被引用的企业优势、场景证据或对比信息。";

  return [
    {
      taskType: "官网首页" as TaskType,
      taskName: `强化 ${project.enterpriseName} 官网首页的 AI 可引用信息`,
      priority: notRecommendedCount > 0 ? "P0" as Priority : "P1" as Priority,
      generationReason: `共有 ${notRecommendedCount} 条分析显示本企业未被推荐，需补足首页中的定位、卖点和可信证据。`,
      executionSuggestion: `在首页首屏明确企业名称、行业定位、目标客户、核心卖点，并增加适合 AI 摘取的结构化问答段落。当前主要缺口：${commonGap}`,
      expectedImpact: "提升 AI 对企业名称、行业定位和核心卖点的识别概率。",
      status: "待处理" as const,
    },
    {
      taskType: "产品页" as TaskType,
      taskName: `补全 ${project.enterpriseName} 产品页的场景与选型信息`,
      priority: hasGap(analyses, "产品") || hasGap(analyses, "功能") ? "P0" as Priority : "P1" as Priority,
      generationReason: "AI 回答通常需要清晰的产品能力、适用场景和选型边界作为推荐依据。",
      executionSuggestion: `围绕 ${project.coreKeywords.join("、") || project.industry} 增加产品能力、客户场景、适用与不适用边界。`,
      expectedImpact: "提升痛点解决、价格选型和高意向成交类问题中的推荐质量。",
      status: "待处理" as const,
    },
    {
      taskType: "竞品对比页" as TaskType,
      taskName: `建设 ${project.enterpriseName} 与主要竞品的对比页`,
      priority: competitorCount > 0 ? "P0" as Priority : "P2" as Priority,
      generationReason: `共有 ${competitorCount} 条分析涉及竞品或竞品推荐，需要提供可验证的差异化信息。`,
      executionSuggestion: `围绕 ${project.competitorNames.join("、") || "主要竞品"} 建立客观对比维度，包括适用客户、能力边界、服务方式和差异化卖点。`,
      expectedImpact: "降低竞品在对比类问题中单方面胜出的概率。",
      status: "待处理" as const,
    },
    {
      taskType: "FAQ" as TaskType,
      taskName: `新增面向 AI 检索的 ${project.industry} FAQ`,
      priority: "P1" as Priority,
      generationReason: "FAQ 能把品牌认知、痛点解决、价格选型等问题转化为清晰的问答语料。",
      executionSuggestion: "将问题库中的高频问题整理为官网 FAQ，并用直接、可引用、无夸张承诺的回答补充证据。",
      expectedImpact: "提升 AI 回答中引用企业官方信息的概率。",
      status: "待处理" as const,
    },
    {
      taskType: "客户案例" as TaskType,
      taskName: `沉淀 ${project.targetCustomers} 的客户案例页`,
      priority: hasGap(analyses, "案例") || hasGap(analyses, "证据") ? "P0" as Priority : "P1" as Priority,
      generationReason: "AI 推荐企业时通常需要客户案例、成果证据和行业适配信息作为支撑。",
      executionSuggestion: `选择 2-3 个 ${project.targetCustomers} 相关案例，补充背景、方案、实施过程、结果指标和可公开证据。`,
      expectedImpact: "提升推荐理由的可信度和企业胜出概率。",
      status: "待处理" as const,
    },
    {
      taskType: "行业文章" as TaskType,
      taskName: `发布 ${project.industry} 行业选型文章`,
      priority: "P1" as Priority,
      generationReason: "行业推荐与价格选型问题需要中立的选型框架和供应商判断标准。",
      executionSuggestion: `围绕 ${project.industry} 的采购标准、选型清单、风险点和常见误区，形成一篇可被 AI 引用的长文。`,
      expectedImpact: "提升行业推荐类问题中的品牌出现率。",
      status: "待处理" as const,
    },
    {
      taskType: "社媒内容" as TaskType,
      taskName: `将核心缺口改写为知乎/小红书/公众号内容`,
      priority: misconceptionCount > 0 ? "P1" as Priority : "P2" as Priority,
      generationReason: `共有 ${misconceptionCount} 条分析存在错误认知，需要在公开内容渠道中纠偏。`,
      executionSuggestion: "把错误认知、竞品对比和选型问题改写为短内容选题，并指向官网中的完整解释。",
      expectedImpact: "补充站外语料，降低 AI 对企业能力的错误理解。",
      status: "待处理" as const,
    },
  ];
}

export function generateContentTemplates(project: ProjectLike, tasks: Array<{ id?: number; taskType: TaskType; taskName: string; generationReason: string; executionSuggestion: string }>) {
  if (tasks.length === 0) {
    throw new Error("缺少优化任务，无法生成内容模板。");
  }

  const taskSummary = tasks.map(task => `- ${task.taskName}：${task.executionSuggestion}`).join("\n");

  return [
    {
      taskId: tasks.find(task => task.taskType === "官网首页")?.id,
      templateType: "官网首页模板" as TemplateType,
      title: `${project.enterpriseName} 官网首页 GEO 优化模板`,
      markdownContent: `# ${project.enterpriseName} 官网首页优化模板\n\n## 首屏定位\n${project.enterpriseName} 是面向 ${project.targetCustomers} 的 ${project.industry} 企业，核心价值是 ${project.coreSellingPoints}。\n\n## AI 可引用摘要\n- 企业名称：${project.enterpriseName}\n- 行业：${project.industry}\n- 服务地区：${project.region}\n- 官网：${project.website}\n- 核心关键词：${project.coreKeywords.join("、")}\n\n## 推荐理由素材\n请补充客户成果、服务流程、产品能力和公开证据，避免空泛宣传。\n\n## 本轮任务依据\n${taskSummary}`,
    },
    {
      taskId: tasks.find(task => task.taskType === "FAQ")?.id,
      templateType: "FAQ 模板" as TemplateType,
      title: `${project.enterpriseName} FAQ 模板`,
      markdownContent: `# ${project.enterpriseName} FAQ 模板\n\n## ${project.enterpriseName} 适合哪些客户？\n适合 ${project.targetCustomers}，尤其是正在关注 ${project.coreKeywords.join("、")} 的企业。\n\n## ${project.enterpriseName} 的核心优势是什么？\n${project.coreSellingPoints}\n\n## 与竞品相比如何选择？\n建议围绕业务场景、实施成本、服务能力、案例证据和长期支持进行比较。`,
    },
    {
      taskId: tasks.find(task => task.taskType === "竞品对比页")?.id,
      templateType: "竞品对比页模板" as TemplateType,
      title: `${project.enterpriseName} 竞品对比页模板`,
      markdownContent: `# ${project.enterpriseName} 与竞品对比模板\n\n## 对比对象\n${project.competitorNames.join("、") || "请补充竞品名称"}\n\n## 适用场景对比\n从目标客户、产品能力、服务深度、实施周期和可验证案例进行客观比较。\n\n## 选择 ${project.enterpriseName} 的场景\n当客户关注 ${project.coreSellingPoints} 时，可优先评估 ${project.enterpriseName}。`,
    },
    {
      taskId: tasks.find(task => task.taskType === "客户案例")?.id,
      templateType: "客户案例页模板" as TemplateType,
      title: `${project.enterpriseName} 客户案例页模板`,
      markdownContent: `# ${project.enterpriseName} 客户案例模板\n\n## 客户背景\n请说明客户行业、规模、业务挑战和目标。\n\n## 解决方案\n说明 ${project.enterpriseName} 提供的产品或服务，以及实施路径。\n\n## 结果与证据\n补充可公开的量化结果、客户反馈或第三方证明。`,
    },
    {
      taskId: tasks.find(task => task.taskType === "行业文章")?.id,
      templateType: "行业选型文章模板" as TemplateType,
      title: `${project.industry} 行业选型文章模板`,
      markdownContent: `# ${project.industry} 选型指南\n\n## 适合阅读对象\n${project.targetCustomers}\n\n## 选型关键问题\n- 是否覆盖 ${project.coreKeywords.join("、")} 等核心场景？\n- 是否有真实案例与公开证据？\n- 与 ${project.competitorNames.join("、") || "同类方案"} 相比，差异化价值是否清晰？\n\n## 建议行动\n先明确业务目标，再基于能力、案例、服务和成本进行综合判断。`,
    },
  ];
}

export function generateReportMarkdown(project: ProjectLike, score: { totalScore: number; visibilityLevel: VisibilityLevel }, analyses: AnalysisLike[]) {
  if (analyses.length === 0) {
    throw new Error("缺少 AI 分析结果，无法生成诊断报告。");
  }

  const mentioned = analyses.filter(item => item.mentionsEnterprise === 1).length;
  const recommended = analyses.filter(item => item.recommendsEnterprise === 1).length;
  const competitorNames = Array.from(new Set(analyses.flatMap(item => item.recommendedCompetitors))).filter(Boolean);
  const coreProblems = analyses
    .map(item => item.notRecommendedReason || item.optimizationSuggestion)
    .filter(Boolean)
    .slice(0, 5)
    .join("；") || "当前分析未发现明确未推荐原因，但仍需持续补充可验证内容资产。";
  const contentGaps = analyses
    .map(item => item.contentGap)
    .filter(Boolean)
    .slice(0, 5)
    .join("；") || "当前分析未发现明确内容缺口。";
  const oneSentenceConclusion = `${project.enterpriseName} 当前 GEO 总分为 ${score.totalScore}，处于「${score.visibilityLevel}」阶段，建议优先补强 AI 可引用内容与竞品对比证据。`;
  const mentionRecommendationSummary = `共分析 ${analyses.length} 条 AI 回答，其中 ${mentioned} 条提到本企业，${recommended} 条推荐本企业。`;
  const competitorAnalysis = competitorNames.length > 0 ? `AI 回答中被推荐或提到的竞品包括：${competitorNames.join("、")}。` : "本轮分析未识别到明确被推荐竞品。";
  const thirtyDayActions = "第 1 周补齐官网首页和产品页核心信息；第 2 周发布 FAQ 与竞品对比页；第 3 周沉淀客户案例；第 4 周发布行业选型文章并复查 AI 回答变化。";
  const markdownContent = `# ${project.enterpriseName} GEO 诊断报告\n\n## 一句话结论\n${oneSentenceConclusion}\n\n## GEO 总分\n总分：${score.totalScore}\n等级：${score.visibilityLevel}\n\n## AI 是否提到和推荐我\n${mentionRecommendationSummary}\n\n## 竞品情况\n${competitorAnalysis}\n\n## 核心问题\n${coreProblems}\n\n## 内容缺口\n${contentGaps}\n\n## 30 天优化动作\n${thirtyDayActions}`;

  return {
    oneSentenceConclusion,
    totalScore: score.totalScore,
    mentionRecommendationSummary,
    competitorAnalysis,
    coreProblems,
    contentGaps,
    thirtyDayActions,
    markdownContent,
  };
}

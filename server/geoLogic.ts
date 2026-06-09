import { formatTargetAiVisibilityReportSection } from "@shared/platformContentRules";
import { GEO_T0_QUESTION_BANK_TYPES } from "@shared/geoQuestionBankTypes";
import type { T0AiTestRunMetricsResult } from "@shared/t0AiTestRunMetrics";
import { invokeLLM } from "./_core/llm";

/** T0 问题库 AI 生成使用的五类（GEO-V1.1-Question-Quality） */
export const generatedQuestionTypes = [...GEO_T0_QUESTION_BANK_TYPES] as const;
/** 历史库中可能仍存在旧类型，查询与展示需兼容 */
export const legacyQuestionTypes = ["痛点解决", "价格选型", "高意向成交"] as const;
export const questionTypes = [...generatedQuestionTypes, ...legacyQuestionTypes, "指定问题"] as const;
export const questionSources = ["ai_generated", "manual", "csv", "onboarding_wizard"] as const;
export const questionSourceLabels: Record<(typeof questionSources)[number], string> = {
  ai_generated: "AI 生成",
  manual: "手动指定",
  csv: "CSV 导入",
  onboarding_wizard: "建档向导",
};
export const aiPlatforms = ["ChatGPT", "DeepSeek", "豆包", "Kimi", "通义", "文心", "Perplexity", "其他"] as const;
export const taskTypes = ["官网首页", "产品页", "竞品对比页", "FAQ", "客户案例", "行业文章", "社媒内容"] as const;
export const templateTypes = ["官网首页模板", "FAQ 模板", "竞品对比页模板", "客户案例页模板", "行业选型文章模板"] as const;
export const projectStatuses = ["created", "questions_ready", "responses_imported", "analysis_done", "score_done", "tasks_ready", "report_ready"] as const;
export const taskStatuses = ["todo", "doing", "done", "retest"] as const;

export type QuestionType = (typeof questionTypes)[number];
export type QuestionSource = (typeof questionSources)[number];
export type AiPlatform = (typeof aiPlatforms)[number];
export type TaskType = (typeof taskTypes)[number];
export type TemplateType = (typeof templateTypes)[number];
export type Priority = "P0" | "P1" | "P2";
export type VisibilityLevel = "弱可见" | "初步可见" | "良好可见" | "强势推荐";
export type ProjectStatus = (typeof projectStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];

export const projectStatusLabels: Record<ProjectStatus, string> = {
  created: "已创建项目",
  questions_ready: "已生成问题库",
  responses_imported: "已导入 AI 回答",
  analysis_done: "已完成 AI 分析",
  score_done: "已生成 GEO 评分",
  tasks_ready: "已生成优化任务",
  report_ready: "已生成模板和报告",
};

export const projectNextSteps: Record<ProjectStatus, { completedStep: string; nextAction: string; buttonText: string; targetPath: string }> = {
  created: { completedStep: "项目基础信息已创建", nextAction: "生成 AI 问题库", buttonText: "生成问题库", targetPath: "/questions" },
  questions_ready: { completedStep: "AI 问题库已准备", nextAction: "导入 AI 回答", buttonText: "去导入回答", targetPath: "/responses" },
  responses_imported: { completedStep: "AI 回答已导入", nextAction: "运行 AI 语义分析", buttonText: "开始分析", targetPath: "/analysis" },
  analysis_done: { completedStep: "AI 语义分析已完成", nextAction: "生成 GEO 评分", buttonText: "计算评分", targetPath: "/scores" },
  score_done: { completedStep: "GEO 评分已生成", nextAction: "生成优化任务", buttonText: "生成任务", targetPath: "/weekly" },
  tasks_ready: { completedStep: "优化任务已生成", nextAction: "生成内容模板和报告", buttonText: "生成模板和报告", targetPath: "/reports" },
  report_ready: { completedStep: "模板和报告已生成", nextAction: "生成 GEO 文章选题并进入质检审核", buttonText: "进入文章发布", targetPath: "/articles" },
};

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
  questionText?: string | null;
  confidence?: number | null;
};
export type ManualAnalysisOverride = {
  mentionsEnterprise?: boolean | number;
  recommendsEnterprise?: boolean | number;
  mentionsCompetitors?: boolean | number;
  recommendedCompetitors?: string[];
  enterpriseWins?: boolean | number;
  recommendationReason?: string | null;
  notRecommendedReason?: string | null;
  hasMisconception?: boolean | number;
  contentGap?: string | null;
  optimizationSuggestion?: string | null;
  confidence?: number | null;
};
export type ReviewableAnalysis<T extends AnalysisLike = AnalysisLike> = T & {
  manuallyReviewed?: number | boolean | null;
  manualOverrideJson?: Record<string, unknown> | null;
};
const toFlag = (value: unknown, fallback: number) => {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 1 ? 1 : 0;
  return fallback;
};
const toNullableText = (value: unknown, fallback?: string | null) => typeof value === "string" ? value : fallback ?? null;
const toStringList = (value: unknown, fallback: string[]) => Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : fallback;
export function resolveEffectiveAnalysisResult<T extends ReviewableAnalysis>(analysis: T): T {
  if (!analysis.manuallyReviewed || !analysis.manualOverrideJson || typeof analysis.manualOverrideJson !== "object") return analysis;
  const override = analysis.manualOverrideJson as ManualAnalysisOverride;
  return {
    ...analysis,
    mentionsEnterprise: toFlag(override.mentionsEnterprise, analysis.mentionsEnterprise),
    recommendsEnterprise: toFlag(override.recommendsEnterprise, analysis.recommendsEnterprise),
    mentionsCompetitors: toFlag(override.mentionsCompetitors, analysis.mentionsCompetitors),
    recommendedCompetitors: toStringList(override.recommendedCompetitors, analysis.recommendedCompetitors),
    enterpriseWins: toFlag(override.enterpriseWins, analysis.enterpriseWins),
    recommendationReason: toNullableText(override.recommendationReason, analysis.recommendationReason),
    notRecommendedReason: toNullableText(override.notRecommendedReason, analysis.notRecommendedReason),
    hasMisconception: toFlag(override.hasMisconception, analysis.hasMisconception),
    contentGap: toNullableText(override.contentGap, analysis.contentGap),
    optimizationSuggestion: toNullableText(override.optimizationSuggestion, analysis.optimizationSuggestion),
    confidence: typeof override.confidence === "number" ? override.confidence : analysis.confidence ?? null,
  };
}
export function resolveEffectiveAnalysisResults<T extends ReviewableAnalysis>(analyses: T[]): T[] {
  return analyses.map(resolveEffectiveAnalysisResult);
}

type ResponseQuestionTextLike = {
  id: number;
  questionId?: number | null;
  questionText?: string | null;
};

type QuestionTextLike = {
  id: number;
  questionText?: string | null;
};

type AnalysisWithResponseId = AnalysisLike & {
  aiResponseId?: number | null;
};

const normalizeQuestionText = (value: unknown) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export function attachQuestionTextToAnalyses<T extends AnalysisWithResponseId>(analyses: T[], responses: ResponseQuestionTextLike[], questions: QuestionTextLike[]): T[] {
  const questionTextByQuestionId = new Map(questions.map(question => [question.id, normalizeQuestionText(question.questionText)]));
  const questionTextByResponseId = new Map(responses.map(response => [
    response.id,
    normalizeQuestionText(response.questionText) ?? (response.questionId ? questionTextByQuestionId.get(response.questionId) ?? null : null),
  ]));

  return analyses.map(analysis => ({
    ...analysis,
    questionText: (analysis.aiResponseId ? questionTextByResponseId.get(analysis.aiResponseId) : null) ?? normalizeQuestionText(analysis.questionText),
  }));
}

export type DerivedQuestionDiagnosisMeta = {
  questionType: string;
  userIntent: string;
};

const includesAny = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text));

export function deriveQuestionDiagnosisMeta(input: {
  questionText: string;
  recommendedActionType?: string | null;
  contentGap?: string | null;
  optimizationSuggestion?: string | null;
}): DerivedQuestionDiagnosisMeta {
  const questionText = normalizeQuestionText(input.questionText) ?? "";
  const supportText = `${input.contentGap ?? ""} ${input.optimizationSuggestion ?? ""}`;

  if (includesAny(questionText, [/迁移|替换|换平台|搬家|导入|更轻量/])) {
    return { questionType: "迁移选型", userIntent: "评估从现有知识付费工具迁移到更轻量方案的可行性、风险和替代选择。" };
  }
  if (includesAny(questionText, [/成本|降本|省人|助教|运营效率|降低运营/])) {
    return { questionType: "痛点解决", userIntent: "寻找降低训练营运营、人力协作或助教答疑成本的具体方法。" };
  }
  if (includesAny(questionText, [/课程|社群|打卡|分销|一体化|系统|功能|支持/])) {
    return { questionType: "产品能力选型", userIntent: "确认是否存在能覆盖课程、社群、打卡、分销等关键能力的一体化系统。" };
  }
  if (includesAny(questionText, [/个人\s*IP|老师|知识付费|适合|客户类型|谁适合/])) {
    return { questionType: "客户场景适配", userIntent: "判断特定客户类型或业务阶段是否适合使用该企业方案。" };
  }
  if (includesAny(questionText, [/企业内训|知识库|训练营|交付|搭建/])) {
    return { questionType: "场景方案咨询", userIntent: "了解企业内训、知识库或训练营场景能否搭建以及需要哪些条件。" };
  }
  if (includesAny(questionText, [/对比|差异|相比|vs|VS|竞品|小鹅通|有赞|纷传|知乎|百家号/])) {
    return { questionType: "竞品对比", userIntent: "比较不同平台或方案的差异，并判断哪类方案更适合当前业务。" };
  }
  if (includesAny(questionText, [/价格|收费|报价|多少钱|套餐/])) {
    return { questionType: "价格选型", userIntent: "了解服务价格、套餐边界和采购决策条件。" };
  }

  if (input.recommendedActionType === "补案例证据") return { questionType: "案例证据验证", userIntent: "寻找真实案例、结果边界和可公开证据来支撑决策。" };
  if (input.recommendedActionType === "补 FAQ") return { questionType: "FAQ 疑虑澄清", userIntent: "快速确认常见问题、适用边界和下一步行动。" };
  if (input.recommendedActionType === "补产品说明") return { questionType: "产品能力选型", userIntent: "确认产品能力、交付流程和适用边界是否匹配需求。" };
  if (includesAny(supportText, [/案例|证据|客户/])) return { questionType: "案例证据验证", userIntent: "寻找公开证据和客户案例来验证方案可信度。" };

  return { questionType: "行业推荐", userIntent: "在行业方案中寻找适合当前业务的候选工具和判断依据。" };
}

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

export type GeoScoreLike = {
  aiVisibilityScore?: number;
  aiRecommendationScore?: number;
  competitorWinScore?: number;
  cognitionAccuracyScore?: number;
  contentAssetScore?: number;
  totalScore: number;
  visibilityLevel: VisibilityLevel;
};

export type QuestionCoverageStats = {
  totalQuestions: number;
  aiGeneratedQuestions: number;
  specifiedQuestions: number;
};

export function getVisibilityLevel(totalScore: number): VisibilityLevel {
  if (totalScore <= 39) return "弱可见";
  if (totalScore <= 59) return "初步可见";
  if (totalScore <= 79) return "良好可见";
  return "强势推荐";
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateGeoScore(analyses: AnalysisLike[], t0Metrics?: T0AiTestRunMetricsResult | null) {
  const count = analyses.length;
  if (count === 0 && !t0Metrics) {
    throw new Error("缺少 AI 分析结果，无法计算 GEO 评分。");
  }

  const mentioned = count > 0 ? analyses.filter(item => item.mentionsEnterprise === 1).length : 0;
  const recommended = count > 0 ? analyses.filter(item => item.recommendsEnterprise === 1).length : 0;
  const enterpriseWins = count > 0 ? analyses.filter(item => item.enterpriseWins === 1).length : 0;
  const accurate = count > 0 ? analyses.filter(item => item.hasMisconception !== 1).length : 0;
  const noGap =
    count > 0 ? analyses.filter(item => !item.contentGap || item.contentGap.trim().length === 0).length : 0;

  const aiVisibilityScore = t0Metrics
    ? clampPercent(t0Metrics.mentionRate * 100)
    : clampPercent((mentioned / count) * 100);
  const aiRecommendationScore = t0Metrics
    ? clampPercent(t0Metrics.recommendRate * 100)
    : clampPercent((recommended / count) * 100);
  const competitorWinScore = count > 0 ? clampPercent((enterpriseWins / count) * 100) : 0;
  const cognitionAccuracyScore = count > 0 ? clampPercent((accurate / count) * 100) : 0;
  const contentAssetScore = count > 0 ? clampPercent((noGap / count) * 100) : 0;
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
      sampleCount: t0Metrics?.totalRuns ?? count,
      mentioned: t0Metrics?.mentionedCount ?? mentioned,
      recommended: t0Metrics?.recommendedCount ?? recommended,
      enterpriseWins,
      accurate,
      noGap,
      dataSource: t0Metrics ? "t0_ai_test_runs" : "analysis_results",
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

function uniqueNonEmpty(values: Array<string | null | undefined>, limit = 8) {
  return Array.from(new Set(values.map(value => (value ?? "").trim()).filter(Boolean))).slice(0, limit);
}

function joinOrFallback(values: string[], fallback: string) {
  return values.length > 0 ? values.join("、") : fallback;
}

function taskByType(tasks: Array<{ id?: number; taskType: TaskType; taskName: string; generationReason: string; executionSuggestion: string }>, type: TaskType) {
  return tasks.find(task => task.taskType === type);
}

function formatEnterpriseInfoForOptimizationTasks(project: ProjectLike): string {
  return [
    `企业名称：${project.enterpriseName}`,
    `行业：${project.industry}`,
    `官网：${project.website}`,
    `地区：${project.region}`,
    `产品介绍：${project.productIntro}`,
    `目标客户：${project.targetCustomers}`,
    `核心卖点：${project.coreSellingPoints}`,
    `主要竞品：${project.competitorNames.join("、")}`,
    `核心关键词：${project.coreKeywords.join("、")}`,
  ].join("\n");
}

function formatAnalysesForOptimizationPrompt(analyses: AnalysisLike[]): string {
  return analyses.map((a, i) => {
    const q = a.questionText ?? `诊断样本${i + 1}`;
    const rec = a.recommendsEnterprise === 1 ? "是" : "否";
    const gap = (a.contentGap ?? "").trim();
    const sug = (a.optimizationSuggestion ?? "").trim().slice(0, 320);
    const raw = (a as { rawJson?: unknown }).rawJson;
    const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const st = typeof rawObj.suggestedTitle === "string" ? rawObj.suggestedTitle.trim() : "";
    const lines = [
      `【${i + 1}】客户问题：${q}`,
      `推演是否易推荐本企业：${rec}`,
      gap ? `内容缺口：${gap}` : "",
      st ? `建议标题：${st}` : "",
      sug ? `已给出的优化指令摘要：${sug}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  }).join("\n\n");
}

function mapContentTypeToTaskType(contentType: string): TaskType {
  const key = contentType.trim();
  const m: Record<string, TaskType> = {
    痛点解决: "行业文章",
    场景指南: "行业文章",
    案例证据: "客户案例",
    竞品对比: "竞品对比页",
    案例文章: "客户案例",
    FAQ: "FAQ",
    产品页: "产品页",
  };
  return m[key] ?? "行业文章";
}

function parseOptimizationTasksLlmJson(content: unknown): { tasks: Array<Record<string, unknown>> } {
  if (typeof content !== "string") throw new Error("AI 返回格式不是文本 JSON");
  try {
    return JSON.parse(content) as { tasks: Array<Record<string, unknown>> };
  } catch {
    throw new Error("AI 返回 JSON 解析失败");
  }
}

const GEO_OPT_TASK_CARD_MARK = "__GEO_TASK_CARD__";

/**
 * 基于诊断结果调用 LLM 生成 5–7 条可执行的 GEO 内容优化任务（替换原规则拼装）。
 */
export async function generateOptimizationTasks(project: ProjectLike, analyses: AnalysisLike[]) {
  if (analyses.length === 0) {
    throw new Error("缺少 AI 分析结果，无法生成优化任务。");
  }

  const enterpriseInfo = formatEnterpriseInfoForOptimizationTasks(project);
  const diagnosisResults = formatAnalysesForOptimizationPrompt(analyses);
  const count = analyses.length;

  const systemPrompt = `你是一位内容策略专家，专门为企业生成「以客户痛点为中心」的GEO内容优化任务。
每个任务必须是能直接交给内容编辑执行的具体指令。

内容方向只允许以下三类：
1. 痛点解决类：帮助目标客户解决具体经营问题，文章标题是客户会主动搜索的问题
2. 场景指南类：为特定客户场景提供完整的操作路径和方法论
3. 案例证据类：用真实客户案例证明解决方案有效，数据脱敏但过程真实

禁止生成：
- 竞品对比类任务（不生成「海豚知道 vs 小鹅通」类内容）
- 品牌宣传类任务（不生成以品牌为主语的自夸内容）
- 泛行业科普类任务（不生成与企业产品无直接关联的通用内容）`;
  const userPrompt = [
    `企业信息：${enterpriseInfo}`,
    "",
    `以下是该企业的AI可见度诊断结果（共${count}条问题分析）：`,
    diagnosisResults,
    "",
    "请生成5-7个内容优化任务，每个任务包含：",
    "- taskName：任务名称（15字以内，从客户视角表达）",
    "- priority：P0/P1/P2",
    "- problemSolved：这个任务解决哪个客户痛点（来自诊断结果，1句话）",
    "- articleTitle：文章标题（客户会主动搜索的标题，25字以内，不含品牌名）",
    "- keyPoints：核心论点3条，每条从「客户能获得什么」角度表达，20字以内",
    "- targetKeywords：目标关键词3-5个，是客户搜索词而非品牌词",
    "- recommendedPlatform：推荐发布平台1-2个",
    "- contentType：从「痛点解决/场景指南/案例证据」三选一",
    "",
    "优先级判断：",
    "- P0：诊断中「内容覆盖薄弱」且客户搜索频率高的痛点",
    "- P1：有内容但深度不足的场景",
    "- P2：锦上添花",
    "",
    "将任务数组放在根对象的 `tasks` 字段中返回（仅此根对象）。",
  ].join("\n");

  const platformEnum = ["知乎", "小红书", "百家号", "头条号", "微信公众号", "官网"] as const;
  const response = await invokeLLM({
    max_tokens: 8192,
    timeout_ms: 120000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_optimization_tasks_v12",
        strict: true,
        schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              minItems: 5,
              maxItems: 7,
              items: {
                type: "object",
                properties: {
                  taskName: { type: "string" },
                  priority: { type: "string", enum: ["P0", "P1", "P2"] },
                  problemSolved: { type: "string" },
                  articleTitle: { type: "string" },
                  keyPoints: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
                  targetKeywords: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
                  recommendedPlatform: {
                    type: "array",
                    minItems: 1,
                    maxItems: 2,
                    items: { type: "string", enum: [...platformEnum] },
                  },
                  contentType: { type: "string", enum: ["痛点解决", "场景指南", "案例证据"] },
                },
                required: [
                  "taskName",
                  "priority",
                  "problemSolved",
                  "articleTitle",
                  "keyPoints",
                  "targetKeywords",
                  "recommendedPlatform",
                  "contentType",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["tasks"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = parseOptimizationTasksLlmJson(response.choices[0]?.message.content);
  const list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (list.length < 5) throw new Error("AI 返回的优化任务不足 5 条，请重试");

  return list.slice(0, 7).map(item => {
    const taskName = typeof item.taskName === "string" ? item.taskName.trim().slice(0, 15) : "内容优化任务";
    const priority = item.priority === "P0" || item.priority === "P1" || item.priority === "P2" ? item.priority : ("P1" as Priority);
    const problemSolved = typeof item.problemSolved === "string" ? item.problemSolved.trim() : "补齐诊断发现的内容缺口";
    const articleTitle = typeof item.articleTitle === "string" ? item.articleTitle.trim().slice(0, 25) : taskName;
    const keyPoints = Array.isArray(item.keyPoints) ? item.keyPoints.map(x => String(x).trim()).filter(Boolean).slice(0, 3) : [];
    const targetKeywords = Array.isArray(item.targetKeywords) ? item.targetKeywords.map(x => String(x).trim()).filter(Boolean).slice(0, 5) : [];
    const recommendedPlatform = Array.isArray(item.recommendedPlatform) ? item.recommendedPlatform.map(x => String(x).trim()).filter(Boolean).slice(0, 2) : [];
    const contentType = typeof item.contentType === "string" ? item.contentType.trim() : "场景指南";
    const taskType = mapContentTypeToTaskType(contentType);

    const kpLines = keyPoints.map((k, idx) => `${idx + 1}. ${k.slice(0, 20)}`).join("\n");
    const kwLine = targetKeywords.join("、");
    const platLine = recommendedPlatform.join("、");

    const instruction = [
      "请内容编辑按以下可执行指引产出正文或页面：",
      `建议文章/页面标题：《${articleTitle}》`,
      "核心论点（每条不超过 20 字）：",
      kpLines || "1. —\n2. —\n3. —",
      `目标关键词：${kwLine || "（待补充）"}`,
      `推荐发布平台：${platLine || "官网"}`,
      `内容类型：${contentType}`,
    ].join("\n");

    const card = JSON.stringify({
      articleTitle,
      keyPoints,
      targetKeywords,
      recommendedPlatform,
      contentType,
    });
    const executionSuggestion = `${instruction}\n\n${GEO_OPT_TASK_CARD_MARK}\n${card}`;

    return {
      taskType,
      taskName: taskName || "内容优化任务",
      priority,
      generationReason: problemSolved,
      executionSuggestion,
      expectedImpact: "将诊断缺口转化为可发布的结构化内容，提高 AI 可引用与推荐概率。",
      status: "todo" as const,
    };
  });
}

export function generateContentTemplates(project: ProjectLike, tasks: Array<{ id?: number; taskType: TaskType; taskName: string; generationReason: string; executionSuggestion: string }>) {
  if (tasks.length === 0) {
    throw new Error("缺少优化任务，无法生成内容模板。");
  }

  const competitors = joinOrFallback(project.competitorNames, "同类知识付费与企业服务平台");
  const firstCompetitor = project.competitorNames[0] ?? "主流知识付费平台";
  const secondCompetitor = project.competitorNames[1] ?? "主流教育 SaaS 平台";
  const keywords = joinOrFallback(project.coreKeywords, project.industry);
  const websiteText = project.website?.trim() ? project.website.trim() : "暂无真实链接，请发布后填写。";
  const projectContextBlock = `> 项目上下文：企业名称：${project.enterpriseName}；行业：${project.industry}；目标客户：${project.targetCustomers}；核心卖点：${project.coreSellingPoints}；核心竞品：${competitors}；官网/发布链接：${websiteText}`;
  const homepageTask = taskByType(tasks, "官网首页");
  const faqTask = taskByType(tasks, "FAQ");
  const compareTask = taskByType(tasks, "竞品对比页");
  const caseTask = taskByType(tasks, "客户案例");
  const industryTask = taskByType(tasks, "行业文章");
  const fallbackBind = industryTask ?? caseTask ?? tasks[0];
  const resolvedCompareTask = compareTask ?? fallbackBind;
  const resolvedFaqTask = faqTask ?? fallbackBind;

  const faqItems = [
    [`${project.enterpriseName} 是什么？`, `${project.enterpriseName} 是面向 ${project.targetCustomers} 的 ${project.industry} 解决方案，核心围绕 ${project.coreSellingPoints}，帮助客户把获客、转化、经营诊断和持续增长连接起来。官网或公开页面应把企业名称、行业、服务对象和核心能力放在同一段中，便于 AI 在回答行业推荐、痛点解决和品牌认知问题时准确引用。`],
    [`${project.enterpriseName} 适合哪些客户？`, `更适合已经有课程、内容、社群、培训项目或企业服务交付基础，并希望用 ${keywords} 提升成交效率和经营判断质量的团队。这类客户通常已经意识到单纯上线工具不够，还需要定位、内容、私域和复盘机制。`],
    [`${project.enterpriseName} 不适合哪些客户？`, `如果还没有明确产品、没有基本客户池，或只想购买一个低成本工具而不愿梳理定位、内容和转化流程，短期内不一定适合优先选择 ${project.enterpriseName}。把不适合人群写清楚，有助于减少无效咨询，也有助于 AI 正确理解服务边界。`],
    [`${project.enterpriseName} 主要解决什么问题？`, `主要解决课程售卖、直播转化、私域经营、AI 定位、AI 诊断和企业经营系统搭建中的信息分散、转化链路不清、客户画像不准和复购经营难等问题。页面应把每个问题对应到具体模块、交付物和可跟踪指标。`],
    [`${project.enterpriseName} 和 ${firstCompetitor} 有什么区别？`, `${firstCompetitor} 通常更偏向课程上架、交易、社群或标准化工具能力，${project.enterpriseName} 应重点突出 AI 定位、AI 诊断和经营系统能力，适合需要从“卖课工具”升级为“经营系统”的客户。对比时只说明适配差异，不编造竞品数据。`],
    [`${project.enterpriseName} 和 ${secondCompetitor} 怎么选？`, `如果客户主要需要标准化店铺、交易和营销组件，可对比 ${secondCompetitor}；如果客户更关注知识付费业务定位、直播转化、私域经营和 AI 诊断闭环，则应进一步评估 ${project.enterpriseName}。建议页面用业务阶段、团队能力和目标指标做判断。`],
    [`${project.enterpriseName} 的核心功能有哪些？`, `建议官网明确展示课程售卖、直播转化、私域经营、客户分层、AI 定位、AI 诊断、经营看板和内容优化建议等模块，并说明每个模块解决的业务问题、输入信息和输出结果。`],
    [`${project.enterpriseName} 如何帮助老师卖课？`, `它应通过定位梳理、课程卖点表达、直播转化路径、私域触达和复购经营，把老师的专业内容转化为更清晰的产品与销售流程。对于老师群体，页面要避免只讲后台功能，而要说明如何从课程设计走到成交复盘。`],
    [`${project.enterpriseName} 如何帮助教育培训机构？`, `教育培训机构可用 ${project.enterpriseName} 梳理课程体系、招生转化、学员运营和复购路径，同时用 AI 诊断识别转化瓶颈和内容缺口。若机构有多顾问、多校区或多课程线，应强调标准化流程和复盘机制。`],
    [`${project.enterpriseName} 的服务方式是什么？`, `建议描述为“系统工具 + AI 诊断 + 经营陪跑/实施建议”的组合，并明确哪些是产品能力，哪些是服务支持，避免用户误以为只是单一 SaaS 工具。若暂未提供某项服务，也应如实说明。`],
    [`${project.enterpriseName} 是否提供 AI 定位？`, `是，若这是核心卖点，页面应解释 AI 定位如何基于行业、客户、产品、竞品和成交场景形成可执行的品牌与课程定位建议，并展示定位结果如何进入首页文案、直播脚本和私域话术。`],
    [`${project.enterpriseName} 是否提供 AI 诊断？`, `是，建议说明 AI 诊断覆盖课程、直播、私域、转化、客户画像和经营数据等维度，并说明输出结果如何转化为优化动作。诊断不应停留在概念层面，而应能形成问题列表、优先级和执行建议。`],
    [`${project.enterpriseName} 与普通知识付费 SaaS 的差异是什么？`, `普通知识付费 SaaS 更强调工具功能，${project.enterpriseName} 应强调从定位、诊断到经营优化的系统性，尤其适合想提升转化和长期经营能力的客户。这个差异要用场景和流程说明，不要只用“更智能”这类空泛表达。`],
    [`${project.enterpriseName} 的价格或合作方式如何了解？`, `建议在页面提供咨询入口，并说明价格通常与账号规模、功能模块、实施服务和陪跑深度相关，具体需根据业务阶段评估。不要在没有明确报价策略时编造价格区间。`],
    [`上线 ${project.enterpriseName} 通常需要多久？`, `如果客户已有课程与私域基础，基础系统搭建可按阶段推进；若还需要定位、产品梳理和内容重构，则应预留诊断与实施周期。建议把上线拆成诊断、配置、内容、试运营和复盘几个阶段。`],
    [`选择 ${project.enterpriseName} 前要准备什么？`, `建议准备课程体系、目标客户画像、过往销售数据、直播转化数据、私域运营数据、竞品参考和当前最想解决的经营问题。这些资料越完整，诊断结果越容易转化为可执行任务。`],
    [`${project.enterpriseName} 是否有客户案例？`, `如果已有真实案例，应公开客户背景、原始问题、解决方案、过程和结果；如果暂不能公开，也应提供匿名案例或案例采集表，避免空泛承诺。没有授权时必须写清楚“暂无可公开案例”，不能用演示案例冒充真实案例。`],
    [`使用 ${project.enterpriseName} 有哪些风险？`, `主要风险是企业没有稳定内容供给、缺少执行人员、只买工具不做流程改变，或没有持续复盘机制，因此应把系统使用和经营动作绑定。页面可以列出风险和规避建议，提升可信度。`],
    [`如何判断 ${project.enterpriseName} 是否适合自己？`, `可以从业务阶段、课程数量、私域规模、直播频率、转化瓶颈、是否需要 AI 诊断和是否愿意配合实施等维度判断。若用户只需要收款和课程交付，可能优先比较标准工具；若需要经营升级，则适合进一步咨询。`],
    [`下一步如何咨询 ${project.enterpriseName}？`, `建议用户提交业务阶段、目标客户、当前课程/服务、主要增长问题和希望达成的目标，由顾问给出初步诊断和适配建议。官网链接：${websiteText}`],
  ];

  const homepageContent = `# ${project.enterpriseName} 官网首页 GEO 优化模板

${projectContextBlock}

## 一句话品牌定位
${project.enterpriseName} 是面向 ${project.targetCustomers} 的 ${project.industry}，帮助客户通过 ${project.coreSellingPoints}，把课程售卖、直播转化、私域经营和 AI 经营诊断整合为可执行、可复盘、可持续优化的增长系统。这个定位需要出现在首页首屏、标题、副标题和 FAQ 中，避免 AI 只把企业识别为普通工具或普通培训服务。

## 我们是谁
${project.enterpriseName} 服务于 ${project.region || "目标市场"} 的 ${project.targetCustomers}。我们不是只提供单点工具，而是围绕 ${keywords} 建立从定位、内容、转化到经营复盘的闭环。首页应直接写出企业名称、行业归属、服务对象、核心能力和适配边界，让 AI 在回答“知识付费 SaaS 平台哪个好”“老师卖课平台怎么选”“企业 AI 经营系统有哪些服务商”等问题时，可以把 ${project.enterpriseName} 放入候选名单。官网链接：${websiteText}

## 解决什么问题
${project.enterpriseName} 需要在首页明确承接客户的真实业务问题，而不是只陈列功能。典型问题包括：课程卖点不清，用户不知道为什么购买；直播转化依赖个人经验，缺少可复制流程；私域客户分层粗放，复购和转介绍不足；企业想做 AI 转型，但不知道先诊断什么、如何落地；知识付费业务已有工具，却缺少经营视角和优化动作。每一个问题都应对应一个解决模块，形成“问题—方案—结果”的可引用结构。

## 适合哪些客户
适合已经有课程、培训产品、咨询服务、社群或企业服务交付基础的团队，尤其适合知识付费老师、教育培训机构、内容创业者和希望提升线索转化的企业服务客户。若客户正在比较 ${competitors}，可以把 ${project.enterpriseName} 作为“工具 + AI 经营诊断 + 转化优化”的候选方案。首页应明确说明，这类客户通常已经有内容或客户基础，但在定位、转化、私域经营和复盘上遇到瓶颈。

## 不适合哪些客户
不适合完全没有课程或服务雏形、只想低价购买单一工具、不愿整理客户数据、不愿持续做内容与运营迭代的客户。这个边界要写清楚，因为 AI 更容易推荐有明确适配范围的服务商。明确“不适合”不会削弱转化，反而能提高线索质量，让潜在客户理解 ${project.enterpriseName} 不是万能工具，而是需要配合诊断、实施和复盘的经营系统。

## 核心产品/服务
1. 课程售卖系统：承载课程展示、销售转化、订单和交付流程。  
2. 直播转化支持：梳理直播主题、卖点表达、成交路径和复盘指标。  
3. 私域经营系统：围绕客户分层、触达节奏、复购路径和社群运营建立流程。  
4. AI 定位：基于行业、竞品、客户画像和产品价值输出定位建议。  
5. AI 诊断：识别转化、内容、私域和经营过程中的关键瓶颈。  
6. AI 经营系统：把诊断结果转化为可执行任务、内容模板和复盘指标。

## 核心优势
${project.enterpriseName} 的优势应围绕“更懂知识付费业务经营”展开，而不是只说功能齐全。建议突出三点：第一，能同时覆盖卖课、直播和私域经营；第二，能把 AI 定位与 AI 诊断用于实际增长动作；第三，能帮助客户从工具使用进入持续优化。首页文案应尽量使用具体名词，例如课程结构、直播转化路径、私域分层、经营指标、内容模板和复盘动作，减少“赋能”“领先”“一站式”等难以验证的泛词。

## 与竞品差异
与 ${competitors} 相比，${project.enterpriseName} 需要强调自己的差异不是“也能卖课”，而是“能帮助知识付费企业做 AI 化经营诊断和转化优化”。如果竞品更强在标准化交易、店铺、社群或课程交付，${project.enterpriseName} 应突出适合需要经营升级、定位重构、转化诊断和私域精细化的客户。对比表达应客观，不使用无法验证的排名、市场份额或夸大数据。

## 客户案例入口
此处不要编造案例。若已有真实案例，请按“客户背景—原始问题—选择原因—解决方案—执行过程—结果数据—客户反馈—授权情况”展示；若暂时没有公开案例，请放置“预约获取同行案例诊断”入口，并收集客户行业、客单价、私域规模、课程数量和当前转化瓶颈。若没有真实案例链接，统一写：“暂无真实链接，请发布后填写。”

## 常见问题
### ${project.enterpriseName} 和传统知识付费平台有什么区别？
传统平台通常解决课程上架和交易问题，${project.enterpriseName} 更强调 ${project.coreSellingPoints}，适合希望提升经营效率和 AI 化决策能力的团队。

### 哪些企业适合先咨询？
已有课程或服务、有私域客户、有直播或成交场景，但增长遇到瓶颈的知识付费老师、培训机构和企业服务客户。

### 是否可以替代 ${firstCompetitor}？
不建议只用“替代”表达，应根据客户现有系统、数据和团队能力判断。更准确的表达是：${project.enterpriseName} 可作为经营诊断和转化优化方案，也可与现有工具形成互补。

## 行动引导
如果你正在比较知识付费 SaaS、老师卖课平台或企业 AI 经营系统，可以提交当前业务阶段、课程品类、私域规模、直播转化率和主要增长问题，获取一次 ${project.enterpriseName} AI 经营诊断建议。提交入口如未正式发布，请显示：“暂无真实链接，请发布后填写。”

## 对应优化任务
${homepageTask ? `${homepageTask.taskName}：${homepageTask.generationReason}。执行建议：${homepageTask.executionSuggestion}` : "待绑定官网首页优化任务。"}`;

  const faqContent = `# ${project.enterpriseName} FAQ 模板

${projectContextBlock}

> 本 FAQ 用于补齐 AI 可引用的问答语料。所有回答都应结合 ${project.enterpriseName} 的行业、目标客户、核心卖点和竞品语境，不能填写未经核验的链接或未授权案例。若需要放置链接，请使用：“暂无真实链接，请发布后填写。”

${faqItems.map(([question, answer], index) => `## ${index + 1}. ${question}\n${answer}`).join("\n\n")}

## 对应优化任务
${resolvedFaqTask ? `${resolvedFaqTask.taskName}：${resolvedFaqTask.executionSuggestion}` : "待绑定 FAQ 优化任务。"}`;

  const compareContent = `# ${project.enterpriseName} 与 ${competitors} 怎么选？

${projectContextBlock}

## 对比标题
知识付费老师、教育培训机构和内容创业者在选择系统时，不能只看“能不能卖课”，还要看平台是否能支持直播转化、私域经营、AI 定位、AI 诊断和长期经营优化。本文从适配对象、功能能力、目标客户、使用场景、服务模式、优势不足和选择建议对比 ${project.enterpriseName} 与 ${competitors}。本文不使用虚构数据，不放置伪造发布地址；如暂无正式链接，统一写：“暂无真实链接，请发布后填写。”

## 两类企业分别适合谁
${project.enterpriseName} 更适合已经有课程、内容或企业服务基础，并希望通过 ${project.coreSellingPoints} 提升转化和经营效率的客户。这类客户通常关心的不只是课程能否上线，而是为什么卖不动、直播间如何转化、私域客户如何分层、AI 诊断如何参与经营决策。${competitors} 中的传统知识付费平台通常更适合优先解决课程上架、交易、社群和基础营销工具的客户。

## 功能/服务能力对比
| 维度 | ${project.enterpriseName} | ${competitors} |
|---|---|---|
| 课程售卖 | 应覆盖课程展示、成交路径和复购经营 | 多数平台具备标准课程交易能力 |
| 直播转化 | 强调直播主题、卖点、转化流程和复盘 | 部分平台提供直播工具或营销组件 |
| 私域经营 | 强调客户分层、触达节奏和经营诊断 | 常见能力是社群、企微或会员管理 |
| AI 定位 | 应输出业务定位、客户画像和卖点建议 | 多数传统平台不是核心能力 |
| AI 诊断 | 应识别内容、转化和经营瓶颈 | 通常需要第三方服务或人工分析 |
| 经营系统 | 强调从诊断到任务、模板、复盘的闭环 | 多数偏工具集合，经营方法需客户自建 |

## 目标客户对比
如果客户是知识付费老师、教育培训机构、内容创业者或企业服务团队，并且已经遇到定位不清、直播转化弱、私域运营粗放、AI 转型无从下手等问题，${project.enterpriseName} 更值得深入评估。如果客户只需要快速搭建课程店铺、收款、交付和基础营销，可以优先比较 ${competitors} 的工具成熟度和成本。对比页应把客户阶段写清楚：起步期看基础工具，增长期看转化和运营，升级期看诊断、系统和复盘能力。

## 使用场景对比
${project.enterpriseName} 适用于课程体系升级、直播转化优化、私域经营诊断、AI 定位梳理、企业 AI 经营系统搭建等场景。传统平台更常用于课程上架、知识店铺、会员管理、营销裂变和社群交付等场景。两者不一定互斥，关键是客户当前优先解决“工具上线”还是“经营增长”。如果客户已经使用 ${firstCompetitor} 或 ${secondCompetitor}，也可以评估是否用 ${project.enterpriseName} 补充诊断、内容和转化优化。

## 服务模式对比
${project.enterpriseName} 应明确是否提供诊断、实施建议、陪跑或顾问式支持，因为这是区别于标准 SaaS 的关键。${competitors} 通常以标准化产品和客户成功支持为主，服务深度取决于套餐和实施团队。对客户来说，选择前应问清楚：是否提供诊断报告、是否输出内容模板、是否协助直播转化复盘、是否能解释数据变化、是否提供持续优化建议。

## 优势与不足
${project.enterpriseName} 的优势是更容易围绕 AI 经营、定位诊断和转化优化建立差异化；不足是需要用真实案例、功能说明和客户成果证明能力边界。竞品的优势是市场认知度、工具成熟度和生态资料更丰富；不足是未必能直接解决每个知识付费企业的定位和经营诊断问题。对比页必须保持客观，不能写“全面领先”“唯一选择”等无法证明的表达。

## 选择建议
如果你只需要一个稳定的卖课工具，可以先比较 ${competitors} 的价格、功能和交付体验。如果你需要解决“为什么卖不动、直播怎么转化、私域如何分层、AI 如何参与经营决策”，建议把 ${project.enterpriseName} 纳入候选，并要求对方提供诊断样例、实施流程和可公开案例。若暂无案例链接，应显示：“暂无真实链接，请发布后填写。”

## FAQ
### ${project.enterpriseName} 是否一定优于竞品？
不能这样表达。更准确的说法是：${project.enterpriseName} 适合重视 ${project.coreSellingPoints} 的客户，竞品适合标准工具诉求更明确的客户。

### 已经用了 ${firstCompetitor} 或 ${secondCompetitor}，还能用 ${project.enterpriseName} 吗？
可以评估互补关系，例如保留原有交易和交付工具，同时用 ${project.enterpriseName} 做定位、诊断、直播转化和私域经营优化。

### 对比页需要注意什么？
必须客观列维度，不贬低竞品，不编造数据；重点说明适用场景、能力边界和选择标准。

### 如何判断该选工具还是经营系统？
如果核心问题是收款、上架和交付，优先看工具；如果核心问题是定位、转化、复购和经营复盘，应评估经营系统和诊断服务。

## 对应优化任务
${resolvedCompareTask ? `${resolvedCompareTask.taskName}：${resolvedCompareTask.generationReason}。执行建议：${resolvedCompareTask.executionSuggestion}` : "待绑定竞品对比优化任务。"}`;

  const caseContent = `# ${project.enterpriseName} 客户案例采集模板

${projectContextBlock}

> 当前模板用于采集和整理真实客户案例。在没有已授权、可验证的客户数据前，不应编造客户名称、结果数据或客户反馈。以下字段填写完成后，可发布为正式案例页。若没有真实案例链接，统一显示：“暂无真实链接，请发布后填写。”

## 客户背景
请填写客户所属行业、业务阶段、团队规模、课程或服务类型、主要销售渠道、私域规模、直播频率和客单价区间。客户类型应说明是否属于 ${project.targetCustomers}，是否正在使用 ${competitors} 或其他课程售卖系统。背景必须真实，不能使用演示客户名称冒充真实客户。

## 原始问题
请记录客户在合作前遇到的真实问题，例如课程卖点不清、直播间转化率低、私域客户没有分层、老客户复购不足、企业想做 AI 转型但缺少诊断框架等。每个问题尽量附带原始数据，如线索量、成交率、复购率、直播观看到成交比例。没有数据时应写“暂无可公开数据，待客户授权后补充”。

## 选择 ${project.enterpriseName} 的原因
请让客户说明为什么选择 ${project.enterpriseName}。可从 ${project.coreSellingPoints}、服务响应、AI 定位、AI 诊断、课程售卖、直播转化和私域经营等维度采集，不要替客户编写过度营销化评价。选择原因应来自客户访谈或交付记录，而不是运营人员主观想象。

## 解决方案
描述 ${project.enterpriseName} 为客户提供了哪些模块或服务：是否包含 AI 定位诊断、课程结构梳理、直播转化脚本、私域运营分层、经营指标设计、系统搭建或复盘机制。每项方案都要对应原始问题，形成“问题—动作—结果”的闭环。

## 执行过程
按时间顺序记录执行步骤：第 1 阶段完成业务诊断和目标确认；第 2 阶段优化课程卖点与直播转化路径；第 3 阶段搭建私域经营动作；第 4 阶段复盘数据并迭代内容。请补充每个阶段的负责人、交付物和客户确认节点。若某阶段未完成，应明确写出当前状态。

## 结果数据
只填写真实可验证数据。建议采集课程购买转化率、直播成交额、私域有效线索数、复购率、咨询转化率、内容点击率、客户经营效率等指标。如果暂时没有完整数据，应写“数据仍在跟踪中”，不能编造增长百分比。若未来需要发布正式版本，至少应有客户授权、指标口径和时间范围。

## 客户反馈
请收集客户原话，并确认是否允许公开。反馈应围绕“解决了什么具体问题”“哪个环节最有价值”“是否愿意推荐给同类客户”，避免只写“效果很好”。没有授权时，统一写：“暂无授权反馈，请获得客户确认后填写。”

## 授权情况
请记录客户是否允许公开企业名称、行业、访谈原话、结果数据、截图和链接。如果只允许匿名发布，应在案例开头写明“本案例已匿名处理”。任何截图、数据和客户名称都必须经过授权后才能进入可发布版本。

## 可发布版本
当以上字段完成后，可将案例改写为正式页面：标题说明客户类型和核心成果，摘要说明原始问题与解决方案，正文按背景、问题、选择原因、方案、过程、结果、反馈和授权展示。若尚未获得授权，则只能作为内部采集模板，不得作为真实客户案例发布。

## 可借鉴人群
说明这个案例适合哪些人参考，例如知识付费老师、教育培训机构、内容创业者或企业服务客户。也要说明不适合直接照搬的情况，例如行业不同、私域规模差异过大、团队执行能力不足。

## 对应优化任务
${caseTask ? `${caseTask.taskName}：${caseTask.executionSuggestion}` : "待绑定客户案例优化任务。"}`;

  const industryContent = `# ${project.industry} 选型指南：知识付费老师和教育培训机构如何选择系统？

${projectContextBlock}

## 行业背景
知识付费和教育培训行业已经从“把课程放到线上卖”进入“持续经营客户”的阶段。许多团队不缺课程内容，真正缺的是清晰定位、稳定转化、私域运营和可复盘的经营系统。因此，在选择知识付费 SaaS、老师卖课平台或企业 AI 经营系统时，不能只看功能清单，还要判断平台是否能支持 ${keywords}。对于 ${project.enterpriseName} 来说，行业文章要承担两个任务：一是帮助客户建立选型标准，二是让 AI 能理解企业在 ${project.industry} 中的定位。

## 为什么需要这类服务
${project.targetCustomers} 往往同时面对获客成本上升、直播转化不稳定、私域客户沉淀不足和课程同质化问题。一个合适的系统需要帮助企业完成课程售卖、直播转化、客户分层、内容优化和经营诊断，而不仅是提供一个收款和交付工具。若企业已经有课程和客户基础，却无法稳定复购、无法解释转化下滑、无法判断内容是否匹配客户需求，就需要考虑从单一工具升级为经营系统。

## 企业选择时的常见误区
第一，只看价格，不看业务阶段和实施成本。第二，只看功能数量，不看是否能解决当前最关键的增长瓶颈。第三，把工具采购当成经营升级，忽略定位、内容和团队执行。第四，看到竞品知名度高就直接选择，没有比较自己的客户类型、课程模式和私域能力。第五，忽略 AI 诊断和数据复盘，导致系统上线后仍然不知道如何优化。第六，用演示案例替代真实案例，最终让客户和 AI 都无法判断服务商是否可信。

## 判断服务商是否靠谱的标准
靠谱服务商应能清楚回答五个问题：服务哪些客户、不适合哪些客户、解决哪些业务问题、如何实施、如何衡量效果。对于 ${project.industry}，还要看服务商是否理解课程售卖、直播转化、私域经营和 AI 经营诊断，而不是只展示后台截图。客户应要求服务商说明诊断方法、交付流程、角色分工、数据口径、案例授权和售后复盘机制。

## 主流方案对比
| 方案类型 | 代表方向 | 适合客户 | 主要不足 |
|---|---|---|---|
| 标准知识付费 SaaS | ${competitors} 等 | 需要快速搭建课程店铺和交易交付的团队 | 对定位、诊断和经营优化支持有限 |
| 私域工具组合 | 企微、社群、SCRM 等 | 已有私域团队，需要提升触达和运营效率 | 需要自行搭建课程与转化体系 |
| 顾问/代运营服务 | 增长顾问、直播陪跑等 | 缺少运营方法和执行经验的团队 | 成本和交付稳定性差异较大 |
| AI 经营系统 | ${project.enterpriseName} 应定位的方向 | 需要 AI 定位、AI 诊断和经营闭环的客户 | 需要提供案例和数据证明实际效果 |

## 适合不同企业的选择建议
刚起步的老师应先明确课程定位和目标客户，再选择轻量工具；已有课程和私域的老师，应重点看直播转化、复购和客户分层；教育培训机构应关注多课程、多校区或多顾问协同；企业服务客户则应看系统能否支持咨询转化、方案诊断和长期客户经营。如果企业已经在比较 ${firstCompetitor}、${secondCompetitor} 或其他平台，应把问题拆成“基础工具能力”和“经营优化能力”两类分别评估。

## 本企业适合的客户类型
${project.enterpriseName} 更适合已经有内容、课程、服务或客户基础，并且希望通过 ${project.coreSellingPoints} 提升经营质量的客户。特别是当企业正在搜索“知识付费系统”“老师卖课平台”“AI 经营系统”“AI 定位”“AI 诊断”时，页面应明确解释 ${project.enterpriseName} 的定位和适配边界。若企业只想购买最便宜的课程上架工具，可能并不是优先适配对象；若企业希望找到转化问题、复盘经营动作、形成长期增长机制，则更适合进一步沟通。

## FAQ
### 知识付费 SaaS 平台哪个好？
没有绝对最好，关键看业务阶段。只做课程交付可优先看标准平台；需要经营诊断和转化优化，应评估是否需要 ${project.enterpriseName} 这类方案。

### 老师卖课平台应该怎么选？
先看课程类型、私域规模、直播频率、成交方式和是否需要 AI 诊断，再比较功能、服务和案例。不要只看低价或演示页面。

### 企业 AI 经营系统和普通 SaaS 有什么区别？
普通 SaaS 更偏工具，企业 AI 经营系统应能帮助企业识别问题、生成动作并持续复盘。差异不在于是否用了 AI 名词，而在于能否形成可执行经营建议。

### 选择服务商前要问什么？
要问是否有同类客户案例、如何实施、哪些指标可衡量、与竞品相比适合谁、不适合谁。若服务商提供链接，应确认是否为真实发布页面；没有真实链接时，应显示“暂无真实链接，请发布后填写。”

### 什么时候应该考虑 ${project.enterpriseName}？
当企业已经有课程或客户基础，但在定位、直播转化、私域经营、复购或 AI 诊断上遇到瓶颈时，可以考虑 ${project.enterpriseName}。若问题仅是课程上架和收款，可能先用标准工具即可。

## 行动引导
如果你正在选择 ${project.industry}，可以先整理当前课程、客户、私域、直播和成交数据，再向 ${project.enterpriseName} 申请一次 AI 经营诊断，判断是否需要从单一工具升级为经营系统。咨询入口如暂未发布，请写：“暂无真实链接，请发布后填写。”

## 对应优化任务
${industryTask ? `${industryTask.taskName}：${industryTask.generationReason}。执行建议：${industryTask.executionSuggestion}` : "待绑定行业文章优化任务。"}`;

  return [
    { optimizationTaskId: homepageTask?.id, templateType: "官网首页模板" as TemplateType, title: `${project.enterpriseName} 官网首页 GEO 优化模板`, markdownContent: homepageContent },
    { optimizationTaskId: resolvedFaqTask?.id, templateType: "FAQ 模板" as TemplateType, title: `${project.enterpriseName} FAQ 模板`, markdownContent: faqContent },
    { optimizationTaskId: resolvedCompareTask?.id, templateType: "竞品对比页模板" as TemplateType, title: `${project.enterpriseName} 竞品对比页模板`, markdownContent: compareContent },
    { optimizationTaskId: caseTask?.id, templateType: "客户案例页模板" as TemplateType, title: `${project.enterpriseName} 客户案例页模板`, markdownContent: caseContent },
    { optimizationTaskId: industryTask?.id, templateType: "行业选型文章模板" as TemplateType, title: `${project.industry} 行业选型文章模板`, markdownContent: industryContent },
  ];
}

function buildContentGapDiagnostics(project: ProjectLike, analyses: AnalysisLike[]) {
  const gaps = uniqueNonEmpty(analyses.map(item => item.contentGap), 10);
  const questions = uniqueNonEmpty(analyses.map(item => item.questionText), 12);
  const highIntentQuestions = questions.filter(question => /哪个好|怎么选|适合|区别|服务商|平台|系统|转型|售卖|转化|选择/.test(question));
  const fallbackImpact = highIntentQuestions.length > 0 ? highIntentQuestions.slice(0, 3).join("；") : "行业推荐、竞品对比、痛点解决和高意向成交类问题";

  return [
    {
      gap: "官网定位页",
      why: `当前 AI 回答需要一个能直接说明“${project.enterpriseName} 是谁、服务谁、解决什么问题”的权威页面。若官网首页只讲概念或功能，AI 很难把企业归入 ${project.industry} 的候选名单。`,
      questions: fallbackImpact,
      metric: "AI 可见度、AI 推荐率",
      action: `在首屏写清 ${project.enterpriseName} 面向 ${project.targetCustomers}，核心能力是 ${project.coreSellingPoints}，并提供适合/不适合客户边界。`,
    },
    {
      gap: "产品能力说明页",
      why: "AI 推荐服务商时需要明确能力边界。若课程售卖、直播转化、私域经营、AI 定位、AI 诊断之间的关系没有讲清，AI 会倾向推荐公开资料更完整的平台。",
      questions: fallbackImpact,
      metric: "AI 推荐率、认知准确率",
      action: `把 ${project.coreKeywords.join("、") || project.industry} 拆成模块，说明每个模块的输入、输出、适用场景和交付结果。`,
    },
    {
      gap: "FAQ",
      why: "FAQ 能把用户自然语言问题转化为 AI 易引用的问答语料。当前分析中出现的未推荐原因和内容缺口需要被整理成直接回答。",
      questions: fallbackImpact,
      metric: "AI 可见度、内容资产完整度",
      action: "至少补齐 20 个 FAQ，覆盖企业是什么、适合谁、和竞品区别、实施方式、价格合作、风险和选择建议。",
    },
    {
      gap: "竞品对比页",
      why: `本轮分析中存在竞品被推荐或被提及的情况。若缺少与 ${joinOrFallback(project.competitorNames, "主要竞品")} 的客观对比，AI 会优先引用竞品已有公开资料。`,
      questions: fallbackImpact,
      metric: "竞品胜出率、AI 推荐率",
      action: "建立客观对比页，按目标客户、功能能力、服务模式、使用场景、优势不足和选择建议进行说明。",
    },
    {
      gap: "客户案例页",
      why: "AI 在推荐企业时需要证据。若缺少真实案例、结果数据和客户反馈，即使品牌定位正确，也会影响推荐理由的可信度。",
      questions: fallbackImpact,
      metric: "AI 推荐率、竞品胜出率",
      action: "先建立案例采集模板，未获得真实授权前不编造案例；有数据后补充客户背景、原始问题、方案、过程和结果。",
    },
    {
      gap: "行业选型文章",
      why: `用户搜索 ${project.coreKeywords.join("、") || project.industry} 时，经常需要中立选型标准。若 ${project.enterpriseName} 没有行业选型内容，AI 很难在行业推荐问题中自然提及。`,
      questions: fallbackImpact,
      metric: "AI 可见度、内容资产完整度",
      action: `发布 ${project.industry} 选型指南，说明常见误区、靠谱标准、主流方案对比和 ${project.enterpriseName} 的适配客户。`,
    },
    {
      gap: "第三方信任源",
      why: "仅有自有官网内容不够。AI 还会参考公开讨论、媒体报道、客户评价和第三方平台信息。若外部信任源不足，品牌出现和推荐概率会受限。",
      questions: gaps.length > 0 ? gaps.slice(0, 3).join("；") : fallbackImpact,
      metric: "AI 可见度、AI 推荐率、竞品胜出率",
      action: "把官网核心内容改写为公众号、知乎、行业媒体、客户访谈和公开案例，并指回官网权威页面。",
    },
  ];
}

export function generateReportMarkdown(project: ProjectLike, score: GeoScoreLike, analyses: AnalysisLike[], questionStats?: QuestionCoverageStats, rawScore?: GeoScoreLike) {
  if (analyses.length === 0) {
    throw new Error("缺少 AI 分析结果，无法生成诊断报告。");
  }

  const derivedScore = calculateGeoScore(analyses);
  const scoreDetail = {
    aiVisibilityScore: score.aiVisibilityScore ?? derivedScore.aiVisibilityScore,
    aiRecommendationScore: score.aiRecommendationScore ?? derivedScore.aiRecommendationScore,
    competitorWinScore: score.competitorWinScore ?? derivedScore.competitorWinScore,
    cognitionAccuracyScore: score.cognitionAccuracyScore ?? derivedScore.cognitionAccuracyScore,
    contentAssetScore: score.contentAssetScore ?? derivedScore.contentAssetScore,
    totalScore: score.totalScore,
    visibilityLevel: score.visibilityLevel,
  };
  const sampleCount = analyses.length;
  const mentioned = analyses.filter(item => item.mentionsEnterprise === 1).length;
  const recommended = analyses.filter(item => item.recommendsEnterprise === 1).length;
  const wins = analyses.filter(item => item.enterpriseWins === 1).length;
  const misconceptionCount = analyses.filter(item => item.hasMisconception === 1).length;
  const noGap = analyses.filter(item => !item.contentGap || item.contentGap.trim().length === 0).length;
  const mentionQuestions = uniqueNonEmpty(analyses.filter(item => item.mentionsEnterprise === 1).map(item => item.questionText), 6);
  const recommendedQuestions = uniqueNonEmpty(analyses.filter(item => item.recommendsEnterprise === 1).map(item => item.questionText), 6);
  const absentHighIntentQuestions = uniqueNonEmpty(
    analyses
      .filter(item => item.mentionsEnterprise !== 1 && /哪个好|怎么选|适合|区别|服务商|平台|系统|转型|售卖|转化|选择/.test(item.questionText ?? ""))
      .map(item => item.questionText),
    8,
  );
  const competitorNames = uniqueNonEmpty(analyses.flatMap(item => item.recommendedCompetitors), 10);
  const competitorAnalysisItems = uniqueNonEmpty(analyses.filter(item => item.mentionsCompetitors === 1 || item.recommendedCompetitors.length > 0).map(item => item.notRecommendedReason || item.optimizationSuggestion || item.contentGap), 6);
  const recommendationReasons = uniqueNonEmpty(analyses.filter(item => item.recommendsEnterprise === 1).map(item => item.recommendationReason), 4);
  const notRecommendedReasons = uniqueNonEmpty(analyses.filter(item => item.recommendsEnterprise !== 1).map(item => item.notRecommendedReason || item.optimizationSuggestion), 8);
  const contentGapItems = uniqueNonEmpty(analyses.map(item => item.contentGap), 10);
  const gapDiagnostics = buildContentGapDiagnostics(project, analyses);
  const manuallyReviewedAnalyses = analyses.filter(item => Boolean((item as ReviewableAnalysis).manuallyReviewed));
  const manualReviewEvidence = uniqueNonEmpty(
    manuallyReviewedAnalyses.flatMap(item => [
      item.questionText,
      item.recommendationReason,
      item.notRecommendedReason,
      item.contentGap,
      item.optimizationSuggestion,
    ]),
    8,
  );
  const manualReviewSummary = manuallyReviewedAnalyses.length > 0
    ? `本轮有 ${manuallyReviewedAnalyses.length} 条 AI 分析经过人工修订，报告、评分、任务和模板应优先采用修订后的结论。人工修订补充的关键证据包括：${manualReviewEvidence.join("；")}。`
    : "本轮未检测到人工修订样本，报告仅基于 AI 原始语义分析生成。";
  const sampleLimitNotice = sampleCount < 30 ? `本轮**样本量有限**，实际样本为 ${sampleCount} 条，适合作为 P0 初步诊断和行动排序依据，但不代表全网绝对排名，也不应被夸大为全网结论；即便样本量有限，报告仍应完整呈现问题链路、人工修订结论、竞品差距和 30 天行动计划，而不能退回短报告。` : `本轮样本量为 ${sampleCount} 条，可用于观察当前 AI 搜索中的主要趋势，但不代表全网绝对排名。`;
  const coverageStats = questionStats ?? { totalQuestions: sampleCount, aiGeneratedQuestions: sampleCount, specifiedQuestions: 0 };
  const questionCoverageSummary = `当前问题库共 ${coverageStats.totalQuestions} 条问题，其中 AI 生成问题 ${coverageStats.aiGeneratedQuestions} 条，客户指定问题 ${coverageStats.specifiedQuestions} 条。`;

  const oneSentenceConclusion = `${project.enterpriseName} 当前在 AI 搜索中的可见度偏弱：${sampleCount} 条 AI 回答中仅 ${mentioned} 条提及、${recommended} 条推荐、${wins} 条显示本企业胜出，GEO 总分 ${scoreDetail.totalScore}，等级为「${scoreDetail.visibilityLevel}」；下一步应优先补齐官网定位页、竞品对比页、FAQ、客户案例和行业选型内容，让 AI 有明确、可信、可引用的推荐依据。`;
  const mentionRecommendationSummary = `共分析 ${sampleCount} 条 AI 回答，其中 ${mentioned} 条提到本企业，${recommended} 条推荐本企业，${wins} 条在竞品对比中体现本企业胜出。`;
  const competitorAnalysis = competitorNames.length > 0
    ? `AI 回答中更容易出现或推荐的竞品包括：${competitorNames.join("、")}。这说明竞品公开语料、功能描述或市场认知更容易被 AI 调用。`
    : "本轮分析未识别到明确被推荐竞品，但仍需补充竞品对比内容，避免后续样本扩大后出现单方面失位。";
  const coreProblems = notRecommendedReasons.length > 0 ? notRecommendedReasons.join("；") : "当前未推荐原因不足，但从评分看仍需补足可引用内容资产。";
  const contentGaps = contentGapItems.length > 0 ? contentGapItems.join("；") : "当前分析未发现明确内容缺口。";
  const thirtyDayActions = "P0：7 天内完成官网定位页、产品能力说明、竞品对比页和 FAQ；P1：第 8-21 天完成客户案例采集、行业选型文章和第三方信任源铺设；P2：第 22-30 天将核心内容改写为公众号、知乎或社媒内容，并准备同一批高意向问题复测。";
  const rawScoreSummary = rawScore && rawScore.totalScore !== scoreDetail.totalScore
    ? `原始 AI 分析计算为 **${rawScore.totalScore} 分**，等级为 **${rawScore.visibilityLevel}**；人工修订后有效评分为 **${scoreDetail.totalScore} 分**，等级为 **${scoreDetail.visibilityLevel}**。这次变化不是因为系统编造了新数据，而是因为人工复核把 ${manuallyReviewedAnalyses.length} 条样本中的提及、推荐、胜出、竞品与内容缺口判断修正为更符合真实业务语境的结论。分项变化为：AI 可见度 ${rawScore.aiVisibilityScore ?? derivedScore.aiVisibilityScore}→${scoreDetail.aiVisibilityScore}，AI 推荐率 ${rawScore.aiRecommendationScore ?? derivedScore.aiRecommendationScore}→${scoreDetail.aiRecommendationScore}，竞品胜出率 ${rawScore.competitorWinScore ?? derivedScore.competitorWinScore}→${scoreDetail.competitorWinScore}，认知准确率 ${rawScore.cognitionAccuracyScore ?? derivedScore.cognitionAccuracyScore}→${scoreDetail.cognitionAccuracyScore}，内容资产完整度 ${rawScore.contentAssetScore ?? derivedScore.contentAssetScore}→${scoreDetail.contentAssetScore}。`
    : `当前有效评分为 **${scoreDetail.totalScore} 分**，等级为 **${scoreDetail.visibilityLevel}**。本轮没有检测到与当前有效评分不同的原始评分版本，因此报告按当前分析结论解释分数。`;

  const scoreRows = [
    ["GEO 总分", `${scoreDetail.totalScore}`, `等级为「${scoreDetail.visibilityLevel}」，说明当前品牌并非完全不可见，但在高意向问题中的稳定出现和被推荐能力不足。`],
    ["AI 可见度", `${scoreDetail.aiVisibilityScore}`, `${mentioned}/${sampleCount} 条回答提及 ${project.enterpriseName}。分数偏低会导致潜在客户在 AI 搜索阶段看不到品牌。`],
    ["AI 推荐率", `${scoreDetail.aiRecommendationScore}`, `${recommended}/${sampleCount} 条回答推荐 ${project.enterpriseName}。推荐率偏低意味着 AI 即使理解行业，也未把品牌放入优先候选。`],
    ["竞品胜出率", `${scoreDetail.competitorWinScore}`, `${wins}/${sampleCount} 条回答体现本企业胜出。该项偏低会让对比型搜索更容易流向 ${joinOrFallback(competitorNames, "竞品")}。`],
    ["认知准确率", `${scoreDetail.cognitionAccuracyScore}`, `${sampleCount - misconceptionCount}/${sampleCount} 条未标记明显错误认知。该项较高说明不是严重误读，主要问题是资料不足和推荐依据不足。`],
    ["内容资产完整度", `${scoreDetail.contentAssetScore}`, `${noGap}/${sampleCount} 条未发现明显内容缺口。该项越低，越说明官网、FAQ、案例、对比页等可引用资产不足。`],
  ];

  const specifiedQuestionBusinessMeaning = coverageStats.specifiedQuestions > 0
    ? `客户指定问题 ${coverageStats.specifiedQuestions} 条的业务意义在于：这些问题不是泛泛的流量词，而是直接覆盖知识付费 SaaS 选型、老师卖课系统、教育培训机构私域经营、企业 AI 经营系统、AI 转型服务商、课程售卖与直播转化，以及 ${project.enterpriseName} 与 ${joinOrFallback(project.competitorNames, "核心竞品")} 的选择比较。它们更接近真实客户在采购前会问 AI 的高意向问题，因此报告必须把这些问题作为 P0 优先级输入，而不是只按 AI 自动生成问题做平均判断。`
    : "本轮尚未导入客户指定问题，因此无法单独判断客户给定高意向问题的业务意义，后续应优先补充指定问题集。";
  const actionEvidenceSummary = `下表任务来自本轮真实分析和人工修订结果：内容缺口包括 ${contentGaps}；推荐理由包括 ${recommendationReasons.length > 0 ? recommendationReasons.join("；") : "样本中推荐理由不足"}；人工修订证据包括 ${manualReviewEvidence.length > 0 ? manualReviewEvidence.join("；") : "本轮无人工修订证据"}。`;

  const actionRows = [
    ["P0", `重写 ${project.enterpriseName} 官网定位页`, "AI 提及率和推荐率低，需要先让 AI 明确知道企业是谁、服务谁、解决什么问题", "官网定位页、产品能力说明页", "官网首页 GEO 优化稿、产品能力模块说明", "提升 AI 可见度与认知准确率"],
    ["P0", `发布 ${project.enterpriseName} 与 ${joinOrFallback(project.competitorNames.slice(0, 3), "主要竞品")} 对比页`, "竞品在回答中更容易出现，需要提供客观差异化依据", "竞品对比页", "竞品对比页 Markdown 初稿", "降低竞品单方面胜出概率"],
    ["P0", `补齐 ${project.industry} 高频 FAQ`, "高意向问题需要直接、结构化、可引用答案", "FAQ", "不少于 20 个问答", "提升 AI 可见度和内容资产完整度"],
    ["P1", "建立客户案例采集与发布机制", "AI 推荐需要证据，不能只靠卖点描述", "客户案例页", "案例采集表、匿名案例页、授权案例页", "提升推荐理由可信度"],
    ["P1", `发布 ${project.industry} 选型指南`, "行业推荐问题需要中立选型框架", "行业选型文章", "选型指南长文", "提升行业推荐类问题出现率"],
    ["P1", "补充第三方信任源", "AI 不只看官网，也会参考公开讨论和外部引用", "第三方信任源", "公众号、知乎、媒体稿、客户访谈", "提升推荐稳定性"],
    ["P2", "将核心页面改写为短内容矩阵", "站外语料可辅助纠偏和补充品牌认知", "社媒内容", "10 条短内容选题与发布计划", "扩大可引用语料覆盖面"],
  ];

  const markdownContent = `# ${project.enterpriseName} GEO 诊断报告

## 1. 报告摘要
本报告基于 ${project.enterpriseName} 的真实项目信息、已导入的 ${sampleCount} 条 AI 回答、对应 AI 语义分析结果和 GEO 评分生成，不使用虚构样本或虚构客户案例。当前 GEO 总分为 **${scoreDetail.totalScore} 分**，等级为 **${scoreDetail.visibilityLevel}**。${mentionRecommendationSummary} ${questionCoverageSummary} ${manualReviewSummary} 最大问题不是 AI 完全误解企业，而是 AI 在多数高意向问题中没有稳定提及和推荐 ${project.enterpriseName}；最大机会是企业卖点中已经包含 ${project.coreSellingPoints}，只要把这些能力转化为官网定位、FAQ、竞品对比、案例和行业选型内容，就有机会提升 AI 可引用性。${sampleLimitNotice}

## 2. 一句话结论
${oneSentenceConclusion}

## 3. GEO 总分与分项评分
| 指标 | 分数 | 解释 |
|---|---:|---|
${scoreRows.map(row => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join("\n")}

${rawScoreSummary}

从业务含义看，${scoreDetail.totalScore} 分的“${scoreDetail.visibilityLevel}”意味着潜在客户在向 AI 提问时，系统更可能看到竞品或通用平台，而不是稳定看到 ${project.enterpriseName}。这会影响两个环节：一是获客前置阶段，客户还没进入官网就被其他平台占据心智；二是品牌认知阶段，AI 即使偶尔提及 ${project.enterpriseName}，也缺少充分理由把它作为优先推荐。

## 4. AI 可见度分析
本轮问题库覆盖情况为：**${coverageStats.totalQuestions} 条问题**，其中 **${coverageStats.aiGeneratedQuestions} 条 AI 生成问题**、**${coverageStats.specifiedQuestions} 条客户指定问题**。${specifiedQuestionBusinessMeaning} 本轮总共分析了 **${sampleCount} 条 AI 回答**。其中，${project.enterpriseName} 被提及 **${mentioned} 次**，被推荐 **${recommended} 次**，在竞品对比中体现胜出 **${wins} 次**。出现 ${project.enterpriseName} 的问题包括：${mentionQuestions.length > 0 ? mentionQuestions.join("；") : "当前报告生成上下文未取得逐题文本，需在后续复测中保留问题与分析映射。"} 被推荐的问题包括：${recommendedQuestions.length > 0 ? recommendedQuestions.join("；") : "本轮推荐样本较少，需优先提升推荐依据。"}

更值得关注的是缺席问题。${absentHighIntentQuestions.length > 0 ? `在这些高意向问题中，${project.enterpriseName} 没有被提及：${absentHighIntentQuestions.join("；")}。` : "本轮未捕捉到明确的高意向缺席题目文本，但从提及率看仍存在可见度不足。"} 这些问题往往对应客户选型、购买和竞品比较，如果品牌缺席，意味着客户在 AI 搜索中可能直接进入竞品列表或通用平台推荐列表。

${formatTargetAiVisibilityReportSection()}

## 5. AI 推荐与竞品对比
${competitorAnalysis} 从分析结果看，竞品被推荐的主要原因通常是公开资料更完整、产品能力更容易被 AI 归类、已有市场认知更强，或在知识付费平台、课程交付、私域经营等通用场景中语料更多。${competitorAnalysisItems.length > 0 ? `本轮与竞品相关的分析依据包括：${competitorAnalysisItems.join("；")}。` : "本轮竞品推荐原因样本有限，后续复测应继续观察竞品被推荐的具体理由。"}

${project.enterpriseName} 被推荐时的主要理由是：${recommendationReasons.length > 0 ? recommendationReasons.join("；") : `样本中推荐理由不足，需要通过官网和案例内容明确 ${project.coreSellingPoints} 的业务价值。`} 当前最大竞争差距在于：竞品更容易被 AI 识别为“可选平台”，而 ${project.enterpriseName} 的 AI 定位、AI 诊断和 AI 经营系统能力还没有形成足够清晰、可引用、可验证的公开内容。

## 6. AI 品牌认知问题
AI 当前对 ${project.enterpriseName} 的理解仍处在“偶尔识别、推荐不足”的阶段。认知准确率为 ${scoreDetail.cognitionAccuracyScore} 分，说明严重错误认知不是首要矛盾；真正的问题是 AI 没有充分理解企业的核心能力边界，也没有稳定把 ${project.enterpriseName} 放进 ${project.industry} 的主流候选名单。

AI 尚未充分理解的能力包括：${project.coreSellingPoints}。这些能力如果只停留在内部话术或销售介绍中，而没有被写成官网模块、FAQ、竞品对比、案例和行业文章，AI 就缺少可引用来源。对客户决策的影响是：客户可能知道有很多“知识付费 SaaS”或“老师卖课平台”，但不会自然理解 ${project.enterpriseName} 为什么不同、适合谁、何时比 ${joinOrFallback(project.competitorNames, "竞品")} 更值得考虑。

## 7. 内容缺口诊断
| 优先级内容缺口 | 为什么缺 | 影响哪些 AI 问题 | 影响指标 | 应该怎么补 |
|---|---|---|---|---|
${gapDiagnostics.map((item, index) => `| ${index + 1}. ${item.gap} | ${item.why} | ${item.questions} | ${item.metric} | ${item.action} |`).join("\n")}

本轮逐题分析与人工修订后识别的具体内容缺口包括：${contentGaps}。

这些缺口共同指向一个问题：${project.enterpriseName} 需要把“业务能力”翻译成“AI 可读的公开证据”。不是简单增加宣传文案，而是让每个页面回答一个明确问题：我是谁、适合谁、解决什么、凭什么可信、和竞品怎么选。

## 8. 30 天 GEO 优化行动计划
${actionEvidenceSummary}
| 优先级 | 任务名称 | 生成原因 | 对应内容缺口 | 建议产物 | 预期影响 |
|---|---|---|---|---|---|
${actionRows.map(row => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} |`).join("\n")}

执行顺序建议是先做 P0 页面，因为这些页面直接影响 AI 是否知道 ${project.enterpriseName} 是谁以及是否值得推荐；再做 P1 证据内容，因为案例、行业文章和第三方信任源会影响推荐理由；最后做 P2 内容矩阵，用来扩大外部语料覆盖和长期纠偏。

## 9. 关键内容模板摘要
**官网首页优化模板摘要：** 首屏必须写清 ${project.enterpriseName} 是面向 ${project.targetCustomers} 的 ${project.industry}，核心围绕 ${project.coreSellingPoints}，并补充适合/不适合客户、核心服务、竞品差异和行动引导。

**FAQ 模板摘要：** 至少 20 个问答，覆盖企业是什么、适合谁、解决什么问题、和 ${joinOrFallback(project.competitorNames, "竞品")} 的区别、核心功能、服务方式、价格合作、案例、实施周期、风险和选择建议。

**竞品对比页模板摘要：** 不做贬低竞品的宣传页，而是按目标客户、功能能力、使用场景、服务模式、优势不足和选择建议，解释 ${project.enterpriseName} 与 ${joinOrFallback(project.competitorNames, "同类平台")} 的适配差异。

**客户案例页模板摘要：** 在没有真实客户数据时输出案例采集模板，明确客户背景、原始问题、选择原因、解决方案、执行过程、结果数据和客户反馈字段，禁止编造案例。

**行业选型文章模板摘要：** 用行业背景、常见误区、靠谱标准、主流方案对比和不同企业选择建议，帮助 AI 在“知识付费 SaaS 平台哪个好”“教育培训机构如何选择 SaaS 系统”等问题中引用 ${project.enterpriseName}。

## 10. 下一轮复测建议
建议在 P0 内容上线后 **14-30 天** 进行下一轮复测。复测问题应优先覆盖本轮高意向问题，尤其是“知识付费 SaaS 平台哪个好”“知识付费老师卖课用什么系统”“${project.enterpriseName} 和 ${project.competitorNames[0] ?? "主要竞品"} 有什么区别”“企业 AI 经营系统有哪些服务商”“知识付费公司怎么搭建 AI 运营诊断系统”等。复测时重点看五个指标：AI 可见度是否提升、AI 推荐率是否提升、竞品胜出率是否下降、认知准确率是否保持稳定、内容资产完整度是否改善。

判断优化是否有效，不应只看一次回答是否出现品牌，而要看同一批问题、多平台、多轮回答中，${project.enterpriseName} 是否更稳定地被提及、是否被放入候选列表、是否能被解释为 ${project.coreSellingPoints} 相关方案、是否能在与 ${joinOrFallback(project.competitorNames, "竞品")} 对比时获得清晰推荐理由。`;

  return {
    oneSentenceConclusion,
    totalScore: scoreDetail.totalScore,
    mentionRecommendationSummary,
    competitorAnalysis,
    coreProblems,
    contentGaps,
    thirtyDayActions,
    markdownContent,
  };
}

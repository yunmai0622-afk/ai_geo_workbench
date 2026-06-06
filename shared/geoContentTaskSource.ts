import type { PublishPlatformId } from "./platformContentRules";
import { PLATFORM_CONTENT_RULES } from "./platformContentRules";
import type { WeeklyPlatformKey } from "./articlePublishPlatform";

export const GEO_OPTIMIZATION_TASK_CARD_MARK = "__GEO_TASK_CARD__";

export const GEO_CONTENT_TASK_DIAGNOSIS_SOURCE_LABEL = "最近一次 AI 实测诊断";

export const GEO_CONTENT_TASK_NO_DIAGNOSIS_MESSAGE =
  "请先完成 AI 实测诊断，系统将根据诊断结果生成内容任务。";

export { PROJECT_SCOPED_CONTENT_TASK_EMPTY_FOR_PROJECT_MESSAGE as GEO_CONTENT_TASK_EMPTY_FOR_PROJECT_MESSAGE } from "./geoProjectScopedContentTask";

export type ParsedGeoOptimizationTaskCard = {
  articleTitle: string;
  keyPoints: string[];
  targetKeywords: string[];
  recommendedPlatform: string[];
  contentType: string;
};

export type GeoOptimizationTaskInput = {
  id: number;
  taskName?: string | null;
  priority?: string | null;
  generationReason?: string | null;
  executionSuggestion?: string | null;
  expectedImpact?: string | null;
};

export type GeoDiagnosisAnalysisInput = {
  id?: number;
  contentGap?: string | null;
  notRecommendedReason?: string | null;
  questionText?: string | null;
  createdAt?: Date | string | null;
};

export type GeoDiagnosisQuestionInput = {
  id?: number;
  questionText?: string | null;
  source?: string | null;
  questionType?: string | null;
};

export type GeoContentTaskSource = {
  contentTaskId: number | null;
  taskDisplayName: string;
  taskGoal: string;
  linkedQuestion: string;
  sourceLabel: string;
  diagnosisFinding: string;
  contentGaps: string[];
  recommendFill: string;
  geoGapSummary: string;
  sceneLabel: string;
  fromOptimizationTask: boolean;
};

export type WeeklyPlatformMatrixRow = {
  platformKey: WeeklyPlatformKey;
  platformLabel: string;
  platformRole: string;
  platformGenerationGoal: string;
};

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

export function parseGeoOptimizationTaskCard(
  executionSuggestion?: string | null,
): ParsedGeoOptimizationTaskCard | null {
  if (!executionSuggestion?.includes(GEO_OPTIMIZATION_TASK_CARD_MARK)) return null;
  const parts = executionSuggestion.split(`${GEO_OPTIMIZATION_TASK_CARD_MARK}\n`);
  const jsonPart = parts[1]?.trim();
  if (!jsonPart) return null;
  try {
    const j = JSON.parse(jsonPart) as Record<string, unknown>;
    const keyPoints = Array.isArray(j.keyPoints)
      ? j.keyPoints.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim())
      : [];
    const targetKeywords = Array.isArray(j.targetKeywords)
      ? j.targetKeywords
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map(x => x.trim())
      : [];
    const recommendedPlatform = Array.isArray(j.recommendedPlatform)
      ? j.recommendedPlatform
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map(x => x.trim())
      : [];
    return {
      articleTitle: typeof j.articleTitle === "string" ? j.articleTitle.trim() : "",
      keyPoints,
      targetKeywords,
      recommendedPlatform,
      contentType: typeof j.contentType === "string" ? j.contentType.trim() : "",
    };
  } catch {
    return null;
  }
}

function nonEmpty(value?: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function priorityRank(priority?: string | null): number {
  if (!priority) return 9;
  return PRIORITY_RANK[priority] ?? 9;
}

function pickLinkedQuestion(
  tasks: GeoOptimizationTaskInput[],
  analyses: GeoDiagnosisAnalysisInput[],
  questions: GeoDiagnosisQuestionInput[],
  preferred?: string | null,
): string {
  const preferredTrim = preferred?.trim();
  if (preferredTrim) return preferredTrim;
  const fromQuestion = questions
    .map(q => nonEmpty(q.questionText))
    .find(Boolean);
  if (fromQuestion) return fromQuestion;
  const fromAnalysis = analyses.map(a => nonEmpty(a.questionText)).find(Boolean);
  if (fromAnalysis) return fromAnalysis;
  const fromTask = tasks.map(t => nonEmpty(t.taskName)).find(Boolean);
  return fromTask ?? "";
}

function sceneLabelFromTask(task: GeoOptimizationTaskInput, card: ParsedGeoOptimizationTaskCard | null): string {
  if (card?.articleTitle) return card.articleTitle;
  const name = nonEmpty(task.taskName);
  if (name && !/^覆盖目标/.test(name)) return name;
  const reason = nonEmpty(task.generationReason);
  if (reason && reason.length <= 40) return reason;
  return "诊断缺口场景";
}

export function buildGeoContentTaskDisplayName(sceneLabel: string): string {
  const scene = sceneLabel.trim() || "相关";
  return `补齐「${scene}」场景内容资产`;
}

export function buildGeoContentTaskGoal(linkedQuestion: string): string {
  const q = linkedQuestion.trim();
  if (!q) {
    return "围绕 AI 诊断发现的内容缺口，生成可被 AI 搜索识别、引用和推荐的平台内容。";
  }
  return `围绕「${q}」生成可被 AI 搜索识别、引用和推荐的平台内容。`;
}

function collectContentGaps(analyses: GeoDiagnosisAnalysisInput[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of analyses) {
    const gap = nonEmpty(row.contentGap);
    if (!gap || seen.has(gap)) continue;
    seen.add(gap);
    out.push(gap);
    if (out.length >= 6) break;
  }
  return out;
}

function buildDiagnosisFinding(analyses: GeoDiagnosisAnalysisInput[], taskReason?: string | null): string {
  const parts: string[] = [];
  for (const row of analyses) {
    const reason = nonEmpty(row.notRecommendedReason);
    if (reason && !parts.includes(reason)) parts.push(reason);
    if (parts.length >= 2) break;
  }
  const taskPart = nonEmpty(taskReason);
  if (parts.length === 0 && taskPart) return taskPart;
  if (taskPart && !parts.includes(taskPart)) parts.push(taskPart);
  return parts.join("；") || "诊断已完成，请结合下方内容缺口补齐平台化内容资产。";
}

export function hasGeoDiagnosisSourceData(
  tasks: GeoOptimizationTaskInput[],
  analyses: GeoDiagnosisAnalysisInput[],
): boolean {
  return tasks.length > 0 || analyses.length > 0;
}

function scoreTask(
  task: GeoOptimizationTaskInput,
  card: ParsedGeoOptimizationTaskCard | null,
  preferredQuestion?: string | null,
): number {
  let score = 100 - priorityRank(task.priority) * 10;
  const preferred = preferredQuestion?.trim();
  if (preferred) {
    const hay = [card?.articleTitle, task.taskName, task.generationReason].filter(Boolean).join(" ");
    if (hay.includes(preferred)) score -= 50;
  }
  if (card?.articleTitle) score -= 5;
  return score;
}

export function pickGeoContentTask(
  tasks: GeoOptimizationTaskInput[],
  options?: { selectedTaskId?: number | null; preferredTargetQuestion?: string | null },
): GeoOptimizationTaskInput | null {
  if (tasks.length === 0) return null;
  const selectedId = options?.selectedTaskId;
  if (selectedId != null) {
    const hit = tasks.find(t => t.id === selectedId);
    if (hit) return hit;
  }
  const ranked = [...tasks].sort((a, b) => {
    const cardA = parseGeoOptimizationTaskCard(a.executionSuggestion);
    const cardB = parseGeoOptimizationTaskCard(b.executionSuggestion);
    return (
      scoreTask(a, cardA, options?.preferredTargetQuestion) -
      scoreTask(b, cardB, options?.preferredTargetQuestion)
    );
  });
  return ranked[0] ?? null;
}

export function resolveGeoContentTaskSource(input: {
  tasks: GeoOptimizationTaskInput[];
  analyses: GeoDiagnosisAnalysisInput[];
  questions: GeoDiagnosisQuestionInput[];
  selectedTaskId?: number | null;
  preferredTargetQuestion?: string | null;
}): GeoContentTaskSource | null {
  const { tasks, analyses, questions } = input;
  if (!hasGeoDiagnosisSourceData(tasks, analyses)) return null;

  const activeTask = pickGeoContentTask(tasks, {
    selectedTaskId: input.selectedTaskId,
    preferredTargetQuestion: input.preferredTargetQuestion,
  });
  const card = activeTask ? parseGeoOptimizationTaskCard(activeTask.executionSuggestion) : null;
  const linkedQuestion = pickLinkedQuestion(tasks, analyses, questions, input.preferredTargetQuestion);
  const sceneLabel = activeTask ? sceneLabelFromTask(activeTask, card) : linkedQuestion || "诊断缺口场景";
  const contentGaps = collectContentGaps(analyses);
  const diagnosisFinding = buildDiagnosisFinding(analyses, activeTask?.generationReason);
  const geoGapSummary = contentGaps.join("；") || nonEmpty(activeTask?.generationReason) || diagnosisFinding;
  const recommendFill =
    nonEmpty(activeTask?.expectedImpact) ??
    (sceneLabel ? `围绕「${sceneLabel}」生成平台化内容资产。` : "根据 AI 诊断缺口生成平台化内容资产。");

  return {
    contentTaskId: activeTask?.id ?? null,
    taskDisplayName: buildGeoContentTaskDisplayName(sceneLabel),
    taskGoal: buildGeoContentTaskGoal(linkedQuestion),
    linkedQuestion,
    sourceLabel: GEO_CONTENT_TASK_DIAGNOSIS_SOURCE_LABEL,
    diagnosisFinding,
    contentGaps,
    recommendFill,
    geoGapSummary,
    sceneLabel,
    fromOptimizationTask: Boolean(activeTask),
  };
}

const WEEKLY_PLATFORM_CONTENT_ROLES: Record<WeeklyPlatformKey, string> = {
  xiaohongshu: "场景种草笔记",
  zhihu: "问题回答长文",
  baijiahao: "百度搜索型文章",
  toutiao: "观点资讯稿",
  sohu: "行业品牌稿",
  netease: "资讯观点稿",
  wechat: "深度长文",
  other: "补充渠道内容",
};

export function getWeeklyPlatformContentRole(platformKey: WeeklyPlatformKey): string {
  return WEEKLY_PLATFORM_CONTENT_ROLES[platformKey] ?? "平台化内容";
}

export function buildWeeklyPlatformGenerationGoal(
  platformKey: WeeklyPlatformKey,
  linkedQuestion: string,
  sceneLabel: string,
): string {
  const q = linkedQuestion.trim() || "目标搜索问题";
  const scene = sceneLabel.trim() || "相关场景";
  switch (platformKey) {
    case "xiaohongshu":
      return `用痛点和场景解释 AI 工具如何提升「${scene}」相关的转化与识别，回应「${q}」。`;
    case "zhihu":
      return `用结构化问答覆盖「${q}」类搜索问题，并给出可执行建议。`;
    case "sohu":
      return `以行业稿结构沉淀「${scene}」相关的品牌背书与搜索友好表述。`;
    case "baijiahao":
      return `覆盖百度搜索与 AI 摘要可引用的「${q}」相关内容。`;
    case "toutiao":
      return `用观点与高信息密度内容覆盖「${q}」相关的推荐与搜索场景。`;
    case "netease":
      return `输出趋势观察与观点，建立「${scene}」领域的专业可信形象。`;
    case "wechat":
      return `沉淀长文与 FAQ，服务私域复用并回应「${q}」。`;
    case "other":
      return `按诊断建议覆盖补充渠道，回应「${q}」。`;
    default:
      return `围绕「${q}」生成适配本平台规则的内容。`;
  }
}

export function buildWeeklyPlatformMatrixRows(
  platformKeys: WeeklyPlatformKey[],
  source: Pick<GeoContentTaskSource, "linkedQuestion" | "sceneLabel">,
  labelByKey: Record<WeeklyPlatformKey, string>,
): WeeklyPlatformMatrixRow[] {
  return platformKeys.map(platformKey => ({
    platformKey,
    platformLabel: labelByKey[platformKey] ?? platformKey,
    platformRole: getWeeklyPlatformContentRole(platformKey),
    platformGenerationGoal: buildWeeklyPlatformGenerationGoal(
      platformKey,
      source.linkedQuestion,
      source.sceneLabel,
    ),
  }));
}

export function formatPlatformRuleSummaryForGeneration(platformId: PublishPlatformId): string {
  const rule = PLATFORM_CONTENT_RULES[platformId];
  return rule.summary;
}

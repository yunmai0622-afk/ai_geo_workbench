import type { QuestionContentStatus } from "./questionBankIntentMap";
import type { AiTestRunSnapshot } from "./questionSearchPoolEnrichment";
import {
  resolveSearchPoolTypeLabel,
  resolveSourceTypeLabel,
  type SearchPoolQuestionRow,
} from "./questionSearchPool";

export const QUESTION_OPPORTUNITY_LABELS = [
  "高价值",
  "竞品占位",
  "已覆盖",
  "待优化",
] as const;

export type QuestionOpportunityLabel = (typeof QUESTION_OPPORTUNITY_LABELS)[number];

export const COMPETITOR_OCCUPANCY_THRESHOLD = 0.5;

export type QuestionOpportunityOverview = {
  totalQuestions: number;
  coveredContentQuestions: number;
  competitorOccupiedQuestions: number;
  monthlyFocusQuestions: number;
};

export type QuestionOpportunityGroupStats = {
  total: number;
  competitorOccupiedCount: number;
  coveredCount: number;
};

export type QuestionOpportunityNextActionKind =
  | "create_content_task"
  | "open_weekly_task"
  | "add_to_diagnosis"
  | "monitor_retest";

export type QuestionOpportunityMapQuestionInput = {
  id: number;
  questionText: string;
  enabled: number | boolean | null;
  searchPoolType?: string | null;
  diagnosisGap?: string | null;
  contentStatus: QuestionContentStatus;
  aiPerformanceLabel?: string | null;
  hasContentTask: boolean;
  competitorOccupied: boolean;
  contentPublished: boolean;
  hasContentPending: boolean;
  monthlyFocus: boolean;
  opportunityLabel: QuestionOpportunityLabel | null;
  priorityLevel?: string | null;
  requiredSourceTypes?: string[] | null;
  lastTestResult?: string | null;
};

export type QuestionOpportunityMapItem = {
  questionId: number;
  questionText: string;
  typeLabel: string;
  opportunityLabel: QuestionOpportunityLabel | "待实测";
  reason: string;
  evidenceLine: string;
  sourceLine: string;
  nextActionLabel: string;
  nextActionKind: QuestionOpportunityNextActionKind;
  score: number;
};

export type QuestionOpportunityMapLane = {
  id: "compete" | "uncovered" | "publish" | "monitor";
  title: string;
  description: string;
  count: number;
};

export type QuestionOpportunityMapView = {
  headline: string;
  summary: string;
  proofLine: string;
  primaryActionLabel: string;
  primaryActionReason: string;
  topItems: QuestionOpportunityMapItem[];
  lanes: QuestionOpportunityMapLane[];
  emptyHint: string | null;
};

export function computeQuestionCompetitorRates(
  runs: ReadonlyArray<Pick<AiTestRunSnapshot, "questionId" | "competitorMentioned">>,
): Map<number, number> {
  const buckets = new Map<number, { total: number; competitor: number }>();
  for (const run of runs) {
    const bucket = buckets.get(run.questionId) ?? { total: 0, competitor: 0 };
    bucket.total += 1;
    if (run.competitorMentioned) bucket.competitor += 1;
    buckets.set(run.questionId, bucket);
  }
  const rates = new Map<number, number>();
  for (const [questionId, stats] of buckets) {
    rates.set(questionId, stats.total > 0 ? stats.competitor / stats.total : 0);
  }
  return rates;
}

export function isCompetitorOccupiedQuestion(rate: number | undefined): boolean {
  return (rate ?? 0) > COMPETITOR_OCCUPANCY_THRESHOLD;
}

export function isQuestionContentPublished(contentStatus: QuestionContentStatus): boolean {
  return contentStatus === "已发布";
}

export function isQuestionContentPendingOptimization(contentStatus: QuestionContentStatus): boolean {
  return contentStatus === "已生成" || contentStatus === "待复测";
}

export function resolveQuestionOpportunityLabel(input: {
  enabled: boolean;
  competitorOccupied: boolean;
  contentPublished: boolean;
  hasContentPending: boolean;
}): QuestionOpportunityLabel | null {
  if (input.competitorOccupied) return "竞品占位";
  if (input.contentPublished) return "已覆盖";
  if (input.hasContentPending) return "待优化";
  if (input.enabled) return "高价值";
  return null;
}

export function buildQuestionOpportunityOverview(input: {
  questions: Array<{
    id: number;
    enabled: number | boolean | null;
    contentStatus: QuestionContentStatus;
    competitorOccupied: boolean;
    monthlyFocus: boolean;
  }>;
}): QuestionOpportunityOverview {
  let coveredContentQuestions = 0;
  let competitorOccupiedQuestions = 0;
  let monthlyFocusQuestions = 0;

  for (const question of input.questions) {
    if (isQuestionContentPublished(question.contentStatus)) coveredContentQuestions += 1;
    if (question.competitorOccupied) competitorOccupiedQuestions += 1;
    if (question.monthlyFocus) monthlyFocusQuestions += 1;
  }

  return {
    totalQuestions: input.questions.length,
    coveredContentQuestions,
    competitorOccupiedQuestions,
    monthlyFocusQuestions,
  };
}

export function buildQuestionOpportunityGroupStats(
  questions: Array<{
    searchPoolType?: string | null;
    competitorOccupied: boolean;
    contentStatus: QuestionContentStatus;
  }>,
  poolType: string,
): QuestionOpportunityGroupStats {
  const bucket = questions.filter(question => question.searchPoolType === poolType);
  return {
    total: bucket.length,
    competitorOccupiedCount: bucket.filter(question => question.competitorOccupied).length,
    coveredCount: bucket.filter(question => isQuestionContentPublished(question.contentStatus)).length,
  };
}

export function enrichQuestionOpportunityFields(input: {
  question: SearchPoolQuestionRow;
  contentStatus: QuestionContentStatus;
  hasContentTask: boolean;
  competitorRate: number | undefined;
  monthlyFocusQuestionIds: ReadonlySet<number>;
}): {
  competitorOccupied: boolean;
  contentPublished: boolean;
  hasContentPending: boolean;
  monthlyFocus: boolean;
  opportunityLabel: QuestionOpportunityLabel | null;
} {
  const competitorOccupied = isCompetitorOccupiedQuestion(input.competitorRate);
  const contentPublished = isQuestionContentPublished(input.contentStatus);
  const hasContentPending =
    input.hasContentTask && isQuestionContentPendingOptimization(input.contentStatus);
  const monthlyFocus = input.monthlyFocusQuestionIds.has(input.question.id);
  const enabled = Number(input.question.enabled) !== 0;
  const opportunityLabel = resolveQuestionOpportunityLabel({
    enabled,
    competitorOccupied,
    contentPublished,
    hasContentPending,
  });

  return {
    competitorOccupied,
    contentPublished,
    hasContentPending,
    monthlyFocus,
    opportunityLabel,
  };
}

function countEnabled(questions: QuestionOpportunityMapQuestionInput[]): number {
  return questions.filter(question => Number(question.enabled) !== 0).length;
}

function resolveQuestionOpportunityScore(question: QuestionOpportunityMapQuestionInput): number {
  let score = 0;
  if (question.monthlyFocus) score += 120;
  if (question.competitorOccupied) score += 100;
  if (Number(question.enabled) !== 0 && !question.hasContentTask && !question.contentPublished) score += 80;
  if (question.lastTestResult === "not_mentioned" || question.lastTestResult === "competitor_won") score += 60;
  if (question.hasContentPending) score += 45;
  if (question.priorityLevel === "high") score += 35;
  if (question.contentPublished) score -= 30;
  return score;
}

function resolveQuestionOpportunityReason(
  question: QuestionOpportunityMapQuestionInput,
  hasDiagnosisData: boolean,
): string {
  if (question.monthlyFocus && question.competitorOccupied) {
    return "本月计划已指向该问题，且 AI 回答里竞品占位明显。";
  }
  if (question.competitorOccupied) {
    return "AI 回答里竞品出现率较高，品牌答案需要尽快补位。";
  }
  if (!hasDiagnosisData || !question.lastTestResult) {
    return "尚未形成稳定 AI 实测证据，适合先纳入诊断或作为内容选题储备。";
  }
  if (question.contentPublished) {
    return "已有内容覆盖，下一步应看收录、关键词触发和 AI 复测变化。";
  }
  if (question.hasContentPending || question.hasContentTask) {
    return "已有内容任务或草稿，下一步要从生成推进到发布和收录。";
  }
  return "已启用但还没有内容覆盖，适合作为本月内容资产入口。";
}

function resolveQuestionOpportunityAction(
  question: QuestionOpportunityMapQuestionInput,
  hasDiagnosisData: boolean,
): { label: string; kind: QuestionOpportunityNextActionKind } {
  if (question.contentPublished) return { label: "看收录与复测", kind: "monitor_retest" };
  if (question.hasContentPending || question.hasContentTask) return { label: "进入内容推进", kind: "open_weekly_task" };
  if (!hasDiagnosisData || !question.lastTestResult) return { label: "加入本轮诊断", kind: "add_to_diagnosis" };
  return { label: "生成内容任务", kind: "create_content_task" };
}

function resolveQuestionOpportunitySourceLine(question: QuestionOpportunityMapQuestionInput): string {
  const sources = (question.requiredSourceTypes ?? []).map(resolveSourceTypeLabel).filter(Boolean);
  if (sources.length > 0) return `优先补：${sources.slice(0, 3).join("、")}`;
  if (question.competitorOccupied) return "优先补：竞品对比与公开问答信源";
  return "优先补：公开可引用信源";
}

function toQuestionOpportunityMapItem(
  question: QuestionOpportunityMapQuestionInput,
  hasDiagnosisData: boolean,
): QuestionOpportunityMapItem {
  const action = resolveQuestionOpportunityAction(question, hasDiagnosisData);
  const score = resolveQuestionOpportunityScore(question);
  const aiLabel = hasDiagnosisData ? (question.aiPerformanceLabel?.trim() || "未实测") : "暂无诊断数据";
  const focusSuffix = question.monthlyFocus ? " · 本月重点" : "";
  return {
    questionId: question.id,
    questionText: question.questionText,
    typeLabel: resolveSearchPoolTypeLabel(question.searchPoolType),
    opportunityLabel: question.opportunityLabel ?? "待实测",
    reason: resolveQuestionOpportunityReason(question, hasDiagnosisData),
    evidenceLine: `AI 表现：${aiLabel} · 内容：${question.contentStatus}${focusSuffix}`,
    sourceLine: resolveQuestionOpportunitySourceLine(question),
    nextActionLabel: action.label,
    nextActionKind: action.kind,
    score,
  };
}

function resolveMapHeadline(input: {
  totalQuestions: number;
  competitorCount: number;
  uncoveredCount: number;
  pendingCount: number;
  publishedCount: number;
}): string {
  if (input.totalQuestions === 0) return "先建立 AI 搜索问题池";
  if (input.competitorCount > 0) return `本月优先抢回 ${input.competitorCount} 个竞品占位问题`;
  if (input.uncoveredCount > 0) return `本月优先补齐 ${input.uncoveredCount} 个未覆盖问题`;
  if (input.pendingCount > 0) return "已有内容任务，下一步推进发布与收录";
  if (input.publishedCount > 0) return "已有内容覆盖，下一步看收录与 AI 复测";
  return "把客户搜索问题转成内容资产计划";
}

function resolvePrimaryAction(input: {
  hasDiagnosisData: boolean;
  competitorCount: number;
  uncoveredCount: number;
  pendingCount: number;
  publishedCount: number;
}): { label: string; reason: string } {
  if (!input.hasDiagnosisData) {
    return {
      label: "先跑 AI 实测诊断",
      reason: "没有诊断证据时，机会地图只能作为问题储备；完成实测后才能判断竞品占位和品牌缺口。",
    };
  }
  if (input.competitorCount > 0) {
    return {
      label: "优先处理竞品占位",
      reason: "这些问题已经被竞品拿到 AI 注意力，优先补品牌答案资产最容易形成客户可感知变化。",
    };
  }
  if (input.uncoveredCount > 0) {
    return {
      label: "补齐未覆盖内容",
      reason: "未覆盖问题无法进入发布、收录和复测链路，应先转成内容任务。",
    };
  }
  if (input.pendingCount > 0) {
    return {
      label: "推进发布与收录",
      reason: "已有内容任务后，价值证明来自公开发布、收录监测和 AI 复测。",
    };
  }
  return {
    label: "进入监测与复测",
    reason: "内容覆盖后要证明 AI 回答是否变化，才能进入月报和续费解释。",
  };
}

export function buildQuestionOpportunityMapView(input: {
  questions: QuestionOpportunityMapQuestionInput[];
  hasDiagnosisData: boolean;
}): QuestionOpportunityMapView {
  const enabledQuestions = input.questions.filter(question => Number(question.enabled) !== 0);
  const competitorCount = enabledQuestions.filter(question => question.competitorOccupied).length;
  const uncoveredCount = enabledQuestions.filter(
    question => !question.contentPublished && !question.hasContentTask && !question.hasContentPending,
  ).length;
  const pendingCount = enabledQuestions.filter(
    question => !question.contentPublished && (question.hasContentTask || question.hasContentPending),
  ).length;
  const publishedCount = enabledQuestions.filter(question => question.contentPublished).length;
  const primaryAction = resolvePrimaryAction({
    hasDiagnosisData: input.hasDiagnosisData,
    competitorCount,
    uncoveredCount,
    pendingCount,
    publishedCount,
  });
  const items = enabledQuestions
    .map(question => toQuestionOpportunityMapItem(question, input.hasDiagnosisData))
    .sort((a, b) => b.score - a.score || a.questionText.localeCompare(b.questionText, "zh-CN"));

  return {
    headline: resolveMapHeadline({
      totalQuestions: input.questions.length,
      competitorCount,
      uncoveredCount,
      pendingCount,
      publishedCount,
    }),
    summary: input.hasDiagnosisData
      ? "已结合 AI 实测、竞品占位、内容覆盖和本月计划排序。"
      : "当前先按问题池与内容覆盖排序；完成 AI 实测后会补齐竞品占位判断。",
    proofLine: `核心问题 ${input.questions.length} 个 · 启用 ${countEnabled(input.questions)} 个 · 竞品占位 ${competitorCount} 个 · 未覆盖 ${uncoveredCount} 个 · 内容已覆盖 ${publishedCount} 个`,
    primaryActionLabel: primaryAction.label,
    primaryActionReason: primaryAction.reason,
    topItems: items.slice(0, 5),
    lanes: [
      {
        id: "compete",
        title: "抢竞品占位",
        description: "AI 已频繁提到竞品，优先补品牌答案。",
        count: competitorCount,
      },
      {
        id: "uncovered",
        title: "补内容覆盖",
        description: "问题已启用但还没有内容资产承接。",
        count: uncoveredCount,
      },
      {
        id: "publish",
        title: "推发布收录",
        description: "已有内容任务，下一步进入公开信源。",
        count: pendingCount,
      },
      {
        id: "monitor",
        title: "看复测变化",
        description: "已有覆盖内容，继续证明 AI 回答变化。",
        count: publishedCount,
      },
    ],
    emptyHint: input.questions.length === 0 ? "先生成或新增客户会问 AI 的问题，再进入诊断和内容建设。" : null,
  };
}

import { normalizeAiTestResult, type AiTestEvidenceItem } from "./aiTestEvidence";

export const CONTENT_RETEST_ATTRIBUTION_PENDING_MESSAGE =
  "收录后3天可触发AI复测，复测完成后查看变化";
export const CONTENT_RETEST_ATTRIBUTION_RETESTING_MESSAGE =
  "AI复测进行中，完成后自动更新";
export const CONTENT_RETEST_ATTRIBUTION_NO_QUESTION_MESSAGE =
  "暂无关联AI搜索问题数据";
export const MONTHLY_REPORT_CONTENT_IMPACT_EMPTY_MESSAGE =
  "完成内容发布并触发AI复测后，系统将自动生成影响证明。";

export const BASELINE_STAGE_LABEL = "优化前基线";
export const AFTER_RETEST_STAGE_LABEL = "发布后复测";

export type ContentRetestAttributionStatus =
  | "no_question"
  | "pending_retest"
  | "retesting"
  | "ready";

export type StructuredRetestRunInput = {
  mentionedCompany: boolean;
  recommendedCompany: boolean;
  answerText: string;
};

export type RetestStageSnapshot = {
  label: string;
  hasData: boolean;
  mentionsBrand: boolean | null;
  brandMentionRate: number | null;
  brandRecommendRate: number | null;
  answerSummary: string | null;
};

export type ContentRetestAttributionView = {
  status: ContentRetestAttributionStatus;
  statusMessage: string;
  questionText: string | null;
  before: RetestStageSnapshot;
  after: RetestStageSnapshot;
  changeConclusion: string | null;
  showExpand: boolean;
};

function summarizeAnswer(text: string | null | undefined, maxLen = 120): string | null {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}…`;
}

function aggregateStructuredRuns(
  runs: StructuredRetestRunInput[],
  label: string,
): RetestStageSnapshot {
  if (runs.length === 0) {
    return {
      label,
      hasData: false,
      mentionsBrand: null,
      brandMentionRate: null,
      brandRecommendRate: null,
      answerSummary: null,
    };
  }

  const mentionCount = runs.filter(run => run.mentionedCompany).length;
  const recommendCount = runs.filter(run => run.recommendedCompany).length;
  const representative = runs.find(run => run.answerText.trim()) ?? runs[0]!;

  return {
    label,
    hasData: true,
    mentionsBrand: mentionCount > 0,
    brandMentionRate: mentionCount / runs.length,
    brandRecommendRate: recommendCount / runs.length,
    answerSummary: summarizeAnswer(representative.answerText),
  };
}

function structuredRunsFromAiTestResults(
  items: unknown[],
  stage: "before_publish" | "after_publish",
): StructuredRetestRunInput[] {
  const out: StructuredRetestRunInput[] = [];
  for (const raw of items) {
    const normalized = normalizeAiTestResult(raw);
    if (!normalized || normalized.testStage !== stage) continue;
    out.push({
      mentionedCompany: normalized.mentionsBrand,
      recommendedCompany: normalized.recommendsBrand,
      answerText: normalized.answer,
    });
  }
  return out;
}

function formatRatePercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function buildRetestChangeConclusion(input: {
  before: RetestStageSnapshot;
  after: RetestStageSnapshot;
}): string | null {
  if (!input.before.hasData || !input.after.hasData) return null;

  const beforeMentioned = input.before.mentionsBrand === true;
  const afterMentioned = input.after.mentionsBrand === true;
  const beforeRate = input.before.brandMentionRate;
  const afterRate = input.after.brandMentionRate;
  const beforeRecommend = input.before.brandRecommendRate;
  const afterRecommend = input.after.brandRecommendRate;

  if (!beforeMentioned && afterMentioned) {
    if (beforeRate != null && afterRate != null && afterRate > 0) {
      return `发布后AI开始提及品牌，提及率从${formatRatePercent(beforeRate)}提升至${formatRatePercent(afterRate)}`;
    }
    return "发布后AI开始提及品牌";
  }

  if (beforeRate != null && afterRate != null && Math.round(beforeRate * 100) !== Math.round(afterRate * 100)) {
    const delta = Math.round((afterRate - beforeRate) * 100);
    if (delta > 0) {
      return `提及率从${formatRatePercent(beforeRate)}提升至${formatRatePercent(afterRate)}`;
    }
    if (delta < 0) {
      return `提及率从${formatRatePercent(beforeRate)}下降至${formatRatePercent(afterRate)}`;
    }
  }

  if (
    beforeRecommend != null &&
    afterRecommend != null &&
    Math.round(beforeRecommend * 100) !== Math.round(afterRecommend * 100)
  ) {
    const delta = Math.round((afterRecommend - beforeRecommend) * 100);
    if (delta > 0) {
      return `推荐率从${formatRatePercent(beforeRecommend)}提升至${formatRatePercent(afterRecommend)}`;
    }
    if (delta < 0) {
      return `推荐率从${formatRatePercent(beforeRecommend)}下降至${formatRatePercent(afterRecommend)}`;
    }
  }

  return "无明显变化";
}

export function buildContentRetestAttributionView(input: {
  questionText?: string | null;
  baseRuns?: StructuredRetestRunInput[];
  compareRuns?: StructuredRetestRunInput[];
  aiTestResults?: unknown[] | null;
  aiMentionMonitorStatus?: string | null;
  included?: boolean;
}): ContentRetestAttributionView {
  const questionText = input.questionText?.trim() || null;
  const aiTestResults = Array.isArray(input.aiTestResults) ? input.aiTestResults : [];

  const baseFromResults = structuredRunsFromAiTestResults(aiTestResults, "before_publish");
  const afterFromResults = structuredRunsFromAiTestResults(aiTestResults, "after_publish");

  const baseRuns = [...(input.baseRuns ?? []), ...baseFromResults];
  const compareRuns = [...(input.compareRuns ?? []), ...afterFromResults];

  const before = aggregateStructuredRuns(baseRuns, BASELINE_STAGE_LABEL);
  const after = aggregateStructuredRuns(compareRuns, AFTER_RETEST_STAGE_LABEL);
  const changeConclusion = buildRetestChangeConclusion({ before, after });

  const monitorStatus = (input.aiMentionMonitorStatus ?? "").trim();
  const isRetesting = monitorStatus === "检测中";

  if (!questionText) {
    return {
      status: "no_question",
      statusMessage: CONTENT_RETEST_ATTRIBUTION_NO_QUESTION_MESSAGE,
      questionText: null,
      before,
      after,
      changeConclusion,
      showExpand: Boolean(input.included),
    };
  }

  if (isRetesting) {
    return {
      status: "retesting",
      statusMessage: CONTENT_RETEST_ATTRIBUTION_RETESTING_MESSAGE,
      questionText,
      before,
      after,
      changeConclusion,
      showExpand: Boolean(input.included),
    };
  }

  if (!after.hasData) {
    return {
      status: "pending_retest",
      statusMessage: CONTENT_RETEST_ATTRIBUTION_PENDING_MESSAGE,
      questionText,
      before,
      after,
      changeConclusion,
      showExpand: Boolean(input.included),
    };
  }

  return {
    status: "ready",
    statusMessage: changeConclusion ?? "已完成发布前后 AI 回答对比",
    questionText,
    before,
    after,
    changeConclusion,
    showExpand: true,
  };
}

export type MonthlyReportContentImpactProofItem = {
  articleId: number;
  title: string;
  platform: string;
  questionText: string | null;
  changeConclusion: string;
};

export function buildMonthlyReportContentImpactProof(
  items: Array<{
    articleId: number;
    title: string;
    platform: string;
    questionText: string | null;
    attribution: ContentRetestAttributionView;
  }>,
): {
  hasData: boolean;
  emptyMessage: string;
  items: MonthlyReportContentImpactProofItem[];
} {
  const readyItems = items
    .filter(item => item.attribution.status === "ready" && item.attribution.changeConclusion)
    .map(item => ({
      articleId: item.articleId,
      title: item.title,
      platform: item.platform,
      questionText: item.questionText,
      changeConclusion: item.attribution.changeConclusion!,
    }));

  return {
    hasData: readyItems.length > 0,
    emptyMessage: MONTHLY_REPORT_CONTENT_IMPACT_EMPTY_MESSAGE,
    items: readyItems,
  };
}

export function formatMonthlyReportImpactProofLine(item: MonthlyReportContentImpactProofItem): string {
  const question = item.questionText?.trim() || item.title.trim();
  return `${item.platform}·${question}\n→ ${item.changeConclusion}`;
}

export function mentionsBrandLabel(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "是" : "否";
}

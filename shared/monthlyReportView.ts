/**
 * GEO-V2.0-P1-Phase5：AI 品牌成熟度月报视图模型（纯函数）
 */

import {
  GEO_MATURITY_DIMENSION_META,
  type GeoMaturityDimensionKey,
} from "./geoMaturityScoring";
import {
  buildMonthlyPlanComparison,
  computeMonthlyPlanProgress,
  resolveTopWeakDimensions,
  type MonthlyPlanWorkspaceStage,
} from "./monthlyPlanGeneration";

export const MONTHLY_REPORT_PAGE_TITLE = "AI 品牌成熟度月报";
export const MONTHLY_REPORT_PAGE_INTRO =
  "记录本月AI品牌优化的执行动作、AI推荐变化和成效，是续费评估和下月计划的依据。";
export const MONTHLY_REPORT_PENDING_SUMMARY = "复测完成后自动生成";
export const MONTHLY_REPORT_NO_BASELINE_LABEL = "尚未建立基线";
export const MONTHLY_REPORT_BASELINE_PENDING_COMPARE = "复测完成后生成对比";
export const MONTHLY_REPORT_EXECUTING_MESSAGE =
  "本月优化计划执行中（{completed}/{total}项已完成）完成全部任务并复测后，将自动生成本月成效报告。";

export type AiTestRunRateInput = {
  mentionedCompany?: boolean | null;
  recommendedCompany?: boolean | null;
  platform?: string | null;
  testedAt?: Date | string | null;
};

export type MonthlyReportPlanInput = {
  id: number;
  roundNumber: number;
  status: "active" | "completed";
  baselineMaturityScore: number;
  baselineDimensionScores: Record<string, number>;
  resultMaturityScore: number | null;
  resultDimensionScores: Record<string, number> | null;
  generatedAt: Date | string;
  retestScheduledAt: Date | string | null;
  retestCompletedAt: Date | string | null;
};

export type MonthlyReportTaskInput = {
  id: number;
  taskType: string;
  title: string;
  status: string;
  relatedQuestionId: number | null;
  linkedEntityId: number | null;
  metadata: Record<string, unknown> | null;
  completedAt: Date | string | null;
};

export type MonthlyReportContentItem = {
  articleId: number;
  title: string;
  platform: string;
  publishedAt: string | null;
  questionText: string | null;
};

export type MonthlyReportSourceItem = {
  id: number;
  name: string;
  type: string;
  adoptedAt: string | null;
};

export type MonthlyReportEvidenceItem = {
  id: number;
  title: string;
  type: string;
  addedAt: string | null;
};

export type MonthlyReportPlatformChange = {
  platform: string;
  baselineMentionRate: number | null;
  resultMentionRate: number | null;
  baselineRecommendRate: number | null;
  resultRecommendRate: number | null;
  testedQuestions: number;
};

export type MonthlyReportView = {
  planId: number | null;
  roundNumber: number | null;
  periodLabel: string;
  planPhase: MonthlyPlanWorkspaceStage | "no_plan";
  hasRetestData: boolean;
  progress: { completedCount: number; totalCount: number };
  focusSummary: string;
  summary: {
    maturityBaseline: number | null;
    maturityResult: number | null;
    maturityDelta: number | null;
    mentionRateBaseline: number | null;
    mentionRateResult: number | null;
    mentionRateDelta: number | null;
    recommendRateBaseline: number | null;
    recommendRateResult: number | null;
    recommendRateDelta: number | null;
    pendingLabel: string | null;
  };
  weakDimensionChanges: Array<{
    key: string;
    label: string;
    baselineScore: number;
    currentScore: number;
    delta: number;
    improved: boolean;
  }>;
  actions: {
    contentCount: number;
    questionCoverageCount: number;
    contentItems: MonthlyReportContentItem[];
    sourceCount: number;
    sourceItems: MonthlyReportSourceItem[];
    evidenceCount: number;
    evidenceItems: MonthlyReportEvidenceItem[];
  };
  retest: {
    completedAt: string | null;
    questionCount: number;
    platformChanges: MonthlyReportPlatformChange[];
    mentionRateBaseline: number | null;
    mentionRateResult: number | null;
    recommendRateBaseline: number | null;
    recommendRateResult: number | null;
  } | null;
  nextMonth: {
    weakDimensions: string[];
    suggestions: string[];
    canGenerateNextPlan: boolean;
  };
  history: Array<{
    planId: number;
    roundNumber: number;
    status: string;
    periodLabel: string;
    summaryLine: string;
    hasRetestData: boolean;
  }>;
  showExecutingEmpty: boolean;
  executingMessage: string | null;
};

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function formatMonthlyReportPeriodLabel(
  generatedAt: Date | string,
  roundNumber: number,
): string {
  const date = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return `第 ${roundNumber} 轮优化周期`;
  const month = date.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });
  return `${month} 第 ${roundNumber} 轮`;
}

export function computeAiTestRatesFromRuns(runs: AiTestRunRateInput[]): {
  mentionRate: number | null;
  recommendRate: number | null;
  questionCount: number;
  byPlatform: Array<{
    platform: string;
    mentionRate: number;
    recommendRate: number;
    count: number;
  }>;
} {
  if (runs.length === 0) {
    return { mentionRate: null, recommendRate: null, questionCount: 0, byPlatform: [] };
  }
  const mentionCount = runs.filter(r => r.mentionedCompany).length;
  const recommendCount = runs.filter(r => r.recommendedCompany).length;
  const byPlatformMap = new Map<string, AiTestRunRateInput[]>();
  for (const run of runs) {
    const platform = (run.platform ?? "未知平台").trim() || "未知平台";
    const list = byPlatformMap.get(platform) ?? [];
    list.push(run);
    byPlatformMap.set(platform, list);
  }
  const byPlatform = Array.from(byPlatformMap.entries()).map(([platform, items]) => ({
    platform,
    mentionRate: items.filter(r => r.mentionedCompany).length / items.length,
    recommendRate: items.filter(r => r.recommendedCompany).length / items.length,
    count: items.length,
  }));
  return {
    mentionRate: mentionCount / runs.length,
    recommendRate: recommendCount / runs.length,
    questionCount: runs.length,
    byPlatform,
  };
}

export function splitAiTestRunsByPlanPeriod(
  runs: AiTestRunRateInput[],
  planGeneratedAt: Date | string,
): { baselineRuns: AiTestRunRateInput[]; periodRuns: AiTestRunRateInput[] } {
  const generatedTs = toTimestamp(planGeneratedAt);
  if (generatedTs == null) {
    return { baselineRuns: runs, periodRuns: [] };
  }
  const baselineRuns: AiTestRunRateInput[] = [];
  const periodRuns: AiTestRunRateInput[] = [];
  for (const run of runs) {
    const runTs = toTimestamp(run.testedAt);
    if (runTs != null && runTs <= generatedTs) {
      baselineRuns.push(run);
    } else {
      periodRuns.push(run);
    }
  }
  return { baselineRuns, periodRuns };
}

/** 月报基线：优先取计划生成前的实测快照；无快照时回退到全量最新 AI 实测结果 */
export function resolveMonthlyReportBaselineRuns(
  runs: AiTestRunRateInput[],
  planGeneratedAt: Date | string,
): AiTestRunRateInput[] {
  const { baselineRuns } = splitAiTestRunsByPlanPeriod(runs, planGeneratedAt);
  if (baselineRuns.length > 0) return baselineRuns;
  return runs;
}

export function buildMonthlyReportPlatformChanges(
  baselineRates: ReturnType<typeof computeAiTestRatesFromRuns>,
  resultRates: ReturnType<typeof computeAiTestRatesFromRuns>,
): MonthlyReportPlatformChange[] {
  const platforms = new Set([
    ...baselineRates.byPlatform.map(p => p.platform),
    ...resultRates.byPlatform.map(p => p.platform),
  ]);
  return Array.from(platforms).map(platform => {
    const baseline = baselineRates.byPlatform.find(p => p.platform === platform);
    const result = resultRates.byPlatform.find(p => p.platform === platform);
    return {
      platform,
      baselineMentionRate: baseline?.mentionRate ?? null,
      resultMentionRate: result?.mentionRate ?? null,
      baselineRecommendRate: baseline?.recommendRate ?? null,
      resultRecommendRate: result?.recommendRate ?? null,
      testedQuestions: (result?.count ?? 0) + (baseline?.count ?? 0),
    };
  });
}

export function resolveMonthlyReportFocusSummary(
  plan: MonthlyReportPlanInput,
  tasks: MonthlyReportTaskInput[],
): string {
  const fromMeta = tasks[0]?.metadata?.focusSummary;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const weak = resolveTopWeakDimensions({
    brandIdentityScore: plan.baselineDimensionScores.brandIdentity ?? 0,
    categoryPositioningScore: plan.baselineDimensionScores.categoryPositioning ?? 0,
    questionCoverageScore: plan.baselineDimensionScores.questionCoverage ?? 0,
    sourceGraphScore: plan.baselineDimensionScores.sourceGraph ?? 0,
    trustEvidenceScore: plan.baselineDimensionScores.trustEvidence ?? 0,
    aiTestPerformanceScore: plan.baselineDimensionScores.aiTestPerformance ?? 0,
    totalScore: plan.baselineMaturityScore,
    calculationDetail: {},
  });
  return weak.map(d => d.label).join("、") || "关键成熟度维度";
}

export function buildMonthlyReportWeakDimensionChanges(input: {
  plan: MonthlyReportPlanInput;
  latestDimensionScores?: Record<string, number> | null;
}): MonthlyReportView["weakDimensionChanges"] {
  const comparison = buildMonthlyPlanComparison({
    baselineMaturityScore: input.plan.baselineMaturityScore,
    baselineDimensionScores: input.plan.baselineDimensionScores,
    resultMaturityScore: input.plan.resultMaturityScore,
    resultDimensionScores: input.plan.resultDimensionScores,
  });
  const topWeakKeys = resolveTopWeakDimensions({
    brandIdentityScore: input.plan.baselineDimensionScores.brandIdentity ?? 0,
    categoryPositioningScore: input.plan.baselineDimensionScores.categoryPositioning ?? 0,
    questionCoverageScore: input.plan.baselineDimensionScores.questionCoverage ?? 0,
    sourceGraphScore: input.plan.baselineDimensionScores.sourceGraph ?? 0,
    trustEvidenceScore: input.plan.baselineDimensionScores.trustEvidence ?? 0,
    aiTestPerformanceScore: input.plan.baselineDimensionScores.aiTestPerformance ?? 0,
    totalScore: input.plan.baselineMaturityScore,
    calculationDetail: {},
  }).map(d => d.key);

  return topWeakKeys.map(key => {
    const meta = GEO_MATURITY_DIMENSION_META.find(m => m.key === key);
    const row = comparison.dimensions.find(d => d.key === key);
    const baselineScore = row?.baseline ?? input.plan.baselineDimensionScores[key] ?? 0;
    const currentScore =
      row?.result ??
      input.latestDimensionScores?.[key] ??
      baselineScore;
    const delta = currentScore - baselineScore;
    return {
      key,
      label: meta?.label ?? key,
      baselineScore,
      currentScore,
      delta,
      improved: delta > 0,
    };
  });
}

export function buildMonthlyReportNextMonthSuggestions(input: {
  latestTotalScore: number | null;
  latestDimensionScores: Record<string, number> | null;
  planCompleted: boolean;
}): MonthlyReportView["nextMonth"] {
  if (!input.planCompleted || !input.latestDimensionScores || input.latestTotalScore == null) {
    return {
      weakDimensions: [],
      suggestions: ["完成本月全部任务并复测后，系统将基于最新成熟度生成下月重点。"],
      canGenerateNextPlan: false,
    };
  }
  const weak = resolveTopWeakDimensions({
    brandIdentityScore: input.latestDimensionScores.brandIdentity ?? 0,
    categoryPositioningScore: input.latestDimensionScores.categoryPositioning ?? 0,
    questionCoverageScore: input.latestDimensionScores.questionCoverage ?? 0,
    sourceGraphScore: input.latestDimensionScores.sourceGraph ?? 0,
    trustEvidenceScore: input.latestDimensionScores.trustEvidence ?? 0,
    aiTestPerformanceScore: input.latestDimensionScores.aiTestPerformance ?? 0,
    totalScore: input.latestTotalScore,
    calculationDetail: {},
  });
  const suggestions: string[] = [];
  for (const dim of weak) {
    if (dim.score < 60) {
      suggestions.push(`继续提升${dim.label}（当前 ${dim.score} 分）`);
    }
  }
  if (suggestions.length === 0) {
    suggestions.push("维持当前优势维度，并扩大 AI 搜索问题覆盖与复测频次。");
  }
  return {
    weakDimensions: weak.map(d => d.label),
    suggestions: suggestions.slice(0, 4),
    canGenerateNextPlan: true,
  };
}

export function buildMonthlyReportView(input: {
  plan: MonthlyReportPlanInput | null;
  tasks: MonthlyReportTaskInput[];
  planPhase: MonthlyPlanWorkspaceStage | "no_plan";
  aiTestRuns: AiTestRunRateInput[];
  contentItems: MonthlyReportContentItem[];
  sourceItems: MonthlyReportSourceItem[];
  evidenceItems: MonthlyReportEvidenceItem[];
  latestTotalScore: number | null;
  latestDimensionScores: Record<string, number> | null;
  historyPlans: Array<{
    plan: MonthlyReportPlanInput;
    progress: { completedCount: number; totalCount: number };
  }>;
}): MonthlyReportView {
  if (!input.plan) {
    return {
      planId: null,
      roundNumber: null,
      periodLabel: "—",
      planPhase: "no_plan",
      hasRetestData: false,
      progress: { completedCount: 0, totalCount: 0 },
      focusSummary: "",
      summary: {
        maturityBaseline: null,
        maturityResult: null,
        maturityDelta: null,
        mentionRateBaseline: null,
        mentionRateResult: null,
        mentionRateDelta: null,
        recommendRateBaseline: null,
        recommendRateResult: null,
        recommendRateDelta: null,
        pendingLabel: MONTHLY_REPORT_PENDING_SUMMARY,
      },
      weakDimensionChanges: [],
      actions: {
        contentCount: 0,
        questionCoverageCount: 0,
        contentItems: [],
        sourceCount: 0,
        sourceItems: [],
        evidenceCount: 0,
        evidenceItems: [],
      },
      retest: null,
      nextMonth: buildMonthlyReportNextMonthSuggestions({
        latestTotalScore: input.latestTotalScore,
        latestDimensionScores: input.latestDimensionScores,
        planCompleted: false,
      }),
      history: input.historyPlans.map(entry => ({
        planId: entry.plan.id,
        roundNumber: entry.plan.roundNumber,
        status: entry.plan.status,
        periodLabel: formatMonthlyReportPeriodLabel(entry.plan.generatedAt, entry.plan.roundNumber),
        summaryLine:
          entry.plan.resultMaturityScore != null
            ? `成熟度 ${entry.plan.baselineMaturityScore} → ${entry.plan.resultMaturityScore} 分`
            : `基线 ${entry.plan.baselineMaturityScore} 分，完成 ${entry.progress.completedCount}/${entry.progress.totalCount} 项`,
        hasRetestData: entry.plan.resultMaturityScore != null,
      })),
      showExecutingEmpty: true,
      executingMessage: null,
    };
  }

  const progress = computeMonthlyPlanProgress(input.tasks);
  const periodLabel = formatMonthlyReportPeriodLabel(input.plan.generatedAt, input.plan.roundNumber);
  const focusSummary = resolveMonthlyReportFocusSummary(input.plan, input.tasks);
  const hasRetestData = input.plan.resultMaturityScore != null && input.plan.retestCompletedAt != null;

  const { baselineRuns, periodRuns } = splitAiTestRunsByPlanPeriod(
    input.aiTestRuns,
    input.plan.generatedAt,
  );
  const baselinePool = hasRetestData
    ? baselineRuns.length > 0
      ? baselineRuns
      : input.aiTestRuns
    : input.aiTestRuns;
  const baselineRates = computeAiTestRatesFromRuns(baselinePool);
  const resultRates = computeAiTestRatesFromRuns(
    hasRetestData ? [...baselineRuns, ...periodRuns] : periodRuns.length > 0 ? periodRuns : baselinePool,
  );
  const mentionBaseline = baselineRates.mentionRate;
  const mentionResult = hasRetestData ? resultRates.mentionRate : null;
  const recommendBaseline = baselineRates.recommendRate;
  const recommendResult = hasRetestData ? resultRates.recommendRate : null;

  const maturityDelta =
    hasRetestData && input.plan.resultMaturityScore != null
      ? input.plan.resultMaturityScore - input.plan.baselineMaturityScore
      : null;

  const questionCoverageCount = new Set(
    input.contentItems.map(item => item.questionText).filter(Boolean),
  ).size;

  const weakDimensionChanges = buildMonthlyReportWeakDimensionChanges({
    plan: input.plan,
    latestDimensionScores: input.latestDimensionScores,
  });

  const retest =
    hasRetestData && input.plan.retestCompletedAt
      ? {
          completedAt:
            input.plan.retestCompletedAt instanceof Date
              ? input.plan.retestCompletedAt.toISOString()
              : String(input.plan.retestCompletedAt),
          questionCount: resultRates.questionCount,
          platformChanges: buildMonthlyReportPlatformChanges(baselineRates, resultRates),
          mentionRateBaseline: mentionBaseline,
          mentionRateResult: mentionResult,
          recommendRateBaseline: recommendBaseline,
          recommendRateResult: recommendResult,
        }
      : null;

  const showExecutingEmpty = !hasRetestData && input.plan.status === "active";
  const executingMessage = showExecutingEmpty
    ? MONTHLY_REPORT_EXECUTING_MESSAGE.replace("{completed}", String(progress.completedCount)).replace(
        "{total}",
        String(progress.totalCount),
      )
    : null;

  return {
    planId: input.plan.id,
    roundNumber: input.plan.roundNumber,
    periodLabel,
    planPhase: input.planPhase,
    hasRetestData,
    progress,
    focusSummary,
    summary: {
      maturityBaseline: input.plan.baselineMaturityScore,
      maturityResult: input.plan.resultMaturityScore,
      maturityDelta,
      mentionRateBaseline: mentionBaseline,
      mentionRateResult: mentionResult,
      mentionRateDelta:
        mentionBaseline != null && mentionResult != null ? mentionResult - mentionBaseline : null,
      recommendRateBaseline: recommendBaseline,
      recommendRateResult: recommendResult,
      recommendRateDelta:
        recommendBaseline != null && recommendResult != null
          ? recommendResult - recommendBaseline
          : null,
      pendingLabel: hasRetestData ? null : MONTHLY_REPORT_PENDING_SUMMARY,
    },
    weakDimensionChanges,
    actions: {
      contentCount: input.contentItems.length,
      questionCoverageCount,
      contentItems: input.contentItems,
      sourceCount: input.sourceItems.length,
      sourceItems: input.sourceItems,
      evidenceCount: input.evidenceItems.length,
      evidenceItems: input.evidenceItems,
    },
    retest,
    nextMonth: buildMonthlyReportNextMonthSuggestions({
      latestTotalScore: input.latestTotalScore ?? input.plan.resultMaturityScore,
      latestDimensionScores:
        input.latestDimensionScores ?? input.plan.resultDimensionScores ?? input.plan.baselineDimensionScores,
      planCompleted: input.plan.status === "completed",
    }),
    history: input.historyPlans.map(entry => ({
      planId: entry.plan.id,
      roundNumber: entry.plan.roundNumber,
      status: entry.plan.status,
      periodLabel: formatMonthlyReportPeriodLabel(entry.plan.generatedAt, entry.plan.roundNumber),
      summaryLine:
        entry.plan.resultMaturityScore != null
          ? `成熟度 ${entry.plan.baselineMaturityScore} → ${entry.plan.resultMaturityScore} 分`
          : `基线 ${entry.plan.baselineMaturityScore} 分，完成 ${entry.progress.completedCount}/${entry.progress.totalCount} 项`,
      hasRetestData: entry.plan.resultMaturityScore != null,
    })),
    showExecutingEmpty,
    executingMessage,
  };
}

export function formatMonthlyReportRateChange(
  before: number | null,
  after: number | null,
): string {
  if (before == null && after == null) return MONTHLY_REPORT_NO_BASELINE_LABEL;
  if (after == null) {
    if (before == null) return MONTHLY_REPORT_NO_BASELINE_LABEL;
    return `当前基线：${formatPercent(before)} · ${MONTHLY_REPORT_BASELINE_PENDING_COMPARE}`;
  }
  const delta = before != null ? after - before : null;
  const deltaText =
    delta != null ? `（${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%）` : "";
  return `${formatPercent(before)} → ${formatPercent(after)}${deltaText}`;
}

export function formatMonthlyReportMaturityChange(
  baseline: number | null,
  result: number | null,
): string {
  if (baseline == null) return MONTHLY_REPORT_PENDING_SUMMARY;
  if (result == null) return `${baseline}分 → ${MONTHLY_REPORT_PENDING_SUMMARY}`;
  const delta = result - baseline;
  return `${baseline}分 → ${result}分（${delta >= 0 ? "+" : ""}${delta}）`;
}

export type MonthlyReportDimensionKey = GeoMaturityDimensionKey;

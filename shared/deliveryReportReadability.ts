import type { GeoGrowthSuggestion } from "./geoGrowthSuggestions";
import { findLatestT0FinishedAt } from "./geoGrowthSuggestions";
import {
  findLatestCompletedRound,
  isCompletedTestRound,
  type TestRoundSummary,
} from "./retestComparisonDisplay";
import {
  addDaysAfterPublish,
  formatRetestPlanDate,
  RETEST_PLAN_MILESTONES,
  T1_RETEST_PLAN_DAYS,
} from "./retestPlan";
import {
  hasCompletedT0Baseline,
  hasCompletedT1Retest,
  hasCompletedT2Retest,
  hasCompletedT3Retest,
} from "./workspaceMainChain";

export const DELIVERY_REPORT_GROWTH_TITLE_SUFFIX = "GEO 增长交付报告";

export const T0_ONLY_TREND_INSUFFICIENT_MESSAGE =
  "当前仅有 T0 基线，尚不足以判断趋势变化。完成发布和 T1 复测后，将形成前后对比。";

export const DELIVERY_INSUFFICIENT_DATA_PREFIX = "当前部分交付数据尚不完整：";

const GEO_SCORE_MISSING_LABEL = "暂无数据";
const PERCENT_MISSING_LABEL = "暂无（需先完成 AI 实测）";
const COUNT_MISSING_LABEL = "暂无";
const CITATION_MISSING_LABEL = "暂无（需有引用样本）";

export type DeliveryReportViewMode = "internal" | "customer";

export type DeliveryOutcomeCard = {
  id: string;
  title: string;
  metrics: Array<{ label: string; value: string }>;
};

export type ContentEvidenceRow = {
  key: string;
  title: string;
  questionText: string;
  platform: string;
  publishStatus: string;
  publicUrl: string;
  qualityStatus: string;
  retestStatus: string;
};

export type RetestStageRow = {
  stageKey: "T0" | "T1" | "T2" | "T3";
  stageLabel: string;
  statusLabel: string;
  brandMentioned: string;
  brandRecommended: string;
  contentCited: string;
  evidenceSummary: string;
  emptyReason: string | null;
  expectedAtLabel: string | null;
};

export type NextRoundPlanItem = {
  priority: number;
  action: string;
  question: string;
  platform: string;
  expectedImpact: string;
};

export type InternalChecklistItem = {
  id: string;
  label: string;
  status: "已完成" | "待完成";
  blockReason: string | null;
  ctaPath: string;
  ctaLabel: string;
};

export type DeliveryReportBossSummary = {
  title: string;
  deliveryPeriod: string;
  roundGoal: string;
  geoScoreLabel: string;
  mentionRateLabel: string;
  recommendRateLabel: string;
  completedActions: string;
  coreConclusion: string;
  nextStepFocus: string;
  insufficientBanner: string | null;
};

export type DeliveryReportProductSnapshot = {
  reportStatusLabel: string;
  bossSummary: DeliveryReportBossSummary;
  outcomeCards: DeliveryOutcomeCard[];
  geoAttribution: {
    scoreExplanation: string;
    trendMessage: string | null;
    positiveLines: string[];
    laggingLines: string[];
    nextPriority: string;
  };
  contentEvidence: ContentEvidenceRow[];
  retestStages: RetestStageRow[];
  nextRoundPlan: NextRoundPlanItem[];
  checklist: InternalChecklistItem[];
};

export type BuildDeliveryReportProductSnapshotInput = {
  enterpriseName: string;
  reportPeriod: string;
  roundGoal: string;
  visibilityScore: number | null;
  mentionRate: number | null;
  recommendRate: number | null;
  hasAiTestData: boolean;
  conclusionLine: string;
  completedActionLines: string[];
  nextStepFocusLines: string[];
  insufficientReasonParts: string[];
  questionCount: number;
  engineCount: number;
  lastAiTestedAt: string | null;
  generatedArticleCount: number;
  publishableArticleCount: number;
  publishedRecordCount: number;
  distinctPlatformCount: number;
  publishWithLinkCount: number;
  pendingLinkCount: number;
  retestCompletedCount: number;
  retestPendingCount: number;
  nextRetestAtLabel: string | null;
  geoAttributionLines: string[];
  positiveIndicatorLines: string[];
  laggingIndicatorLines: string[];
  nextPriorityLine: string;
  contentEvidenceRows: ContentEvidenceRow[];
  testRounds: TestRoundSummary[];
  citationRate: number | null;
  latestPublishAt: string | null;
  growthSuggestions: GeoGrowthSuggestion[];
  maxProblemLine: string;
  profileCompletionPercent: number;
  qualityScoredCount: number;
};

export type BuildRetestStageRowsInput = {
  testRounds: TestRoundSummary[];
  hasAiTestData: boolean;
  mentionRate: number | null;
  recommendRate: number | null;
  citationRate: number | null;
  latestPublishAt: string | null;
  publishWithLinkCount: number;
  retestedCount: number;
  nextRetestAtLabel?: string | null;
};

const STAGE_ROUND_TYPES: Record<RetestStageRow["stageKey"], string> = {
  T0: "T0_BASELINE",
  T1: "T1_RETEST",
  T2: "T2_RETEST",
  T3: "T3_RETEST",
};

const STAGE_LABELS: Record<RetestStageRow["stageKey"], string> = {
  T0: "T0 基线实测",
  T1: "T1 复测（发布后约 7 天）",
  T2: "T2 复测（发布后约 30 天）",
  T3: "T3 复测（发布后约 90 天）",
};

function normalizeEnterpriseName(name: string): string {
  return name.trim() || "当前企业";
}

function joinLines(lines: string[], fallback: string): string {
  const filtered = lines.map(line => line.trim()).filter(Boolean);
  return filtered.length > 0 ? filtered.join("；") : fallback;
}

function formatVisibilityScore(score: number | null): string {
  return score != null && Number.isFinite(score) ? String(score) : GEO_SCORE_MISSING_LABEL;
}

function hasCompletedStage(testRounds: TestRoundSummary[], stageKey: RetestStageRow["stageKey"]): boolean {
  if (stageKey === "T0") return hasCompletedT0Baseline(testRounds);
  if (stageKey === "T1") return hasCompletedT1Retest(testRounds);
  if (stageKey === "T2") return hasCompletedT2Retest(testRounds);
  if (stageKey === "T3") return hasCompletedT3Retest(testRounds);
  const roundType = STAGE_ROUND_TYPES[stageKey];
  return testRounds.some(round => round.roundType === roundType && isCompletedTestRound(round));
}

function findStageRound(
  testRounds: TestRoundSummary[],
  stageKey: RetestStageRow["stageKey"],
): TestRoundSummary | null {
  return findLatestCompletedRound(testRounds, STAGE_ROUND_TYPES[stageKey]);
}

function formatSignalLabel(rate: number | null, hasData: boolean, positiveLabel: string): string {
  if (!hasData || rate == null) return "暂无数据";
  if (rate > 0) return positiveLabel;
  return "未观测到";
}

function resolveStageStatusLabel(
  completed: boolean,
  stageKey: RetestStageRow["stageKey"],
  input: BuildRetestStageRowsInput,
): string {
  if (completed) return "已完成";
  if (stageKey === "T0") {
    return input.hasAiTestData ? "进行中" : "待启动";
  }
  if (stageKey === "T1") {
    if (input.publishWithLinkCount === 0) return "待发布与回填链接";
    if (input.retestedCount > 0) return "监测中";
    return "待执行";
  }
  return input.latestPublishAt ? "计划中" : "待有发布基线";
}

function resolveStageExpectedAtLabel(
  stageKey: RetestStageRow["stageKey"],
  input: BuildRetestStageRowsInput,
): string | null {
  if (stageKey === "T1" && input.nextRetestAtLabel) {
    return `建议复测时间：${input.nextRetestAtLabel}`;
  }
  const milestone = RETEST_PLAN_MILESTONES.find(item => item.phase === stageKey);
  if (!milestone || !input.latestPublishAt) return null;
  const suggestedAt = addDaysAfterPublish(input.latestPublishAt, milestone.daysAfterPublish);
  return `计划节点：${milestone.scheduleHint}（约 ${formatRetestPlanDate(suggestedAt)}）`;
}

function buildStageEvidenceSummary(
  stageKey: RetestStageRow["stageKey"],
  completed: boolean,
  input: BuildRetestStageRowsInput,
  round: TestRoundSummary | null,
): string {
  if (completed && round) {
    const finishedAt = round.finishedAt
      ? formatRetestPlanDate(round.finishedAt)
      : "完成时间待补充";
    const platformCount = round.platforms?.length ?? 0;
    const questionCount = round.questionsCount ?? 0;
    return `${round.roundName || stageKey} 已于 ${finishedAt} 完成，覆盖 ${questionCount} 题${
      platformCount > 0 ? `、${platformCount} 个平台` : ""
    }。`;
  }

  if (stageKey === "T0") {
    if (!input.hasAiTestData) {
      return "尚未建立 T0 基线，需先在 AI 诊断页完成首轮实测。";
    }
    return `T0 基线提及率 ${formatPercentDisplay(input.mentionRate, true)}，推荐率 ${formatPercentDisplay(
      input.recommendRate,
      true,
    )}。`;
  }

  if (stageKey === "T1") {
    if (input.publishWithLinkCount === 0) {
      return "已有发布登记但缺少可核验的公开链接，暂无法评估发布后变化。";
    }
    return "发布后第 7 天左右的 T1 复测可对照 T0，验证提及、推荐与引用是否改善。";
  }

  if (!input.latestPublishAt) {
    return "需先完成内容发布并登记，才能按 T2/T3 节奏安排后续复测。";
  }

  const milestone = RETEST_PLAN_MILESTONES.find(item => item.phase === stageKey);
  return milestone
    ? `${milestone.title} 将按「${milestone.scheduleHint}」节奏推进，用于观察长期趋势。`
    : "按复测计划推进即可。";
}

function buildStageEmptyReason(
  stageKey: RetestStageRow["stageKey"],
  completed: boolean,
  input: BuildRetestStageRowsInput,
): string | null {
  if (completed) return null;

  if (stageKey === "T0") {
    if (input.hasAiTestData) return null;
    return "原因：尚未完成 AI 搜索 T0 基线实测。下一步：前往 AI 诊断页发起首轮实测并保存结果。";
  }

  if (stageKey === "T1") {
    if (!hasCompletedT0Baseline(input.testRounds)) {
      return "原因：尚未完成 T0 基线，无法安排 T1 复测。下一步：先完成 T0 实测并建立可对照基线。";
    }
    if (input.publishWithLinkCount === 0) {
      return "原因：尚未登记带公开链接的发布记录。下一步：完成发布后在发布页回填链接，再按计划在发布后第 7 天执行 T1 复测。";
    }
    return `原因：尚未完成 T1 复测。下一步：完成发布与链接回填后，建议在发布后约 ${T1_RETEST_PLAN_DAYS} 天执行 T1 复测，形成 T0→T1 前后对比。`;
  }

  if (!input.latestPublishAt) {
    return `原因：尚无发布完成时间，无法计算 ${stageKey} 节点。下一步：先完成内容发布登记。`;
  }

  const milestone = RETEST_PLAN_MILESTONES.find(item => item.phase === stageKey);
  const scheduleHint = milestone?.scheduleHint ?? "计划节点";
  return `原因：${stageKey} 复测尚未执行。下一步：按「${scheduleHint}」在收录监测中发起复测并留存结果。`;
}

export function buildDeliveryReportTitle(enterpriseName: string): string {
  const name = normalizeEnterpriseName(enterpriseName);
  return `${name} ${DELIVERY_REPORT_GROWTH_TITLE_SUFFIX}`;
}

export function formatPercentDisplay(rate: number | null, hasData: boolean): string {
  if (!hasData || rate == null || Number.isNaN(rate)) return PERCENT_MISSING_LABEL;
  return `${Math.round(rate * 100)}%`;
}

export function formatCountDisplay(count: number | null | undefined): string {
  if (count == null || count <= 0) return COUNT_MISSING_LABEL;
  return String(count);
}

export function buildInsufficientDataReason(parts: string[]): string {
  const reasons = parts.map(part => part.trim()).filter(Boolean);
  if (reasons.length === 0) return "";
  return `${DELIVERY_INSUFFICIENT_DATA_PREFIX}${reasons.join("；")}。完成上述步骤后，报告将自动更新。`;
}

export function resolveTrendInsufficientMessage(testRounds: TestRoundSummary[]): string | null {
  const hasT0 = hasCompletedT0Baseline(testRounds);
  const hasT1 = hasCompletedT1Retest(testRounds);
  if (hasT0 && !hasT1) return T0_ONLY_TREND_INSUFFICIENT_MESSAGE;
  return null;
}

export function buildRetestStageRows(input: BuildRetestStageRowsInput): RetestStageRow[] {
  const stageKeys: RetestStageRow["stageKey"][] = ["T0", "T1", "T2", "T3"];

  return stageKeys.map(stageKey => {
    const completed = hasCompletedStage(input.testRounds, stageKey);
    const round = findStageRound(input.testRounds, stageKey);
    const hasData = input.hasAiTestData && (stageKey === "T0" || completed);

    return {
      stageKey,
      stageLabel: STAGE_LABELS[stageKey],
      statusLabel: resolveStageStatusLabel(completed, stageKey, input),
      brandMentioned: formatSignalLabel(
        input.mentionRate,
        hasData,
        `已观测到（约 ${formatPercentDisplay(input.mentionRate, true)}）`,
      ),
      brandRecommended: formatSignalLabel(
        input.recommendRate,
        hasData,
        `已观测到（约 ${formatPercentDisplay(input.recommendRate, true)}）`,
      ),
      contentCited: formatSignalLabel(
        input.citationRate,
        input.citationRate != null,
        `已观测到（约 ${formatPercentDisplay(input.citationRate, true)}）`,
      ),
      evidenceSummary: buildStageEvidenceSummary(stageKey, completed, input, round),
      emptyReason: buildStageEmptyReason(stageKey, completed, input),
      expectedAtLabel: completed ? null : resolveStageExpectedAtLabel(stageKey, input),
    };
  });
}

function mapGrowthSuggestionToPlanItem(
  suggestion: GeoGrowthSuggestion,
  priority: number,
  question: string,
): NextRoundPlanItem {
  const platformHint =
    suggestion.id === "expand_cross_platform"
      ? "搜狐号、百家号等交叉信源"
      : suggestion.id === "pending_publish"
        ? "当前已适配平台"
        : "豆包、Kimi、DeepSeek 等 AI 平台";

  const impactById: Record<GeoGrowthSuggestion["id"], string> = {
    brand_awareness_content: "提升品牌在典型问题下的提及与识别概率。",
    industry_recommend_content: "强化行业推荐类回答中的品牌露出。",
    expand_cross_platform: "增加可引用信源密度，改善 AI 交叉验证。",
    t1_retest: "形成 T0→T1 可对照数据，验证发布是否带来可见度变化。",
    pending_publish: "让内容资产进入公开可引用状态，支撑后续复测。",
  };

  return {
    priority,
    action: suggestion.message,
    question,
    platform: platformHint,
    expectedImpact: impactById[suggestion.id] ?? "按建议执行后可改善本轮 GEO 表现。",
  };
}

function buildFallbackPlanItems(
  input: BuildDeliveryReportProductSnapshotInput,
): NextRoundPlanItem[] {
  const question = resolvePlanQuestion(input.maxProblemLine);
  const items: NextRoundPlanItem[] = [];

  if (!input.hasAiTestData) {
    items.push({
      priority: 1,
      action: "完成 AI 搜索 T0 基线实测",
      question,
      platform: "豆包、Kimi、DeepSeek 等",
      expectedImpact: "建立可对照的提及率与推荐率基线。",
    });
  }

  if (input.publishWithLinkCount === 0 && input.publishedRecordCount > 0) {
    items.push({
      priority: items.length + 1,
      action: "回填已发布内容的公开链接",
      question,
      platform: "发布登记平台",
      expectedImpact: "让 AI 复测可核验公开证据，避免结论停留在登记层。",
    });
  }

  if (input.hasAiTestData && !hasCompletedT1Retest(input.testRounds)) {
    items.push({
      priority: items.length + 1,
      action: "按计划在发布后执行 T1 复测",
      question,
      platform: "与 T0 一致的问题集与平台",
      expectedImpact: "形成发布前后对比，判断优化是否生效。",
    });
  }

  if ((input.recommendRate ?? 0) < 0.05 && input.hasAiTestData) {
    items.push({
      priority: items.length + 1,
      action: "补充推荐型与证据型内容",
      question,
      platform: "多平台交叉发布",
      expectedImpact: "提升 AI 回答中的主动推荐概率。",
    });
  }

  if (items.length === 0) {
    items.push({
      priority: 1,
      action: "按当前高意向问题持续优化并周期性复测",
      question,
      platform: "已发布平台 + AI 诊断",
      expectedImpact: "巩固已有 GEO 基线并跟踪长期趋势。",
    });
  }

  return items.slice(0, 5);
}

function resolvePlanQuestion(maxProblemLine: string): string {
  const trimmed = maxProblemLine.trim();
  if (!trimmed || trimmed.startsWith("暂无")) return "当前高意向诊断问题";
  return trimmed;
}

export function buildNextRoundPlanItems(
  growthSuggestions: GeoGrowthSuggestion[],
  maxProblemLine: string,
  fallbackInput?: BuildDeliveryReportProductSnapshotInput,
): NextRoundPlanItem[] {
  const question = resolvePlanQuestion(maxProblemLine);

  if (growthSuggestions.length > 0) {
    return growthSuggestions.slice(0, 5).map((suggestion, index) =>
      mapGrowthSuggestionToPlanItem(suggestion, index + 1, question),
    );
  }

  if (fallbackInput) {
    return buildFallbackPlanItems(fallbackInput);
  }

  return [
    {
      priority: 1,
      action: "按诊断结论持续优化内容并安排复测",
      question,
      platform: "内容生产与发布中心",
      expectedImpact: "保持 GEO 可见度与推荐率的可持续提升。",
    },
  ];
}

export function buildInternalChecklist(
  input: Pick<
    BuildDeliveryReportProductSnapshotInput,
    | "profileCompletionPercent"
    | "hasAiTestData"
    | "generatedArticleCount"
    | "qualityScoredCount"
    | "publishedRecordCount"
    | "publishWithLinkCount"
    | "testRounds"
    | "insufficientReasonParts"
  >,
): InternalChecklistItem[] {
  const t0Done = hasCompletedT0Baseline(input.testRounds) || input.hasAiTestData;
  const t1Done = hasCompletedT1Retest(input.testRounds);
  const t2Done = hasCompletedT2Retest(input.testRounds);
  const t3Done = hasCompletedT3Retest(input.testRounds);
  const profileDone = input.profileCompletionPercent >= 80;
  const contentDone = input.generatedArticleCount > 0;
  const qualityDone = input.qualityScoredCount > 0;
  const publishTaskDone = input.publishedRecordCount > 0;
  const linkDone = input.publishWithLinkCount > 0;
  const retestStagesDone = t1Done || t2Done || t3Done;
  const reportDeliverable = t0Done && (linkDone || retestStagesDone);

  return [
    {
      id: "profile",
      label: "企业资料已完成",
      status: profileDone ? "已完成" : "待完成",
      blockReason: profileDone ? null : "企业资料完成度不足 80%",
      ctaPath: "/enterprise-profile",
      ctaLabel: "去建档",
    },
    {
      id: "t0",
      label: "T0 AI 诊断已完成",
      status: t0Done ? "已完成" : "待完成",
      blockReason: t0Done ? null : "尚未完成 AI 搜索 T0 基线实测",
      ctaPath: "/ai-diagnosis",
      ctaLabel: "去诊断",
    },
    {
      id: "content",
      label: "内容资产已生成",
      status: contentDone ? "已完成" : "待完成",
      blockReason: contentDone ? null : "尚未生成平台化内容资产",
      ctaPath: "/weekly",
      ctaLabel: "去生成",
    },
    {
      id: "quality",
      label: "内容已质检",
      status: qualityDone ? "已完成" : "待完成",
      blockReason: qualityDone ? null : "尚无已质检评分的内容",
      ctaPath: "/weekly",
      ctaLabel: "去质检",
    },
    {
      id: "publish-task",
      label: "发布任务已创建",
      status: publishTaskDone ? "已完成" : "待完成",
      blockReason: publishTaskDone ? null : "尚无发布登记记录",
      ctaPath: "/content-publishing",
      ctaLabel: "去发布",
    },
    {
      id: "public-link",
      label: "公开链接已回填",
      status: linkDone ? "已完成" : "待完成",
      blockReason: linkDone ? null : "发布完成后尚未回填公开链接",
      ctaPath: "/content-publishing",
      ctaLabel: "去回填链接",
    },
    {
      id: "retest-stages",
      label: "T1/T2/T3 复测状态",
      status: retestStagesDone ? "已完成" : "待完成",
      blockReason: retestStagesDone
        ? null
        : input.insufficientReasonParts.find(part => part.includes("T1")) ?? "尚未完成 T1 复测",
      ctaPath: "/inclusion-monitoring",
      ctaLabel: "去复测",
    },
    {
      id: "delivery",
      label: "报告可交付",
      status: reportDeliverable ? "已完成" : "待完成",
      blockReason: reportDeliverable ? null : "需先积累实测、发布或复测数据后再对外交付",
      ctaPath: "/delivery-reports",
      ctaLabel: "查看报告",
    },
  ];
}

function buildOutcomeCards(input: BuildDeliveryReportProductSnapshotInput): DeliveryOutcomeCard[] {
  const t0Round = findLatestCompletedRound(input.testRounds, "T0_BASELINE");
  const t0FinishedAt = t0Round?.finishedAt ?? findLatestT0FinishedAt(input.testRounds);
  const t0FinishedLabel = t0FinishedAt ? formatRetestPlanDate(t0FinishedAt) : COUNT_MISSING_LABEL;

  return [
    {
      id: "ai-test",
      title: "AI 搜索实测",
      metrics: [
        { label: "实测题量", value: formatCountDisplay(input.questionCount) },
        { label: "覆盖引擎", value: formatCountDisplay(input.engineCount) },
        { label: "最近实测", value: input.lastAiTestedAt ?? COUNT_MISSING_LABEL },
        { label: "T0 完成时间", value: t0FinishedLabel },
      ],
    },
    {
      id: "content",
      title: "内容资产",
      metrics: [
        { label: "已生成内容", value: formatCountDisplay(input.generatedArticleCount) },
        { label: "待发布内容", value: formatCountDisplay(input.publishableArticleCount) },
        { label: "已质检评分", value: formatCountDisplay(input.qualityScoredCount) },
        { label: "优先问题", value: resolvePlanQuestion(input.maxProblemLine) },
      ],
    },
    {
      id: "publish",
      title: "发布执行",
      metrics: [
        { label: "发布记录", value: formatCountDisplay(input.publishedRecordCount) },
        { label: "覆盖平台", value: formatCountDisplay(input.distinctPlatformCount) },
        { label: "已回填链接", value: formatCountDisplay(input.publishWithLinkCount) },
        { label: "待回填链接", value: formatCountDisplay(input.pendingLinkCount) },
      ],
    },
    {
      id: "retest",
      title: "复测监测",
      metrics: [
        { label: "已完成复测", value: formatCountDisplay(input.retestCompletedCount) },
        { label: "待复测任务", value: formatCountDisplay(input.retestPendingCount) },
        {
          label: "内容引用率",
          value:
            input.citationRate != null
              ? formatPercentDisplay(input.citationRate, true)
              : CITATION_MISSING_LABEL,
        },
        { label: "下次建议复测", value: input.nextRetestAtLabel ?? COUNT_MISSING_LABEL },
      ],
    },
  ];
}

function resolveInsufficientBanner(input: BuildDeliveryReportProductSnapshotInput): string | null {
  const parts = [...input.insufficientReasonParts];
  if (!input.hasAiTestData && !parts.some(part => part.includes("实测"))) {
    parts.push("尚未完成 AI 搜索实测");
  }
  if (input.visibilityScore == null && !parts.some(part => part.includes("GEO"))) {
    parts.push("尚无 GEO 综合评分");
  }
  const banner = buildInsufficientDataReason(parts);
  return banner || null;
}

function buildBossSummary(input: BuildDeliveryReportProductSnapshotInput): DeliveryReportBossSummary {
  return {
    title: buildDeliveryReportTitle(input.enterpriseName),
    deliveryPeriod: input.reportPeriod.trim() || "交付周期待更新",
    roundGoal: input.roundGoal.trim() || "提升 AI 搜索可见度",
    geoScoreLabel: formatVisibilityScore(input.visibilityScore),
    mentionRateLabel: formatPercentDisplay(input.mentionRate, input.hasAiTestData),
    recommendRateLabel: formatPercentDisplay(input.recommendRate, input.hasAiTestData),
    completedActions: joinLines(input.completedActionLines, "本轮执行记录将随主链路推进自动汇总。"),
    coreConclusion: input.conclusionLine.trim() || "完成实测与发布复测后将生成本轮 GEO 增长结论。",
    nextStepFocus: joinLines(input.nextStepFocusLines, "按下方建议推进下一轮优化与复测。"),
    insufficientBanner: resolveInsufficientBanner(input),
  };
}

function buildGeoAttribution(input: BuildDeliveryReportProductSnapshotInput) {
  const scoreExplanation =
    input.geoAttributionLines.find(line => line.trim()) ??
    (input.visibilityScore != null
      ? `当前 GEO 综合评分 ${input.visibilityScore} 分，由内容诊断与 AI 实测共同形成。`
      : "完成 AI 实测与内容诊断后将展示 GEO 分归因说明。");

  const lagging = input.laggingIndicatorLines.map(line => line.trim()).filter(Boolean);

  return {
    scoreExplanation,
    trendMessage: resolveTrendInsufficientMessage(input.testRounds),
    positiveLines: input.positiveIndicatorLines.map(line => line.trim()).filter(Boolean),
    laggingLines: lagging.length > 0 ? lagging : ["暂无明确拖后项，建议持续观察复测结果。"],
    nextPriority: resolvePlanQuestion(input.nextPriorityLine),
  };
}

export function buildDeliveryReportProductSnapshot(
  input: BuildDeliveryReportProductSnapshotInput,
): DeliveryReportProductSnapshot {
  const bossSummary = buildBossSummary(input);
  const reportStatusLabel = bossSummary.insufficientBanner
    ? "数据待补齐"
    : input.hasAiTestData
      ? "可对外分享"
      : "待完成实测";
  return {
    reportStatusLabel,
    bossSummary,
    outcomeCards: buildOutcomeCards(input),
    geoAttribution: buildGeoAttribution(input),
    contentEvidence: input.contentEvidenceRows,
    retestStages: buildRetestStageRows({
      testRounds: input.testRounds,
      hasAiTestData: input.hasAiTestData,
      mentionRate: input.mentionRate,
      recommendRate: input.recommendRate,
      citationRate: input.citationRate,
      latestPublishAt: input.latestPublishAt,
      publishWithLinkCount: input.publishWithLinkCount,
      retestedCount: input.retestCompletedCount,
      nextRetestAtLabel: input.nextRetestAtLabel,
    }),
    nextRoundPlan: buildNextRoundPlanItems(input.growthSuggestions, input.maxProblemLine, input),
    checklist: buildInternalChecklist(input),
  };
}

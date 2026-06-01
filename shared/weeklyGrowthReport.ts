import { normalizeAiTestResult } from "./aiTestEvidence";
import {
  type CalendarWeekRange,
  filterPublishRecordsInWeek,
  getCalendarWeekRange,
  isTimestampInWeek,
  pickNextWeekHealthBriefPriority,
  resolveGeoHealthBriefT0Flags,
  resolveT0MentionRatePercent,
  type GeoHealthBriefInput,
  type PublishRecordWeekRow,
} from "./geoHealthBrief";
import type { TestRoundSummary } from "./retestComparisonDisplay";

export type WeeklyGrowthReportInput = GeoHealthBriefInput & {
  reportWeekRange: CalendarWeekRange;
  newInclusionCount: number;
  mentionRatePriorWeek: number | null;
  mentionRateReportWeek: number | null;
};

export type WeeklyGrowthReportResult = {
  reportWeekRange: CalendarWeekRange;
  title: string;
  content: string;
  publishedCount: number;
  newInclusionCount: number;
  mentionRatePriorPercent: number | null;
  mentionRateReportPercent: number | null;
  thisWeekPriority: string;
};

/** 上一自然周（周一至周日，本地时区）。 */
export function getPreviousCalendarWeekRange(now: Date = new Date()): CalendarWeekRange {
  const thisWeekStart = getCalendarWeekRange(now).start;
  const anchor = new Date(thisWeekStart);
  anchor.setMilliseconds(anchor.getMilliseconds() - 1);
  return getCalendarWeekRange(anchor);
}

/** 上上周（用于提及率周环比）。 */
export function getWeekBeforePreviousCalendarWeekRange(now: Date = new Date()): CalendarWeekRange {
  const prevStart = getPreviousCalendarWeekRange(now).start;
  const anchor = new Date(prevStart);
  anchor.setMilliseconds(anchor.getMilliseconds() - 1);
  return getCalendarWeekRange(anchor);
}

export function buildWeeklyGrowthReportTitle(reportWeekRange: CalendarWeekRange): string {
  return `GEO 增长周报（${reportWeekRange.label}）`;
}

export function formatMentionRateChangeLine(
  priorPercent: number | null,
  reportPercent: number | null,
): string {
  const prior = priorPercent != null ? `${priorPercent}%` : "暂无";
  const current = reportPercent != null ? `${reportPercent}%` : "暂无";
  return `AI 提及率变化：${prior}→${current}`;
}

export function aggregateMentionRateInWeek(
  aiTestResultsRows: Array<{ aiTestResults?: unknown[] | null }>,
  range: CalendarWeekRange,
): number | null {
  let total = 0;
  let mentions = 0;
  for (const row of aiTestResultsRows) {
    const results = Array.isArray(row.aiTestResults) ? row.aiTestResults : [];
    for (const raw of results) {
      const item = normalizeAiTestResult(raw);
      if (!item || !isTimestampInWeek(item.testedAt, range)) continue;
      total += 1;
      if (item.mentionedBrand) mentions += 1;
    }
  }
  if (total === 0) return null;
  return mentions / total;
}

export function countNewInclusionsInWeek(
  rows: Array<{
    inclusionMonitorStatus?: string | null;
    lastCheckedAt?: Date | string | null;
  }>,
  range: CalendarWeekRange,
): number {
  return rows.filter(
    row =>
      (row.inclusionMonitorStatus ?? "").trim() === "已收录" &&
      isTimestampInWeek(row.lastCheckedAt, range),
  ).length;
}

export function buildWeeklyGrowthReportContent(input: WeeklyGrowthReportInput): WeeklyGrowthReportResult {
  const weeklyRecords = filterPublishRecordsInWeek(input.publishRecords, input.reportWeekRange);
  const publishedCount = weeklyRecords.length;
  const mentionRatePriorPercent = resolveT0MentionRatePercent(input.mentionRatePriorWeek);
  const mentionRateReportPercent = resolveT0MentionRatePercent(input.mentionRateReportWeek);
  const thisWeekPriority = pickNextWeekHealthBriefPriority({
    ...input,
    weekRange: getCalendarWeekRange(input.now),
  });

  const lines = [
    `上周（${input.reportWeekRange.label}）增长周报：`,
    "",
    `上周发布了 ${publishedCount} 篇内容`,
    `新增收录 ${input.newInclusionCount} 篇`,
    formatMentionRateChangeLine(mentionRatePriorPercent, mentionRateReportPercent),
    `本周建议优先做：${thisWeekPriority}`,
  ];

  return {
    reportWeekRange: input.reportWeekRange,
    title: buildWeeklyGrowthReportTitle(input.reportWeekRange),
    content: lines.join("\n"),
    publishedCount,
    newInclusionCount: input.newInclusionCount,
    mentionRatePriorPercent,
    mentionRateReportPercent,
    thisWeekPriority,
  };
}

export function buildWeeklyGrowthReportFromMetrics(input: {
  enterpriseName: string;
  now?: Date;
  publishRecords: PublishRecordWeekRow[];
  articles: Array<{ status?: string | null }>;
  monitoringRows: Array<{
    inclusionMonitorStatus?: string | null;
    lastCheckedAt?: Date | string | null;
    aiTestResults?: unknown[] | null;
  }>;
  testRounds: TestRoundSummary[];
  t0MentionRate: number | null;
  t0RecommendRate?: number | null;
  monitoringMentionRate?: number | null;
  monitoringRecommendRate?: number | null;
  contentGapLine?: string | null;
}): WeeklyGrowthReportResult {
  const now = input.now ?? new Date();
  const reportWeekRange = getPreviousCalendarWeekRange(now);
  const priorWeekRange = getWeekBeforePreviousCalendarWeekRange(now);
  const t0Flags = resolveGeoHealthBriefT0Flags(input.testRounds);

  const mentionRatePriorWeek = aggregateMentionRateInWeek(input.monitoringRows, priorWeekRange);
  const mentionRateReportWeek = aggregateMentionRateInWeek(input.monitoringRows, reportWeekRange);

  return buildWeeklyGrowthReportContent({
    enterpriseName: input.enterpriseName,
    now,
    weekRange: reportWeekRange,
    reportWeekRange,
    publishRecords: input.publishRecords,
    allPublishRecords: input.publishRecords,
    articles: input.articles,
    hasCompletedT0: t0Flags.hasCompletedT0,
    hasCompletedT1: t0Flags.hasCompletedT1,
    t0FinishedAt: t0Flags.t0FinishedAt,
    t0MentionRate: input.t0MentionRate,
    t0RecommendRate: input.t0RecommendRate,
    monitoringMentionRate: input.monitoringMentionRate,
    monitoringRecommendRate: input.monitoringRecommendRate,
    contentGapLine: input.contentGapLine,
    newInclusionCount: countNewInclusionsInWeek(input.monitoringRows, reportWeekRange),
    mentionRatePriorWeek,
    mentionRateReportWeek,
  });
}

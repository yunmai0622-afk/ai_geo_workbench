import {
  BRAND_MENTION_RATE_THRESHOLD,
  buildGeoGrowthSuggestions,
  countDistinctPublishPlatforms,
  countUnpublishedArticles,
  findLatestT0FinishedAt,
  INDUSTRY_RECOMMEND_RATE_THRESHOLD,
  type GeoGrowthSuggestion,
} from "./geoGrowthSuggestions";
import { findLatestCompletedRound, type TestRoundSummary } from "./retestComparisonDisplay";
import { hasCompletedT0Baseline, hasCompletedT1Retest } from "./workspaceMainChain";

export type CalendarWeekRange = {
  start: Date;
  end: Date;
  label: string;
};

export type PublishRecordWeekRow = {
  publishChannel?: string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type GeoHealthBriefInput = {
  enterpriseName: string;
  weekRange?: CalendarWeekRange;
  publishRecords: PublishRecordWeekRow[];
  t0MentionRate: number | null;
  t0RecommendRate?: number | null;
  hasCompletedT0: boolean;
  hasCompletedT1: boolean;
  t0FinishedAt: Date | string | null;
  articles: Array<{ status?: string | null }>;
  allPublishRecords: PublishRecordWeekRow[];
  monitoringMentionRate?: number | null;
  monitoringRecommendRate?: number | null;
  contentGapLine?: string | null;
  now?: Date;
};

export type GeoHealthBriefResult = {
  weekRange: CalendarWeekRange;
  publishedCount: number;
  platformCount: number;
  t0MentionRatePercent: number | null;
  nextWeekPriority: string;
  text: string;
};

function parseRecordDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatWeekDateLabel(date: Date): string {
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" });
}

/** 自然周：周一至周日（本地时区）。 */
export function getCalendarWeekRange(now: Date = new Date()): CalendarWeekRange {
  const anchor = new Date(now);
  anchor.setHours(0, 0, 0, 0);
  const day = anchor.getDay();
  const daysFromMonday = (day + 6) % 7;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: `${formatWeekDateLabel(start)} – ${formatWeekDateLabel(end)}`,
  };
}

export function isTimestampInWeek(
  value: Date | string | null | undefined,
  range: CalendarWeekRange,
): boolean {
  const d = parseRecordDate(value);
  if (!d) return false;
  return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
}

export function resolvePublishRecordWeekDate(record: PublishRecordWeekRow): Date | string | null {
  return record.publishedAt ?? record.createdAt ?? null;
}

export function filterPublishRecordsInWeek(
  records: PublishRecordWeekRow[],
  range: CalendarWeekRange,
): PublishRecordWeekRow[] {
  return records.filter(record => isTimestampInWeek(resolvePublishRecordWeekDate(record), range));
}

export function countDistinctPlatformsInWeek(
  records: PublishRecordWeekRow[],
  range: CalendarWeekRange,
): number {
  return countDistinctPublishPlatforms(filterPublishRecordsInWeek(records, range));
}

export function resolveT0MentionRatePercent(mentionRate: number | null | undefined): number | null {
  if (mentionRate == null || Number.isNaN(mentionRate)) return null;
  return Math.round(mentionRate * 100);
}

export function pickNextWeekHealthBriefPriority(input: GeoHealthBriefInput): string {
  const mentionRate =
    input.t0MentionRate ??
    (input.monitoringMentionRate != null ? input.monitoringMentionRate : null);
  const recommendRate = input.t0RecommendRate ?? input.monitoringRecommendRate ?? null;

  const growthSuggestions = buildGeoGrowthSuggestions({
    mentionRate,
    recommendRate,
    distinctPublishPlatformCount: countDistinctPublishPlatforms(input.allPublishRecords),
    unpublishedArticleCount: countUnpublishedArticles(input.articles),
    hasCompletedT0Baseline: input.hasCompletedT0,
    hasCompletedT1Retest: input.hasCompletedT1,
    t0FinishedAt: input.t0FinishedAt,
    now: input.now,
  });

  const weeklyPublished = filterPublishRecordsInWeek(
    input.publishRecords,
    input.weekRange ?? getCalendarWeekRange(input.now),
  ).length;

  if (!input.hasCompletedT0) {
    return "完成 T0 基线 AI 搜索实测，建立可对照的提及率基线";
  }

  const topGrowth = growthSuggestions[0];
  if (topGrowth) {
    return normalizeGrowthSuggestionToPriority(topGrowth);
  }

  if (weeklyPublished === 0) {
    return "完成本周内容发布并登记公开链接，形成可追踪资产";
  }

  const gap = (input.contentGapLine ?? "").trim();
  if (gap && !gap.includes("暂无")) {
    return gap.length > 80 ? `${gap.slice(0, 77)}…` : gap;
  }

  if (mentionRate != null && mentionRate < BRAND_MENTION_RATE_THRESHOLD) {
    return "补充 2-3 篇品牌认知类内容，强化「品牌名 + 品类 + 场景」实体信号";
  }

  if (recommendRate != null && recommendRate < INDUSTRY_RECOMMEND_RATE_THRESHOLD) {
    return "补充行业推荐类内容，提升 AI 推荐倾向";
  }

  return "持续更新高价值场景内容，并在 7-14 天后安排 T1 复测";
}

function normalizeGrowthSuggestionToPriority(suggestion: GeoGrowthSuggestion): string {
  switch (suggestion.id) {
    case "brand_awareness_content":
      return "补充品牌认知类内容，提升 AI 搜索中的品牌提及";
    case "industry_recommend_content":
      return "补充行业推荐类内容，提升 AI 推荐倾向";
    case "expand_cross_platform":
      return "扩展到搜狐号/百家号等多平台，增加交叉信源";
    case "t1_retest":
      return "执行 T1 复测，对照 T0 基线查看提及率变化";
    case "pending_publish":
      return `优先${suggestion.message.replace(/^有/, "发布")}`;
    default:
      return suggestion.message;
  }
}

export function buildGeoHealthBriefText(input: GeoHealthBriefInput): GeoHealthBriefResult {
  const weekRange = input.weekRange ?? getCalendarWeekRange(input.now);
  const weeklyRecords = filterPublishRecordsInWeek(input.publishRecords, weekRange);
  const publishedCount = weeklyRecords.length;
  const platformCount = countDistinctPlatformsInWeek(input.publishRecords, weekRange);
  const t0MentionRatePercent = input.hasCompletedT0
    ? resolveT0MentionRatePercent(input.t0MentionRate)
    : null;
  const nextWeekPriority = pickNextWeekHealthBriefPriority({ ...input, weekRange });

  const lines = [
    "【GEO 每周健康度简报】",
    `企业：${input.enterpriseName.trim() || "当前企业"}`,
    `周期：${weekRange.label}`,
    "",
    `本周发布了 ${publishedCount} 篇内容`,
    `覆盖 ${platformCount} 个平台`,
  ];

  if (t0MentionRatePercent != null) {
    lines.push(`AI 提及率：${t0MentionRatePercent}%（T0 基线实测）`);
  }

  lines.push("", `建议下周优先做：${nextWeekPriority}`);

  return {
    weekRange,
    publishedCount,
    platformCount,
    t0MentionRatePercent,
    nextWeekPriority,
    text: lines.join("\n"),
  };
}

export function resolveGeoHealthBriefT0Flags(rounds: TestRoundSummary[]): {
  hasCompletedT0: boolean;
  hasCompletedT1: boolean;
  t0FinishedAt: Date | string | null;
} {
  const baseRound = findLatestCompletedRound(rounds, "T0_BASELINE");
  return {
    hasCompletedT0: Boolean(baseRound) || hasCompletedT0Baseline(rounds),
    hasCompletedT1: hasCompletedT1Retest(rounds),
    t0FinishedAt: baseRound?.finishedAt ?? findLatestT0FinishedAt(rounds),
  };
}

import { getCalendarWeekRange, isTimestampInWeek } from "./geoHealthBrief";
import { isBindingPublishPlatform, PUBLISH_PLATFORM_LABELS } from "./platformAccountVerify";

export type PublishTaskStatsRow = {
  platform: string;
  status: string;
  createdAt: Date | string | null;
};

export type DeliveryReportPublishPlatformStat = {
  platform: string;
  label: string;
  count: number;
};

export type DeliveryReportPublishStats = {
  totalPublishCount: number;
  platformDistribution: DeliveryReportPublishPlatformStat[];
  successRatePercent: number | null;
  weekPublishCount: number;
  weekRangeLabel: string;
  completedCount: number;
  failedCount: number;
};

const EXTRA_PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信公众号",
};

export function publishPlatformDisplayLabel(platform: string): string {
  if (isBindingPublishPlatform(platform)) return PUBLISH_PLATFORM_LABELS[platform];
  return EXTRA_PLATFORM_LABELS[platform] ?? platform;
}

export function formatPlatformDistributionLine(stats: DeliveryReportPublishPlatformStat[]): string {
  if (stats.length === 0) return "暂无已发布内容";
  return stats.map(row => `${row.label} ${row.count}篇`).join(" / ");
}

export function formatPublishSuccessRatePercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${rate}%`;
}

/**
 * 基于 publish_tasks 行汇总交付报告发布统计。
 * - 总发布次数：项目下全部发布任务数
 * - 平台分布：status=completed 按 platform 计数
 * - 成功率：completed / (completed + failed)，无终态任务时为 null
 * - 本周发布：createdAt 落在当前自然周（周一至周日）内的任务数
 */
export function buildDeliveryReportPublishStats(
  rows: PublishTaskStatsRow[],
  now: Date = new Date(),
): DeliveryReportPublishStats {
  const weekRange = getCalendarWeekRange(now);
  let completedCount = 0;
  let failedCount = 0;
  let weekPublishCount = 0;
  const platformCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.status === "completed") {
      completedCount += 1;
      const key = row.platform.trim() || "unknown";
      platformCounts.set(key, (platformCounts.get(key) ?? 0) + 1);
    } else if (row.status === "failed") {
      failedCount += 1;
    }
    if (isTimestampInWeek(row.createdAt, weekRange)) {
      weekPublishCount += 1;
    }
  }

  const terminalCount = completedCount + failedCount;
  const successRatePercent =
    terminalCount > 0 ? Math.round((completedCount / terminalCount) * 100) : null;

  const platformDistribution = [...platformCounts.entries()]
    .map(([platform, count]) => ({
      platform,
      label: publishPlatformDisplayLabel(platform),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));

  return {
    totalPublishCount: rows.length,
    platformDistribution,
    successRatePercent,
    weekPublishCount,
    weekRangeLabel: weekRange.label,
    completedCount,
    failedCount,
  };
}

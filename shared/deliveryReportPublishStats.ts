import { getCalendarWeekRange, isTimestampInWeek } from "./geoHealthBrief";
import {
  BINDING_PUBLISH_PLATFORMS,
  isBindingPublishPlatform,
  PUBLISH_PLATFORM_LABELS,
} from "./platformAccountVerify";

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

export type PlatformPublishSuccessRateStat = {
  platform: string;
  label: string;
  successCount: number;
  failedCount: number;
  successRatePercent: number | null;
};

export type DeliveryReportPublishStats = {
  totalPublishCount: number;
  platformDistribution: DeliveryReportPublishPlatformStat[];
  platformSuccessRates: PlatformPublishSuccessRateStat[];
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

export function formatPlatformPublishSuccessRateLine(stat: PlatformPublishSuccessRateStat): string {
  const rate = formatPublishSuccessRatePercent(stat.successRatePercent);
  return `${stat.label}：成功${stat.successCount}次/失败${stat.failedCount}次（成功率${rate}）`;
}

/**
 * 按平台汇总 publish_tasks 终态（completed / failed）成功率。
 * 固定展示矩阵绑定平台；若存在其他 platform 且有任务记录，追加在末尾。
 */
export function buildPlatformPublishSuccessRates(
  rows: PublishTaskStatsRow[],
): PlatformPublishSuccessRateStat[] {
  const countsByPlatform = new Map<string, { success: number; failed: number }>();

  for (const row of rows) {
    const key = row.platform.trim() || "unknown";
    if (row.status === "completed") {
      const current = countsByPlatform.get(key) ?? { success: 0, failed: 0 };
      current.success += 1;
      countsByPlatform.set(key, current);
    } else if (row.status === "failed") {
      const current = countsByPlatform.get(key) ?? { success: 0, failed: 0 };
      current.failed += 1;
      countsByPlatform.set(key, current);
    }
  }

  const platformsWithRows = new Set(rows.map(row => row.platform.trim() || "unknown"));
  const extraPlatforms = [...platformsWithRows].filter(
    platform => !(BINDING_PUBLISH_PLATFORMS as readonly string[]).includes(platform),
  );
  extraPlatforms.sort((a, b) =>
    publishPlatformDisplayLabel(a).localeCompare(publishPlatformDisplayLabel(b), "zh-CN"),
  );

  const orderedPlatforms = [...BINDING_PUBLISH_PLATFORMS, ...extraPlatforms];

  return orderedPlatforms.map(platform => {
    const counts = countsByPlatform.get(platform) ?? { success: 0, failed: 0 };
    const terminalCount = counts.success + counts.failed;
    return {
      platform,
      label: publishPlatformDisplayLabel(platform),
      successCount: counts.success,
      failedCount: counts.failed,
      successRatePercent:
        terminalCount > 0 ? Math.round((counts.success / terminalCount) * 100) : null,
    };
  });
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
    platformSuccessRates: buildPlatformPublishSuccessRates(rows),
    successRatePercent,
    weekPublishCount,
    weekRangeLabel: weekRange.label,
    completedCount,
    failedCount,
  };
}

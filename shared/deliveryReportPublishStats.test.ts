import { describe, expect, it } from "vitest";
import {
  buildDeliveryReportPublishStats,
  formatPlatformDistributionLine,
  publishPlatformDisplayLabel,
} from "./deliveryReportPublishStats";
import { getCalendarWeekRange } from "./geoHealthBrief";

describe("deliveryReportPublishStats", () => {
  it("aggregates totals, platform distribution, success rate, and week count", () => {
    const week = getCalendarWeekRange(new Date("2026-06-01T12:00:00"));
    const inWeek = week.start;
    const outWeek = new Date(week.start);
    outWeek.setDate(outWeek.getDate() - 7);

    const stats = buildDeliveryReportPublishStats(
      [
        { platform: "zhihu", status: "completed", createdAt: inWeek },
        { platform: "zhihu", status: "completed", createdAt: inWeek },
        { platform: "sohu", status: "completed", createdAt: outWeek },
        { platform: "baijiahao", status: "failed", createdAt: inWeek },
        { platform: "toutiao", status: "pending_agent", createdAt: inWeek },
      ],
      new Date("2026-06-01T12:00:00"),
    );

    expect(stats.totalPublishCount).toBe(5);
    expect(stats.completedCount).toBe(3);
    expect(stats.failedCount).toBe(1);
    expect(stats.successRatePercent).toBe(75);
    expect(stats.weekPublishCount).toBe(4);
    expect(stats.platformDistribution).toEqual([
      { platform: "zhihu", label: "知乎", count: 2 },
      { platform: "sohu", label: "搜狐号", count: 1 },
    ]);
    expect(formatPlatformDistributionLine(stats.platformDistribution)).toBe("知乎 2篇 / 搜狐号 1篇");
  });

  it("returns null success rate when no terminal tasks", () => {
    const stats = buildDeliveryReportPublishStats([
      { platform: "zhihu", status: "pending_agent", createdAt: new Date() },
    ]);
    expect(stats.successRatePercent).toBeNull();
    expect(stats.platformDistribution).toEqual([]);
  });

  it("maps platform labels", () => {
    expect(publishPlatformDisplayLabel("zhihu")).toBe("知乎");
    expect(publishPlatformDisplayLabel("wechat")).toBe("微信公众号");
    expect(publishPlatformDisplayLabel("custom")).toBe("custom");
  });
});

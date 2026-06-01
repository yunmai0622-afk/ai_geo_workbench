import { describe, expect, it } from "vitest";
import {
  buildDeliveryReportPublishStats,
  buildPlatformPublishSuccessRates,
  formatPlatformDistributionLine,
  formatPlatformPublishSuccessRateLine,
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
    expect(stats.platformSuccessRates.find(row => row.platform === "zhihu")).toMatchObject({
      label: "知乎",
      successCount: 2,
      failedCount: 0,
      successRatePercent: 100,
    });
    expect(stats.platformSuccessRates.find(row => row.platform === "baijiahao")).toMatchObject({
      successCount: 0,
      failedCount: 1,
      successRatePercent: 0,
    });
    expect(formatPlatformPublishSuccessRateLine(stats.platformSuccessRates[0]!)).toBe(
      "知乎：成功2次/失败0次（成功率100%）",
    );
  });

  it("lists binding platforms and computes per-platform success rates", () => {
    const rates = buildPlatformPublishSuccessRates([
      { platform: "zhihu", status: "completed", createdAt: new Date() },
      { platform: "zhihu", status: "failed", createdAt: new Date() },
      { platform: "sohu", status: "failed", createdAt: new Date() },
      { platform: "wechat", status: "completed", createdAt: new Date() },
    ]);

    expect(rates.map(row => row.platform)).toEqual([
      "zhihu",
      "sohu",
      "toutiao",
      "baijiahao",
      "netease",
      "wechat",
    ]);
    expect(rates.find(row => row.platform === "zhihu")).toMatchObject({
      successCount: 1,
      failedCount: 1,
      successRatePercent: 50,
    });
    expect(rates.find(row => row.platform === "toutiao")).toMatchObject({
      successCount: 0,
      failedCount: 0,
      successRatePercent: null,
    });
    expect(formatPlatformPublishSuccessRateLine(rates.find(row => row.platform === "sohu")!)).toBe(
      "搜狐号：成功0次/失败1次（成功率0%）",
    );
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

import { describe, expect, it } from "vitest";
import {
  aggregateMentionRateInWeek,
  buildWeeklyGrowthReportContent,
  buildWeeklyGrowthReportFromMetrics,
  countNewInclusionsInWeek,
  formatMentionRateChangeLine,
  getPreviousCalendarWeekRange,
  getWeekBeforePreviousCalendarWeekRange,
} from "./weeklyGrowthReport";

describe("weeklyGrowthReport", () => {
  const now = new Date("2026-06-01T10:00:00");

  it("resolves previous and week-before-previous ranges on Monday", () => {
    const lastWeek = getPreviousCalendarWeekRange(now);
    const weekBefore = getWeekBeforePreviousCalendarWeekRange(now);
    expect(lastWeek.label).toContain("2026");
    expect(weekBefore.end.getTime()).toBeLessThan(lastWeek.start.getTime());
  });

  it("counts inclusions and mention rates by week", () => {
    const lastWeek = getPreviousCalendarWeekRange(now);
    const weekBefore = getWeekBeforePreviousCalendarWeekRange(now);
    const rows = [
      {
        inclusionMonitorStatus: "已收录",
        lastCheckedAt: "2026-05-28T12:00:00",
        aiTestResults: [
          { testedAt: "2026-05-28T12:00:00", mentionedBrand: true, mentionsBrand: true, answer: "a" },
          { testedAt: "2026-05-20T12:00:00", mentionedBrand: false, mentionsBrand: false, answer: "b" },
        ],
      },
    ];
    expect(countNewInclusionsInWeek(rows, lastWeek)).toBe(1);
    expect(aggregateMentionRateInWeek(rows, lastWeek)).toBe(1);
    expect(aggregateMentionRateInWeek(rows, weekBefore)).toBe(0);
  });

  it("builds customer-facing report lines", () => {
    const reportWeekRange = getPreviousCalendarWeekRange(now);
    const result = buildWeeklyGrowthReportContent({
      enterpriseName: "示例品牌",
      reportWeekRange,
      publishRecords: [{ publishChannel: "知乎", publishedAt: "2026-05-28T08:00:00" }],
      allPublishRecords: [{ publishChannel: "知乎", publishedAt: "2026-05-28T08:00:00" }],
      articles: [{ status: "草稿" }],
      hasCompletedT0: true,
      hasCompletedT1: false,
      t0FinishedAt: "2026-05-01",
      t0MentionRate: 0.1,
      newInclusionCount: 2,
      mentionRatePriorWeek: 0.1,
      mentionRateReportWeek: 0.25,
      now,
    });

    expect(result.content).toContain("上周发布了 1 篇内容");
    expect(result.content).toContain("新增收录 2 篇");
    expect(result.content).toContain("AI 提及率变化：10%→25%");
    expect(result.content).toContain("本周建议优先做：");
    expect(formatMentionRateChangeLine(null, 18)).toBe("AI 提及率变化：暂无→18%");
  });

  it("builds from aggregated project metrics", () => {
    const result = buildWeeklyGrowthReportFromMetrics({
      enterpriseName: "示例品牌",
      now,
      publishRecords: [],
      articles: [],
      monitoringRows: [],
      testRounds: [],
      t0MentionRate: null,
    });
    expect(result.title).toContain("GEO 增长周报");
    expect(result.content).toContain("上周发布了 0 篇内容");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildGeoHealthBriefText,
  filterPublishRecordsInWeek,
  getCalendarWeekRange,
  pickNextWeekHealthBriefPriority,
} from "./geoHealthBrief";

describe("geoHealthBrief", () => {
  const now = new Date("2026-05-30T12:00:00");
  const weekRange = getCalendarWeekRange(now);

  it("filters publish records in current calendar week", () => {
    const inWeek = filterPublishRecordsInWeek(
      [
        { publishChannel: "知乎", publishedAt: "2026-05-30T08:00:00" },
        { publishChannel: "百家号", publishedAt: "2026-05-20T08:00:00" },
      ],
      weekRange,
    );
    expect(inWeek).toHaveLength(1);
    expect(inWeek[0]?.publishChannel).toBe("知乎");
  });

  it("builds brief text with T0 mention rate when available", () => {
    const result = buildGeoHealthBriefText({
      enterpriseName: "示例品牌",
      weekRange,
      publishRecords: [{ publishChannel: "知乎", publishedAt: "2026-05-30T08:00:00" }],
      allPublishRecords: [{ publishChannel: "知乎" }, { publishChannel: "百家号" }],
      articles: [],
      hasCompletedT0: true,
      hasCompletedT1: false,
      t0FinishedAt: "2026-05-01",
      t0MentionRate: 0.18,
      t0RecommendRate: 0.04,
      now,
    });

    expect(result.text).toContain("本周发布了 1 篇内容");
    expect(result.text).toContain("覆盖 1 个平台");
    expect(result.text).toContain("AI 提及率：18%（T0 基线实测）");
    expect(result.text).toContain("建议下周优先做：");
    expect(result.platformCount).toBe(1);
  });

  it("omits mention rate line when no T0 data", () => {
    const result = buildGeoHealthBriefText({
      enterpriseName: "示例品牌",
      weekRange,
      publishRecords: [],
      allPublishRecords: [],
      articles: [],
      hasCompletedT0: false,
      hasCompletedT1: false,
      t0FinishedAt: null,
      t0MentionRate: null,
      now,
    });

    expect(result.text).not.toContain("AI 提及率");
    expect(
      pickNextWeekHealthBriefPriority({
        enterpriseName: "示例品牌",
        publishRecords: [],
        allPublishRecords: [],
        articles: [],
        hasCompletedT0: false,
        hasCompletedT1: false,
        t0FinishedAt: null,
        t0MentionRate: null,
      }),
    ).toContain("T0 基线");
  });
});

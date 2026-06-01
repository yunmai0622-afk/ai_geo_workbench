import { describe, expect, it } from "vitest";
import {
  buildGeoGrowthSuggestions,
  countDistinctPublishPlatforms,
  countUnpublishedArticles,
  findLatestT0FinishedAt,
  shouldSuggestT1Retest,
} from "./geoGrowthSuggestions";

describe("geoGrowthSuggestions", () => {
  it("counts distinct publish platforms", () => {
    expect(
      countDistinctPublishPlatforms([
        { publishChannel: "知乎" },
        { publishChannel: "知乎" },
        { publishChannel: "百家号" },
        { publishChannel: "" },
      ]),
    ).toBe(2);
  });

  it("counts unpublished articles", () => {
    expect(
      countUnpublishedArticles([
        { status: "已发布" },
        { status: "已生成" },
        { status: "质检通过" },
      ]),
    ).toBe(2);
  });

  it("finds latest completed T0 finishedAt", () => {
    const at = findLatestT0FinishedAt([
      { roundType: "T0_BASELINE", status: "completed", finishedAt: "2026-01-01" },
      { roundType: "T0_BASELINE", status: "completed", finishedAt: "2026-02-01" },
      { roundType: "T1_RETEST", status: "completed", finishedAt: "2026-03-01" },
    ]);
    expect(at).toBe("2026-02-01");
  });

  it("suggests T1 when T0 finished more than 14 days ago", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(
      shouldSuggestT1Retest({
        hasCompletedT0Baseline: true,
        hasCompletedT1Retest: false,
        t0FinishedAt: "2026-05-01T12:00:00Z",
        now,
      }),
    ).toBe(true);
    expect(
      shouldSuggestT1Retest({
        hasCompletedT0Baseline: true,
        hasCompletedT1Retest: false,
        t0FinishedAt: "2026-05-20T12:00:00Z",
        now,
      }),
    ).toBe(false);
  });

  it("builds all applicable suggestions", () => {
    const suggestions = buildGeoGrowthSuggestions({
      mentionRate: 0.05,
      recommendRate: 0.02,
      distinctPublishPlatformCount: 1,
      unpublishedArticleCount: 3,
      hasCompletedT0Baseline: true,
      hasCompletedT1Retest: false,
      t0FinishedAt: "2026-01-01",
      now: new Date("2026-06-01"),
    });
    expect(suggestions.map(s => s.id)).toEqual([
      "brand_awareness_content",
      "industry_recommend_content",
      "expand_cross_platform",
      "t1_retest",
      "pending_publish",
    ]);
    expect(suggestions.find(s => s.id === "pending_publish")?.message).toBe("有3篇内容待发布");
  });

  it("returns empty when metrics are healthy", () => {
    expect(
      buildGeoGrowthSuggestions({
        mentionRate: 0.5,
        recommendRate: 0.2,
        distinctPublishPlatformCount: 3,
        unpublishedArticleCount: 0,
        hasCompletedT0Baseline: true,
        hasCompletedT1Retest: true,
        t0FinishedAt: "2026-01-01",
        now: new Date("2026-06-01"),
      }),
    ).toEqual([]);
  });
});

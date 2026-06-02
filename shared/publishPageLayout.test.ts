import { describe, expect, it } from "vitest";
import {
  buildPublishPagePlatformCards,
  buildWeeklyPublishOverviewStats,
  PUBLISH_PAGE_PLATFORM_ORDER,
} from "./publishPageLayout";

describe("publishPageLayout", () => {
  it("uses customer platform card order", () => {
    expect(PUBLISH_PAGE_PLATFORM_ORDER).toEqual([
      "zhihu",
      "baijiahao",
      "toutiao",
      "sohu",
      "xiaohongshu",
      "netease",
      "wechat",
      "other",
    ]);
  });

  it("aggregates weekly overview counts", () => {
    const stats = buildWeeklyPublishOverviewStats({
      articles: [
        { id: 1, title: "A", status: "审核通过", targetPlatform: "知乎" },
        { id: 2, title: "B", status: "已发布", targetPlatform: "百家号", publishedAt: "2026-06-01T10:00:00.000Z" },
      ],
      qualityByArticleId: new Map([
        [1, { articleId: 1, totalScore: 85, blocked: false }],
        [2, { articleId: 2, totalScore: 90, blocked: false }],
      ]),
      minPassScore: 80,
      publishRecords: [
        {
          id: 10,
          articleId: 2,
          publishChannel: "百家号",
          publishStatus: "link_backfilled",
          publishedAt: "2026-06-01T12:00:00.000Z",
        },
      ],
      publishTasks: [],
      now: new Date("2026-06-02T08:00:00.000Z"),
    });
    expect(stats.generatedCount).toBeGreaterThanOrEqual(1);
    expect(stats.publishedCount).toBe(1);
    expect(stats.lastPublishedAt).toBeTruthy();
  });

  it("marks failed platform task with customer failure reason", () => {
    const cards = buildPublishPagePlatformCards({
      articles: [{ id: 1, title: "知乎稿", targetPlatform: "知乎", status: "审核通过" }],
      qualityByArticleId: new Map([[1, { articleId: 1, totalScore: 88, blocked: false }]]),
      minPassScore: 80,
      publishRecords: [],
      publishTasks: [
        {
          id: 9,
          articleId: 1,
          platform: "zhihu",
          status: "failed",
          agentErrorType: "editor_not_found",
          canRetry: true,
        },
      ],
      accountGroups: [{ platform: "zhihu", accounts: [{ isEnabled: true }] }],
    });
    const zhihu = cards.find(c => c.key === "zhihu");
    expect(zhihu?.status).toBe("failed");
    expect(zhihu?.failureReason).toContain("编辑器");
    expect(zhihu?.canRetry).toBe(true);
    expect(zhihu?.weeklyTitlePreview).toBe("知乎稿");
  });
});

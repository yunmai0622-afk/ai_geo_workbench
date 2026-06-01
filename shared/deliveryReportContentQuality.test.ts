import { describe, expect, it } from "vitest";
import {
  buildDeliveryReportContentQualitySummary,
  formatContentQualityPlatformDistributionLine,
  isGeoArticleQualityScorePass,
} from "./deliveryReportContentQuality";

describe("deliveryReportContentQuality", () => {
  it("computes average score and platform distribution for generated articles", () => {
    const summary = buildDeliveryReportContentQualitySummary(
      [
        { id: 1, title: "文章 A", status: "已生成", targetPlatformLabel: "知乎" },
        { id: 2, title: "文章 B", status: "质检通过", targetPlatformLabel: "知乎" },
        { id: 3, title: "未生成", status: "待生成", targetPlatformLabel: "公众号" },
      ],
      [
        { articleId: 1, totalScore: 50, blocked: 0, blockReasons: [], reviewSummary: "需补案例" },
        { articleId: 2, totalScore: 80, blocked: 0, blockReasons: [], reviewSummary: "可发布" },
      ],
      { minPassScore: 60 },
    );

    expect(summary.generatedArticleCount).toBe(2);
    expect(summary.scoredArticleCount).toBe(2);
    expect(summary.averageScore).toBe(65);
    expect(summary.platformDistribution).toHaveLength(1);
    expect(summary.platformDistribution[0]).toMatchObject({
      platformLabel: "知乎",
      articleCount: 2,
      averageScore: 65,
      passCount: 1,
      failCount: 1,
    });
    expect(summary.failedItems).toHaveLength(1);
    expect(summary.failedItems[0]?.title).toBe("文章 A");
    expect(summary.priorityItems[0]?.articleId).toBe(1);
  });

  it("treats compliance block reasons as failed even when score is high", () => {
    expect(
      isGeoArticleQualityScorePass(
        { totalScore: 90, blocked: 0, blockReasons: ["含禁用词表述"] },
        60,
      ),
    ).toBe(false);
  });

  it("formats platform distribution line for empty and populated stats", () => {
    expect(formatContentQualityPlatformDistributionLine([])).toBe("暂无已评分内容");
    expect(
      formatContentQualityPlatformDistributionLine([
        {
          platformLabel: "知乎",
          articleCount: 2,
          averageScore: 70,
          passCount: 1,
          failCount: 1,
        },
      ]),
    ).toContain("知乎 2篇");
  });
});

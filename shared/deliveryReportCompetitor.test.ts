import { describe, expect, it } from "vitest";
import { buildCompetitorPlatformMatrix, mapCompetitorAnalysisForDeliveryReport } from "./deliveryReportCompetitor";

describe("deliveryReportCompetitor", () => {
  it("maps competitor analysis summary to customer-safe payload", () => {
    const payload = mapCompetitorAnalysisForDeliveryReport({
      brandName: "海豚知道",
      brandAiMentionCount: 3,
      totalAiTestRuns: 12,
      competitors: [
        {
          competitorName: "小鹅通",
          aiMentionCount: 5,
          advantageDescription: "课程交付成熟",
          platformDistribution: { zhihu: true, sohu: false, baijiahao: true, toutiao: false, wechat: false },
        },
      ],
      contentSuggestions: ["建议补充竞品对比页"],
    });
    expect(payload.brandAiMentionCount).toBe(3);
    expect(payload.competitors[0]?.platformLabels).toEqual(["知乎", "百家号"]);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("platformDistribution");
    expect(serialized).not.toContain("competitor_profiles");
  });

  it("builds platform matrix from platform labels", () => {
    const matrix = buildCompetitorPlatformMatrix([
      {
        competitorName: "小鹅通",
        aiMentionCount: 2,
        advantageDescription: "",
        platformLabels: ["知乎", "百家号"],
      },
      {
        competitorName: "有赞",
        aiMentionCount: 1,
        advantageDescription: "",
        platformLabels: ["知乎"],
      },
    ]);
    const zhihu = matrix.find(row => row.platformLabel === "知乎");
    expect(zhihu?.competitorNames).toEqual(["小鹅通", "有赞"]);
  });
});

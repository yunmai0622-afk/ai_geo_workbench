import { describe, expect, it } from "vitest";
import { buildInitialInclusionMonitoringRecord, initialMonitoringSuggestions } from "./geoMonitoring";

describe("geo inclusion monitoring payload", () => {
  it("creates an auditable initial monitoring record after publishing", () => {
    const record = buildInitialInclusionMonitoringRecord({
      projectId: 12,
      articleId: 34,
      publishRecordId: 56,
      publicUrl: "/geo/content/12/34",
      qualityScore: 86,
    });

    expect(record).toMatchObject({
      projectId: 12,
      articleId: 34,
      publishRecordId: 56,
      publicUrl: "/geo/content/12/34",
      inclusionStatus: "未检测",
      aiMentionStatus: "未检测",
      aiRecommendStatus: "未检测",
    });
    expect(record.optimizationSuggestions).toEqual(initialMonitoringSuggestions);
    expect(record.rawJson).toMatchObject({
      source: "publish_geo_content_page",
      qualityScore: 86,
      needRetest: true,
      createdBy: "geo.articles.publish",
    });
    expect(record.currentSuggestion).toContain("已进入收录监测");
  });
});

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
      inclusionMonitorStatus: "未检测",
      aiMentionMonitorStatus: "未检测",
      aiRecommendMonitorStatus: "未检测",
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

  it("supports agent publish auto-backfill metadata", () => {
    const record = buildInitialInclusionMonitoringRecord({
      projectId: 1,
      articleId: 2,
      publishRecordId: 3,
      publicUrl: "https://zhuanlan.zhihu.com/p/123",
      qualityScore: 80,
      rawJsonSource: "agent_publish_completed",
      rawJsonCreatedBy: "agent.reportAgentTaskResult",
    });
    expect(record.inclusionMonitorStatus).toBe("未检测");
    expect(record.rawJson).toMatchObject({
      source: "agent_publish_completed",
      createdBy: "agent.reportAgentTaskResult",
    });
  });
});

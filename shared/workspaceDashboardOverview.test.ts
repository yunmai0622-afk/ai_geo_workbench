import { describe, expect, it } from "vitest";
import { formatWorkspaceAiMentionRate, formatWorkspaceOverviewValues } from "./workspaceDashboardOverview";
import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";

function baseMetrics(overrides: Partial<WorkspaceSummaryMetrics> = {}): WorkspaceSummaryMetrics {
  return {
    profileCompletionPercent: 80,
    boundPublishAccountCount: 1,
    expiredSessionAccountCount: 0,
    articleCount: 3,
    publishRecordCount: 2,
    publishTaskCount: 1,
    completedPublishTaskCount: 1,
    retestPendingCount: 0,
    rewriteOpenCount: 0,
    aiTestResultCount: 5,
    monitoringRecordCount: 1,
    retestComparisonCount: 0,
    reportCount: 0,
    geoScore: 72,
    brandMentionRate: 0.4,
    recommendRate: 0.2,
    lowQualityArticleCount: 0,
    hasAnalysis: true,
    hasGeoScore: true,
    hasCompletedT0Baseline: true,
    hasCompletedT1Retest: false,
    showT1RetestAutoTriggerReminder: false,
    retestPlan: { publishAt: null, publishAtLabel: null, milestones: [], nextSuggestion: null },
    retestDueReminder: null,
    p0ProfileComplete: true,
    ...overrides,
  };
}

describe("GEO-V1.1-Dashboard-Overview 工作台数据总览", () => {
  it("格式化四项核心指标", () => {
    const values = formatWorkspaceOverviewValues(baseMetrics());
    expect(values.articleCountText).toBe("3篇");
    expect(values.publishCountText).toBe("2次");
    expect(values.aiMentionRateText).toBe("40%");
    expect(values.geoScoreText).toBe("72分");
  });

  it("无实测样本时 AI 提及率显示占位", () => {
    expect(
      formatWorkspaceAiMentionRate(
        baseMetrics({ brandMentionRate: 0.4, aiTestResultCount: 0 }),
      ),
    ).toBe("--");
  });

  it("无 GEO 评分时显示占位", () => {
    expect(formatWorkspaceOverviewValues(baseMetrics({ geoScore: null })).geoScoreText).toBe("--");
  });
});

import { describe, expect, it } from "vitest";
import { buildRetestPlan } from "./retestPlan";
import { resolvePageNextActionSuggestion } from "./pageNextActionSuggestion";
import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";

function baseMetrics(overrides: Partial<WorkspaceSummaryMetrics> = {}): WorkspaceSummaryMetrics {
  return {
    profileCompletionPercent: 40,
    boundPublishAccountCount: 0,
    expiredSessionAccountCount: 0,
    articleCount: 0,
    publishRecordCount: 0,
    publishRecordWithPublicUrlCount: 0,
    waitingPublicLinkCount: 0,
    publishTaskCount: 0,
    completedPublishTaskCount: 0,
    retestPendingCount: 0,
    rewriteOpenCount: 0,
    aiTestResultCount: 0,
    monitoringRecordCount: 0,
    retestComparisonCount: 0,
    reportCount: 0,
    geoScore: null,
    brandMentionRate: null,
    recommendRate: null,
    lowQualityArticleCount: 0,
    hasAnalysis: false,
    hasGeoScore: false,
    hasCompletedT0Baseline: false,
    hasCompletedT1Retest: false,
    showT1RetestAutoTriggerReminder: false,
    retestPlan: buildRetestPlan({ completedPublishTasks: [], testRounds: [] }),
    retestDueReminder: null,
    p0ProfileComplete: false,
    t0ContentGapSuggestions: null,
    ...overrides,
  };
}

describe("GEO-V1.1-GlobalNavFix pageNextActionSuggestion", () => {
  it("品牌建档页展示建档完成度建议", () => {
    const suggestion = resolvePageNextActionSuggestion(
      "/enterprise-profile",
      baseMetrics({ profileCompletionPercent: 35 }),
    );
    expect(suggestion?.ctaLabel).toContain("建档");
    expect(suggestion?.reason).toContain("35%");
  });

  it("诊断页展示内容缺口建议", () => {
    const suggestion = resolvePageNextActionSuggestion(
      "/ai-diagnosis",
      baseMetrics({
        hasCompletedT0Baseline: true,
        hasGeoScore: true,
        geoScore: 62,
        t0ContentGapSuggestions: {
          headline: "竞品对比类问题提及不足",
          summaryLine: "",
          items: [{ id: "1", message: "m", weeklyPlatform: null, questionType: null, actionPath: "/weekly" }],
          roundId: "1",
          dataSource: "ai_test_runs",
        },
      }),
    );
    expect(suggestion?.ctaLabel).toContain("缺口");
    expect(suggestion?.reason).toContain("竞品对比");
  });

  it("内容资产页引导发布", () => {
    const suggestion = resolvePageNextActionSuggestion(
      "/weekly",
      baseMetrics({ p0ProfileComplete: true, articleCount: 3 }),
    );
    expect(suggestion?.ctaLabel).toContain("发布");
    expect(suggestion?.reason).toContain("3");
  });
});

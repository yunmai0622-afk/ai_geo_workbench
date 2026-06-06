import { describe, expect, it } from "vitest";
import {
  buildDeliveryReportProductSnapshot,
  computeDeliveryDataCompleteness,
  buildInsufficientDataReason,
  buildRetestStageRows,
  resolveTrendInsufficientMessage,
  T0_ONLY_TREND_INSUFFICIENT_MESSAGE,
} from "./deliveryReportReadability";

describe("deliveryReportReadability", () => {
  const baseInput = {
    enterpriseName: "测试企业",
    reportPeriod: "截至 2026-06-06",
    roundGoal: "第 1 轮诊断",
    visibilityScore: 72,
    mentionRate: 0.35,
    recommendRate: 0.12,
    hasAiTestData: true,
    conclusionLine: "本轮已形成可对照基线。",
    completedActionLines: ["完成 5 次 AI 实测"],
    nextStepFocusLines: ["补充 2 篇内容"],
    insufficientReasonParts: [] as string[],
    questionCount: 5,
    engineCount: 3,
    lastAiTestedAt: "2026-06-05",
    generatedArticleCount: 4,
    publishableArticleCount: 1,
    publishedRecordCount: 3,
    distinctPlatformCount: 2,
    publishWithLinkCount: 1,
    pendingLinkCount: 2,
    retestCompletedCount: 0,
    retestPendingCount: 1,
    nextRetestAtLabel: "2026-06-09",
    geoAttributionLines: ["当前 GEO 分为 72。"],
    positiveIndicatorLines: ["品牌提及率较 T0 提升"],
    laggingIndicatorLines: ["推荐率仍偏低"],
    nextPriorityLine: "补充推荐型内容",
    contentEvidenceRows: [],
    testRounds: [{ id: 1, roundType: "T0_BASELINE", status: "completed", roundName: "T0", finishedAt: "2026-06-01" }],
    citationRate: 0.2,
    latestPublishAt: "2026-06-01",
    growthSuggestions: [],
    maxProblemLine: "知识付费转化率低怎么办",
    profileCompletionPercent: 90,
    qualityScoredCount: 2,
  };

  it("builds boss summary on first screen", () => {
    const snapshot = buildDeliveryReportProductSnapshot(baseInput);
    expect(snapshot.bossSummary.title).toContain("GEO 增长交付报告");
    expect(snapshot.bossSummary.geoScoreLabel).toBe("72");
    expect(snapshot.bossSummary.coreConclusion).toContain("可对照基线");
  });

  it("shows T0-only trend insufficient message", () => {
    const message = resolveTrendInsufficientMessage(baseInput.testRounds);
    expect(message).toBe(T0_ONLY_TREND_INSUFFICIENT_MESSAGE);
    const snapshot = buildDeliveryReportProductSnapshot(baseInput);
    expect(snapshot.geoAttribution.trendMessage).toBe(T0_ONLY_TREND_INSUFFICIENT_MESSAGE);
  });

  it("explains missing public links in retest stages", () => {
    const stages = buildRetestStageRows({
      testRounds: baseInput.testRounds,
      hasAiTestData: true,
      mentionRate: 0.35,
      recommendRate: 0.12,
      citationRate: 0.2,
      latestPublishAt: "2026-06-01",
      publishWithLinkCount: 0,
      retestedCount: 0,
    });
    const t1 = stages.find(s => s.stageKey === "T1");
    expect(t1?.emptyReason).toContain("公开链接");
  });

  it("builds insufficient data banner with reasons", () => {
    const banner = buildInsufficientDataReason(["尚未完成发布链接回填", "尚未完成 T1 复测"]);
    expect(banner).toContain("尚未完成发布链接回填");
    expect(banner).toContain("尚未完成 T1 复测");
  });

  it("does not fabricate retest completion", () => {
    const stages = buildRetestStageRows({
      testRounds: [],
      hasAiTestData: false,
      mentionRate: null,
      recommendRate: null,
      citationRate: null,
      latestPublishAt: null,
      publishWithLinkCount: 0,
      retestedCount: 0,
    });
    expect(stages.every(s => s.statusLabel !== "已完成" || s.stageKey === "T0")).toBe(true);
  });

  it("includes geo attribution and next round plan modules", () => {
    const snapshot = buildDeliveryReportProductSnapshot(baseInput);
    expect(snapshot.geoAttribution.scoreExplanation).toBeTruthy();
    expect(snapshot.nextRoundPlan.length).toBeGreaterThan(0);
    expect(snapshot.checklist.length).toBeGreaterThanOrEqual(8);
  });

  it("computes delivery data completeness label", () => {
    expect(computeDeliveryDataCompleteness([])).toEqual({
      isComplete: true,
      pendingCount: 0,
      label: "数据完整度：已满足交付条件",
    });
    expect(computeDeliveryDataCompleteness(["尚未完成 T1 复测", "尚未完成发布链接回填"])).toEqual({
      isComplete: false,
      pendingCount: 2,
      label: "数据完整度：待补齐 2 项关键数据",
    });
  });
});

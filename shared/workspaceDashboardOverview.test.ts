import { describe, expect, it } from "vitest";
import {
  buildGeoScoreAttributionLines,
  buildGeoScoreChangeReason,
  formatGeoScoreChangeBadge,
  formatWorkspaceAiMentionRate,
  formatWorkspaceOverviewValues,
} from "./workspaceDashboardOverview";
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

  it("归因说明覆盖低提及、零推荐与内容覆盖不足", () => {
    expect(
      buildGeoScoreAttributionLines(
        baseMetrics({
          brandMentionRate: 0.1,
          recommendRate: 0,
          articleCount: 0,
        }),
      ),
    ).toEqual([
      "品牌提及率低：影响分数",
      "推荐率为 0：影响分数",
      "内容覆盖不足：影响分数",
      "数据来源：真实诊断数据",
    ]);
  });

  it("较上次变化文案按最新与上次分计算", () => {
    expect(formatGeoScoreChangeBadge({ latestScore: 25, previousScore: 23 })).toBe("较上次 +2");
    expect(formatGeoScoreChangeBadge({ latestScore: 23, previousScore: 25 })).toBe("较上次 -2");
  });

  it("变化原因在无风险项时给默认说明", () => {
    expect(buildGeoScoreChangeReason(baseMetrics())).toBe("主要由诊断样本更新带来变化");
  });

  it("单次诊断时给出样本有限说明", () => {
    expect(
      buildGeoScoreAttributionLines(
        baseMetrics({
          aiTestResultCount: 1,
        }),
      ),
    ).toEqual([
      "当前仅 1 次诊断样本：归因参考性有限",
      "当前未发现明显扣分项：分数主要由诊断样本更新驱动",
      "数据来源：真实诊断数据",
    ]);
  });
});

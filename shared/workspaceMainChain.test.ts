import { describe, expect, it } from "vitest";
import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";
import {
  hasCompletedAiDiagnosis,
  hasCompletedT0Baseline,
  hasCompletedT1Retest,
  resolveMainChainNextActionPaths,
  resolveMainChainSteps,
  toMainChainProgressInput,
} from "./workspaceMainChain";

const baseMetrics = (): WorkspaceSummaryMetrics => ({
  profileCompletionPercent: 100,
  boundPublishAccountCount: 1,
  expiredSessionAccountCount: 0,
  articleCount: 2,
  publishRecordCount: 0,
  publishRecordWithPublicUrlCount: 0,
  waitingPublicLinkCount: 0,
  publishTaskCount: 0,
  completedPublishTaskCount: 0,
  retestPendingCount: 0,
  rewriteOpenCount: 2,
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
  p0ProfileComplete: true,
});

describe("workspaceMainChain", () => {
  it("8 步进度按规范判定完成态", () => {
    const steps = resolveMainChainSteps({
      profileCompletionPercent: 80,
      articleCount: 1,
      completedPublishTaskCount: 1,
      monitoringRecordCount: 1,
      retestComparisonCount: 1,
      reportCount: 1,
      hasCompletedT0Baseline: true,
      hasCompletedT1Retest: true,
    });
    expect(steps).toHaveLength(8);
    expect(steps.every(step => step.done)).toBe(true);
    expect(steps.map(step => step.name)).toEqual([
      "企业资料建档",
      "AI搜索现状实测（T0基线）",
      "品牌资产补全",
      "内容资产生成",
      "平台适配发布",
      "收录与引用监测（T1/T2/T3复测）",
      "GEO评分与竞品对比",
      "交付报告与下一轮优化",
    ]);
  });

  it("建档完整度低于 80% 时第一步未完成", () => {
    const steps = resolveMainChainSteps({
      profileCompletionPercent: 79,
      articleCount: 0,
      completedPublishTaskCount: 0,
      monitoringRecordCount: 0,
      retestComparisonCount: 0,
      reportCount: 0,
      hasCompletedT0Baseline: false,
      hasCompletedT1Retest: false,
    });
    expect(steps[0]?.done).toBe(false);
  });

  it("未完成 T0 时建议开始基线检测", () => {
    const action = resolveMainChainNextActionPaths(baseMetrics(), []);
    expect(action?.ctaLabel).toBe("开始基线检测");
    expect(action?.ctaPath).toBe("/ai-diagnosis");
  });

  it("T0 完成无内容时建议生成内容", () => {
    const action = resolveMainChainNextActionPaths(
      { ...baseMetrics(), hasCompletedT0Baseline: true, articleCount: 0 },
      [],
    );
    expect(action?.ctaLabel).toBe("生成内容");
    expect(action?.ctaPath).toBe("/weekly");
  });

  it("有内容未发布时建议去发布", () => {
    const action = resolveMainChainNextActionPaths(
      { ...baseMetrics(), hasCompletedT0Baseline: true, articleCount: 2, completedPublishTaskCount: 0 },
      [],
    );
    expect(action?.ctaLabel).toBe("去发布");
    expect(action?.ctaPath).toBe("/content-publishing");
  });

  it("已发布无 T1 时建议执行 T1 复测", () => {
    const action = resolveMainChainNextActionPaths(
      {
        ...baseMetrics(),
        hasCompletedT0Baseline: true,
        articleCount: 2,
        completedPublishTaskCount: 1,
      },
      [],
    );
    expect(action?.ctaLabel).toBe("执行T1复测");
  });

  it("T1 完成后返回 null", () => {
    const action = resolveMainChainNextActionPaths(
      {
        ...baseMetrics(),
        hasCompletedT0Baseline: true,
        articleCount: 2,
        completedPublishTaskCount: 1,
        hasCompletedT1Retest: true,
        rewriteOpenCount: 3,
      },
      [{ roundType: "T1_RETEST", status: "completed", finishedAt: new Date().toISOString() }],
    );
    expect(action).toBeNull();
  });

  it("hasCompletedAiDiagnosis 兼容 T0 或分析结果", () => {
    expect(hasCompletedAiDiagnosis(baseMetrics())).toBe(false);
    expect(hasCompletedAiDiagnosis({ ...baseMetrics(), hasCompletedT0Baseline: true })).toBe(true);
    expect(hasCompletedAiDiagnosis({ ...baseMetrics(), hasGeoScore: true })).toBe(true);
  });

  it("hasCompletedT0Baseline / hasCompletedT1Retest 仅认对应轮次", () => {
    expect(hasCompletedT0Baseline([{ roundType: "T1_RETEST", status: "completed" }])).toBe(false);
    expect(
      hasCompletedT0Baseline([{ roundType: "T0_BASELINE", status: "completed", finishedAt: "2026-01-01" }]),
    ).toBe(true);
    expect(hasCompletedT1Retest([{ roundType: "T0_BASELINE", status: "completed" }])).toBe(false);
    expect(
      hasCompletedT1Retest([{ roundType: "T1_RETEST", status: "completed", finishedAt: "2026-01-01" }]),
    ).toBe(true);
  });

  it("toMainChainProgressInput 合并服务端与轮次数据", () => {
    const input = toMainChainProgressInput(baseMetrics(), [
      { roundType: "T0_BASELINE", status: "completed" },
    ]);
    expect(input.hasCompletedT0Baseline).toBe(true);
  });
});

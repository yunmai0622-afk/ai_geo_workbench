import { describe, expect, it } from "vitest";
import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";
import {
  hasCompletedAiDiagnosis,
  hasCompletedT1Retest,
  resolveMainChainNextActionPaths,
} from "./workspaceMainChain";

const baseMetrics = (): WorkspaceSummaryMetrics => ({
  profileCompletionPercent: 100,
  boundPublishAccountCount: 1,
  expiredSessionAccountCount: 0,
  articleCount: 2,
  publishRecordCount: 0,
  publishTaskCount: 0,
  retestPendingCount: 0,
  rewriteOpenCount: 2,
  aiTestResultCount: 0,
  monitoringRecordCount: 0,
  geoScore: null,
  brandMentionRate: null,
  lowQualityArticleCount: 0,
  hasAnalysis: false,
  hasGeoScore: false,
  p0ProfileComplete: true,
});

describe("workspaceMainChain", () => {
  it("未完成诊断时建议基线检测", () => {
    const action = resolveMainChainNextActionPaths(baseMetrics(), []);
    expect(action?.ctaLabel).toBe("开始 AI 基线检测");
    expect(action?.ctaPath).toBe("/ai-diagnosis");
  });

  it("诊断完成未发布时建议生成并发布", () => {
    const action = resolveMainChainNextActionPaths({ ...baseMetrics(), hasAnalysis: true }, []);
    expect(action?.ctaLabel).toBe("生成并发布内容");
    expect(action?.ctaPath).toBe("/weekly");
  });

  it("已发布无 T1 时建议复测", () => {
    const action = resolveMainChainNextActionPaths(
      { ...baseMetrics(), hasAnalysis: true, publishRecordCount: 1 },
      [],
    );
    expect(action?.ctaLabel).toBe("执行复测，查看效果");
  });

  it("T1 完成后返回 null，避免落到重写池文案", () => {
    const action = resolveMainChainNextActionPaths(
      { ...baseMetrics(), hasAnalysis: true, publishRecordCount: 1, rewriteOpenCount: 3 },
      [{ roundType: "T1_RETEST", status: "completed", finishedAt: new Date().toISOString() }],
    );
    expect(action).toBeNull();
  });

  it("hasCompletedAiDiagnosis 识别分析或实测", () => {
    expect(hasCompletedAiDiagnosis(baseMetrics())).toBe(false);
    expect(hasCompletedAiDiagnosis({ ...baseMetrics(), hasGeoScore: true })).toBe(true);
  });

  it("hasCompletedT1Retest 仅认 T1 完成", () => {
    expect(hasCompletedT1Retest([{ roundType: "T0_BASELINE", status: "completed" }])).toBe(false);
    expect(
      hasCompletedT1Retest([{ roundType: "T1_RETEST", status: "completed", finishedAt: "2026-01-01" }]),
    ).toBe(true);
  });
});

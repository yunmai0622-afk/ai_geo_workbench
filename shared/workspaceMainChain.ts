import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";

export type MainChainNextActionPaths = {
  ctaLabel: string;
  reason: string;
  nextStageName: string;
  /** 不含 projectId 的路径，由前端 buildProjectUrl 拼接 */
  ctaPath: string;
};

export type TestRoundRow = {
  roundType: string;
  status: string;
  finishedAt?: Date | string | null;
};

export function hasCompletedAiDiagnosis(metrics: WorkspaceSummaryMetrics): boolean {
  return metrics.hasAnalysis || metrics.hasGeoScore || metrics.aiTestResultCount > 0;
}

export function hasCompletedT1Retest(testRounds: TestRoundRow[]): boolean {
  return testRounds.some(
    round =>
      round.roundType === "T1_RETEST" &&
      (round.status === "completed" || Boolean(round.finishedAt)),
  );
}

export function resolveMainChainNextActionPaths(
  metrics: WorkspaceSummaryMetrics,
  testRounds: TestRoundRow[],
): MainChainNextActionPaths | null {
  if (!hasCompletedAiDiagnosis(metrics)) {
    return {
      ctaLabel: "开始 AI 基线检测",
      reason: "尚未完成 AI 现状实测，需要先建立品牌在 AI 搜索中的可见度基线。",
      nextStageName: "待生产",
      ctaPath: "/ai-diagnosis",
    };
  }
  if (metrics.publishRecordCount === 0) {
    return {
      ctaLabel: "生成并发布内容",
      reason: "诊断已完成，建议围绕结论生成内容资产并完成平台发布。",
      nextStageName: "待监测",
      ctaPath: "/weekly",
    };
  }
  if (!hasCompletedT1Retest(testRounds)) {
    return {
      ctaLabel: "执行复测，查看效果",
      reason: "已有发布记录，建议执行 T1 复测，对比发布前后品牌提及变化。",
      nextStageName: "优化中",
      ctaPath: "/ai-diagnosis",
    };
  }
  return null;
}

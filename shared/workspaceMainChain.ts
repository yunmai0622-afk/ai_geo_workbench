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

export const MAIN_CHAIN_STEPS = [
  { id: "profile", name: "企业资料建档", path: "/enterprise-profile" },
  { id: "t0_baseline", name: "AI基线检测", path: "/ai-diagnosis" },
  { id: "content", name: "内容资产生成", path: "/weekly" },
  { id: "publish", name: "平台发布", path: "/content-publishing" },
  { id: "monitoring", name: "收录监测", path: "/inclusion-monitoring" },
  { id: "t1_retest", name: "T1复测", path: "/ai-diagnosis" },
  { id: "comparison", name: "效果对比", path: "/ai-diagnosis" },
  { id: "report", name: "交付报告", path: "/delivery-reports" },
] as const;

export type MainChainStepView = {
  step: number;
  id: (typeof MAIN_CHAIN_STEPS)[number]["id"];
  name: string;
  path: string;
  done: boolean;
};

export type MainChainProgressInput = Pick<
  WorkspaceSummaryMetrics,
  | "profileCompletionPercent"
  | "articleCount"
  | "completedPublishTaskCount"
  | "monitoringRecordCount"
  | "retestComparisonCount"
  | "reportCount"
  | "hasCompletedT0Baseline"
  | "hasCompletedT1Retest"
>;

export function isCompletedTestRound(round: TestRoundRow): boolean {
  return round.status === "completed" || Boolean(round.finishedAt);
}

export function hasCompletedT0Baseline(testRounds: TestRoundRow[]): boolean {
  return testRounds.some(
    round => round.roundType === "T0_BASELINE" && isCompletedTestRound(round),
  );
}

export function hasCompletedT1Retest(testRounds: TestRoundRow[]): boolean {
  return testRounds.some(
    round => round.roundType === "T1_RETEST" && isCompletedTestRound(round),
  );
}

/** @deprecated 保留兼容；主链路现以 T0 完成为准 */
export function hasCompletedAiDiagnosis(metrics: WorkspaceSummaryMetrics): boolean {
  return metrics.hasCompletedT0Baseline || metrics.hasAnalysis || metrics.hasGeoScore || metrics.aiTestResultCount > 0;
}

export function toMainChainProgressInput(
  metrics: WorkspaceSummaryMetrics,
  testRounds: TestRoundRow[] = [],
): MainChainProgressInput {
  return {
    profileCompletionPercent: metrics.profileCompletionPercent,
    articleCount: metrics.articleCount,
    completedPublishTaskCount: metrics.completedPublishTaskCount,
    monitoringRecordCount: metrics.monitoringRecordCount,
    retestComparisonCount: metrics.retestComparisonCount,
    reportCount: metrics.reportCount,
    hasCompletedT0Baseline:
      metrics.hasCompletedT0Baseline || hasCompletedT0Baseline(testRounds),
    hasCompletedT1Retest: metrics.hasCompletedT1Retest || hasCompletedT1Retest(testRounds),
  };
}

export function resolveMainChainSteps(input: MainChainProgressInput): MainChainStepView[] {
  const doneFlags = [
    input.profileCompletionPercent >= 80,
    input.hasCompletedT0Baseline,
    input.articleCount > 0,
    input.completedPublishTaskCount > 0,
    input.monitoringRecordCount > 0,
    input.hasCompletedT1Retest,
    input.retestComparisonCount > 0,
    input.reportCount > 0,
  ];

  return MAIN_CHAIN_STEPS.map((step, index) => ({
    step: index + 1,
    id: step.id,
    name: step.name,
    path: step.path,
    done: doneFlags[index] ?? false,
  }));
}

export function resolveMainChainNextActionPaths(
  metrics: WorkspaceSummaryMetrics,
  testRounds: TestRoundRow[] = [],
): MainChainNextActionPaths | null {
  const progress = toMainChainProgressInput(metrics, testRounds);

  if (!progress.hasCompletedT0Baseline) {
    return {
      ctaLabel: "开始基线检测",
      reason: "尚未完成 AI 基线检测，需要先建立品牌在 AI 搜索中的可见度基线。",
      nextStageName: "AI基线检测",
      ctaPath: "/ai-diagnosis",
    };
  }
  if (progress.articleCount === 0) {
    return {
      ctaLabel: "生成内容",
      reason: "基线检测已完成，建议围绕诊断结论生成内容资产。",
      nextStageName: "内容资产生成",
      ctaPath: "/weekly",
    };
  }
  if (progress.completedPublishTaskCount === 0) {
    return {
      ctaLabel: "去发布",
      reason: "已有内容资产，建议完成平台发布以进入收录监测。",
      nextStageName: "平台发布",
      ctaPath: "/content-publishing",
    };
  }
  if (!progress.hasCompletedT1Retest) {
    return {
      ctaLabel: "执行T1复测",
      reason: "已有发布记录，建议执行 T1 复测，对比发布前后品牌提及变化。",
      nextStageName: "T1复测",
      ctaPath: "/ai-diagnosis",
    };
  }
  return null;
}

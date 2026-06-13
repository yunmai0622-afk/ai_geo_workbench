import { AI_DIAGNOSIS_SOFT_RECOMMENDATION } from "./aiDiagnosisManualT0Gate";
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

export type UnifiedMainPipelineStep = {
  id:
    | "profile_basics"
    | "ai_search_test_t0"
    | "brand_assets"
    | "content_assets"
    | "platform_publish"
    | "inclusion_monitor_retest"
    | "geo_score"
    | "delivery_report";
  title: string;
  shortLabel: string;
  customerDescription: string;
  emptyHint: string;
  path: string;
};

export const GEO_UNIFIED_MAIN_PIPELINE_STEPS: readonly UnifiedMainPipelineStep[] = [
  {
    id: "profile_basics",
    title: "企业资料建档",
    shortLabel: "建档",
    customerDescription: "录入企业基础信息，让系统知道品牌是谁、卖什么、服务谁。",
    emptyHint: "请先完成企业资料建档。",
    path: "/enterprise-profile",
  },
  {
    id: "ai_search_test_t0",
    title: "AI 现状检测",
    shortLabel: "实测",
    customerDescription: "在豆包、Kimi、DeepSeek 等平台发起真实提问，查看品牌是否被提及与推荐。",
    emptyHint: "暂无实测结果，请先发起 AI 搜索实测。",
    path: "/ai-diagnosis",
  },
  {
    id: "brand_assets",
    title: "品牌资产补全",
    shortLabel: "资产",
    customerDescription: "补充案例、背书、竞品与希望被 AI 推荐的问题，提升 AI 理解与引用质量。",
    emptyHint: "建议补充品牌资产，帮助 AI 更准确理解企业。",
    path: "/enterprise-profile",
  },
  {
    id: "content_assets",
    title: "内容资产生成",
    shortLabel: "内容",
    customerDescription: "围绕实测缺口生成适配平台的内容资产，提升理解与推荐概率，而非堆数量。",
    emptyHint: "暂无内容资产，请先完成实测诊断后再生成。",
    path: "/weekly",
  },
  {
    id: "platform_publish",
    title: "平台适配发布",
    shortLabel: "发布",
    customerDescription: "按平台策略人工确认发布或登记发布结果，不做一键全网群发。",
    emptyHint: "暂无发布记录，请完成内容后登记或执行发布。",
    path: "/content-publishing",
  },
  {
    id: "inclusion_monitor_retest",
    title: "收录与引用监测（发布后复测）",
    shortLabel: "监测",
    customerDescription: "跟踪内容收录、AI 引用、品牌提及与推荐，并按发布后复测节奏验证变化。",
    emptyHint: "暂无监测结果，请先完成发布记录并发起复测。",
    path: "/inclusion-monitoring",
  },
  {
    id: "geo_score",
    title: "GEO评分与竞品对比",
    shortLabel: "评分",
    customerDescription: "查看本轮 GEO 评分与竞品对比，识别可见性差距。",
    emptyHint: "暂无 GEO 评分，请先完成 AI 搜索实测。",
    path: "/ai-diagnosis",
  },
  {
    id: "delivery_report",
    title: "交付报告与下一轮优化",
    shortLabel: "交付",
    customerDescription: "整理本轮执行摘要、问题清单与优化建议，推进下一轮提升。",
    emptyHint: "暂无可交付报告，请先积累实测、发布与监测数据。",
    path: "/delivery-reports",
  },
] as const;

export type MainChainStepView = {
  step: number;
  id: (typeof GEO_UNIFIED_MAIN_PIPELINE_STEPS)[number]["id"];
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

export function hasCompletedT2Retest(testRounds: TestRoundRow[]): boolean {
  return testRounds.some(
    round => round.roundType === "T2_RETEST" && isCompletedTestRound(round),
  );
}

export function hasCompletedT3Retest(testRounds: TestRoundRow[]): boolean {
  return testRounds.some(
    round => round.roundType === "T3_RETEST" && isCompletedTestRound(round),
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
  return GEO_UNIFIED_MAIN_PIPELINE_STEPS.map((step, index) => {
    const done = (() => {
      switch (step.id) {
        case "profile_basics":
          return input.profileCompletionPercent >= 80;
        case "ai_search_test_t0":
          return input.hasCompletedT0Baseline;
        case "brand_assets":
          return input.profileCompletionPercent >= 70;
        case "content_assets":
          return input.articleCount > 0;
        case "platform_publish":
          return input.completedPublishTaskCount > 0;
        case "inclusion_monitor_retest":
          return input.monitoringRecordCount > 0 || input.hasCompletedT1Retest;
        case "geo_score":
          return input.retestComparisonCount > 0;
        case "delivery_report":
          return input.reportCount > 0;
        default:
          return false;
      }
    })();

    return {
      step: index + 1,
      id: step.id,
      name: step.title,
      shortLabel: step.shortLabel,
      path: step.path,
      done,
    };
  });
}

export function resolveMainChainNextActionPaths(
  metrics: WorkspaceSummaryMetrics,
  testRounds: TestRoundRow[] = [],
): MainChainNextActionPaths | null {
  const progress = toMainChainProgressInput(metrics, testRounds);

  if (!progress.hasCompletedT0Baseline) {
    return {
      ctaLabel: "开始 AI 现状检测",
      reason: AI_DIAGNOSIS_SOFT_RECOMMENDATION,
      nextStageName: "AI 现状检测",
      ctaPath: "/ai-diagnosis",
    };
  }
  if (progress.articleCount === 0) {
    return {
      ctaLabel: "生成内容",
      reason: "AI 现状检测已完成，建议围绕诊断结论生成内容资产。",
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
      reason: "已有发布记录，建议执行 7天后复测，对比发布前后品牌提及变化。",
      nextStageName: "T1复测",
      ctaPath: "/ai-diagnosis",
    };
  }
  return null;
}

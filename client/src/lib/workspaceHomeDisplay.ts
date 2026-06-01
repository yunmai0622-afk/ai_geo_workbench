import { buildProjectUrl } from "@/lib/activeProject";
import { aggregateAiTestEvidence, type AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import type { T0AiTestRunMetricsResult } from "@shared/t0AiTestRunMetrics";
import {
  hasCompletedT1Retest,
  resolveMainChainNextActionPaths,
  type TestRoundRow,
} from "@shared/workspaceMainChain";
import type { WorkspaceSummaryMetrics } from "@shared/workspaceStateMachine";

export type MainChainNextAction = {
  ctaLabel: string;
  reason: string;
  nextStageName: string;
  ctaPath: string;
};

export type { TestRoundRow };

export type AnalysisTimeRow = {
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type MonitoringTimeRow = {
  lastAiTestedAt?: Date | string | null;
};

function parseTime(value: Date | string | number | null | undefined): number {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

export function resolveMainChainNextAction(
  projectId: number,
  metrics: WorkspaceSummaryMetrics,
  testRounds: TestRoundRow[],
): MainChainNextAction | null {
  const paths = resolveMainChainNextActionPaths(metrics, testRounds);
  if (!paths) return null;
  return {
    ...paths,
    ctaPath: buildProjectUrl(paths.ctaPath, projectId),
  };
}

export { hasCompletedT1Retest } from "@shared/workspaceMainChain";

export function pickAiTestAggregate(
  summaryMentionRate: number | null,
  summaryRecommendRate: number | null,
  summaryQuestionCount: number,
  monitoringAggregate: AiTestEvidenceAggregate,
): AiTestEvidenceAggregate {
  if (monitoringAggregate.questionCount > 0) return monitoringAggregate;
  if (summaryQuestionCount > 0 && summaryMentionRate != null) {
    return {
      ...monitoringAggregate,
      questionCount: summaryQuestionCount,
      mentionRate: summaryMentionRate,
      recommendRate: summaryRecommendRate ?? monitoringAggregate.recommendRate,
    };
  }
  return monitoringAggregate;
}

export function formatBrandMentionRate(aggregate: AiTestEvidenceAggregate): string {
  if (aggregate.questionCount <= 0) return "--";
  return `${Math.round(aggregate.mentionRate * 100)}%`;
}

export function formatRecommendRate(aggregate: AiTestEvidenceAggregate): string {
  if (aggregate.questionCount <= 0) return "--";
  return `${Math.round(aggregate.recommendRate * 100)}%`;
}

export function formatT0BrandMentionRate(metrics: T0AiTestRunMetricsResult | null | undefined): string {
  if (!metrics || metrics.totalRuns <= 0) return "--";
  return `${Math.round(metrics.mentionRate * 100)}%`;
}

export function formatT0RecommendRate(metrics: T0AiTestRunMetricsResult | null | undefined): string {
  if (!metrics || metrics.totalRuns <= 0) return "--";
  return `${Math.round(metrics.recommendRate * 100)}%`;
}

export function formatLastAiTestLabel(input: {
  analyses: AnalysisTimeRow[];
  monitoring: MonitoringTimeRow[];
  testRounds: Array<TestRoundRow & { startedAt?: Date | string | null; createdAt?: Date | string | null }>;
}): string {
  let max = NaN;
  for (const row of input.analyses) {
    for (const value of [row.updatedAt, row.createdAt]) {
      const t = parseTime(value);
      if (!Number.isNaN(t)) max = Number.isNaN(max) ? t : Math.max(max, t);
    }
  }
  for (const row of input.monitoring) {
    const t = parseTime(row.lastAiTestedAt);
    if (!Number.isNaN(t)) max = Number.isNaN(max) ? t : Math.max(max, t);
  }
  for (const round of input.testRounds) {
    for (const value of [round.finishedAt, round.startedAt, round.createdAt]) {
      const t = parseTime(value);
      if (!Number.isNaN(t)) max = Number.isNaN(max) ? t : Math.max(max, t);
    }
  }
  if (Number.isNaN(max)) return "暂无";
  return new Date(max).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * GEO-V2.0-P1-A：月度优化计划生成（成熟度短板 → 本月任务清单）
 */

import {
  GEO_MATURITY_DIMENSION_META,
  type GeoMaturityDimensionKey,
  type GeoMaturityScores,
} from "./geoMaturityScoring";

export const MONTHLY_PLAN_WEAKNESS_THRESHOLD = 60;

export type MonthlyPlanTaskDraft = {
  taskType: "content_generation" | "source_discovery" | "evidence_addition" | "profile_completion";
  targetDimension: GeoMaturityDimensionKey;
  relatedQuestionId?: number | null;
  title: string;
  reason: string;
  actionUrl: string;
  metadata?: Record<string, unknown>;
};

export type MonthlyPlanGenerationContext = {
  maturityScores: GeoMaturityScores;
  verifiedEvidenceCount: number;
  brandSourceCount: number;
  uncoveredQuestionIds: number[];
};

export function computeMonthlyPlanTargetCount(currentScore: number): number {
  if (currentScore >= MONTHLY_PLAN_WEAKNESS_THRESHOLD) return 0;
  return Math.min(5, Math.max(3, Math.floor((MONTHLY_PLAN_WEAKNESS_THRESHOLD - currentScore) / 10)));
}

export function resolveTopWeakDimensions(
  scores: GeoMaturityScores,
  limit = 3,
): Array<{ key: GeoMaturityDimensionKey; label: string; score: number }> {
  return GEO_MATURITY_DIMENSION_META.map(meta => ({
    key: meta.key,
    label: meta.label,
    score: scores[meta.field] ?? 0,
  }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

export function buildBaselineDimensionScores(scores: GeoMaturityScores): Record<string, number> {
  return {
    brandIdentity: scores.brandIdentityScore,
    categoryPositioning: scores.categoryPositioningScore,
    questionCoverage: scores.questionCoverageScore,
    sourceGraph: scores.sourceGraphScore,
    trustEvidence: scores.trustEvidenceScore,
    aiTestPerformance: scores.aiTestPerformanceScore,
  };
}

export function buildMonthlyPlanFocusSummary(
  weakDimensions: Array<{ label: string; score: number }>,
): string {
  if (weakDimensions.length === 0) return "全面提升 AI 品牌成熟度";
  return weakDimensions.map(d => d.label).join("、");
}

function pushTask(
  tasks: MonthlyPlanTaskDraft[],
  task: MonthlyPlanTaskDraft,
  maxTotal: number,
): void {
  if (tasks.length >= maxTotal) return;
  tasks.push(task);
}

function tasksForDimensionCount(tasks: MonthlyPlanTaskDraft[], dimension: GeoMaturityDimensionKey): number {
  return tasks.filter(t => t.targetDimension === dimension).length;
}

export function buildMonthlyPlanTaskDrafts(
  context: MonthlyPlanGenerationContext,
  options?: { minTasks?: number; maxTasks?: number },
): MonthlyPlanTaskDraft[] {
  const minTasks = options?.minTasks ?? 4;
  const maxTasks = options?.maxTasks ?? 6;
  const weakDimensions = resolveTopWeakDimensions(context.maturityScores).filter(
    d => d.score < MONTHLY_PLAN_WEAKNESS_THRESHOLD,
  );
  const tasks: MonthlyPlanTaskDraft[] = [];

  for (const dimension of weakDimensions) {
    if (tasks.length >= maxTasks) break;
    if (tasksForDimensionCount(tasks, dimension.key) >= 2) continue;

    const targetN = computeMonthlyPlanTargetCount(dimension.score);
    if (targetN <= 0) continue;

    switch (dimension.key) {
      case "trustEvidence": {
        pushTask(
          tasks,
          {
            taskType: "evidence_addition",
            targetDimension: dimension.key,
            title: `补充 ${targetN} 条信任证据`,
            reason: `已验证证据 ${context.verifiedEvidenceCount} 条，AI 缺少推荐你的理由`,
            actionUrl: "/enterprise-profile?step=6",
            metadata: {
              targetCount: targetN,
              baselineCount: context.verifiedEvidenceCount,
            },
          },
          maxTasks,
        );
        break;
      }
      case "sourceGraph": {
        pushTask(
          tasks,
          {
            taskType: "source_discovery",
            targetDimension: dimension.key,
            title: `补充 ${targetN} 条公开信源`,
            reason: `当前信源 ${context.brandSourceCount} 条，AI 难以交叉确认你的身份`,
            actionUrl: "/brand-source-graph",
            metadata: {
              targetCount: targetN,
              baselineCount: context.brandSourceCount,
            },
          },
          maxTasks,
        );
        break;
      }
      case "questionCoverage":
      case "aiTestPerformance": {
        const perDimensionCap = 2 - tasksForDimensionCount(tasks, dimension.key);
        const questionIds = context.uncoveredQuestionIds.slice(0, Math.min(targetN, perDimensionCap));
        for (const questionId of questionIds) {
          pushTask(
            tasks,
            {
              taskType: "content_generation",
              targetDimension: dimension.key,
              relatedQuestionId: questionId,
              title: "为未覆盖问题生成内容",
              reason:
                dimension.key === "questionCoverage"
                  ? "搜索问题覆盖不足，需围绕未覆盖问题补充内容"
                  : "AI 实测表现偏弱，需围绕关键问题生成可引用内容",
              actionUrl: `/weekly?questionId=${questionId}`,
              metadata: { targetCount: 1, questionId },
            },
            maxTasks,
          );
        }
        if (questionIds.length === 0 && tasksForDimensionCount(tasks, dimension.key) === 0) {
          pushTask(
            tasks,
            {
              taskType: "content_generation",
              targetDimension: dimension.key,
              title: `为 ${targetN} 个未覆盖问题生成内容`,
              reason: "问题池仍有未生成内容的高价值问题，建议优先补齐",
              actionUrl: "/weekly",
              metadata: { targetCount: targetN },
            },
            maxTasks,
          );
        }
        break;
      }
      case "brandIdentity": {
        pushTask(
          tasks,
          {
            taskType: "profile_completion",
            targetDimension: dimension.key,
            title: "完善建档 - 品牌实体信息",
            reason: "品牌实体清晰度不足，需补齐品牌名、官网与一句话介绍",
            actionUrl: "/enterprise-profile?step=1",
            metadata: { profileStep: 1 },
          },
          maxTasks,
        );
        break;
      }
      case "categoryPositioning": {
        pushTask(
          tasks,
          {
            taskType: "profile_completion",
            targetDimension: dimension.key,
            title: "完善建档 - 品类定位信息",
            reason: "品类定位不够清晰，需补充行业标签、产品描述与核心卖点",
            actionUrl: "/enterprise-profile?step=2",
            metadata: { profileStep: 2 },
          },
          maxTasks,
        );
        break;
      }
    }
  }

  if (tasks.length >= minTasks) return tasks.slice(0, maxTasks);

  for (const dimension of weakDimensions) {
    if (tasks.length >= minTasks) break;
    if (tasks.some(t => t.targetDimension === dimension.key)) continue;
    const targetN = computeMonthlyPlanTargetCount(dimension.score);
    if (targetN <= 0) continue;
    pushTask(
      tasks,
      {
        taskType: "profile_completion",
        targetDimension: dimension.key,
        title: `优化 ${dimension.label}`,
        reason: `${dimension.label}当前 ${dimension.score} 分，建议按成熟度建议逐项补齐`,
        actionUrl: "/maturity",
        metadata: { fallback: true },
      },
      maxTasks,
    );
  }

  return tasks.slice(0, maxTasks);
}

export function computeMonthlyPlanProgress(tasks: Array<{ status: string }>): {
  completedCount: number;
  totalCount: number;
} {
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.status === "completed").length;
  return { completedCount, totalCount };
}

export function isMonthlyPlanRetestReady(input: {
  retestScheduledAt: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (!input.retestScheduledAt) return false;
  const scheduled =
    input.retestScheduledAt instanceof Date
      ? input.retestScheduledAt
      : new Date(input.retestScheduledAt);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled.getTime() <= (input.now ?? new Date()).getTime();
}

export function buildMonthlyPlanComparison(input: {
  baselineMaturityScore: number;
  baselineDimensionScores: Record<string, number>;
  resultMaturityScore: number | null;
  resultDimensionScores: Record<string, number> | null;
}): {
  totalDelta: number | null;
  dimensions: Array<{
    key: string;
    label: string;
    baseline: number;
    result: number | null;
    delta: number | null;
  }>;
} {
  const dimensions = GEO_MATURITY_DIMENSION_META.map(meta => {
    const baseline = input.baselineDimensionScores[meta.key] ?? 0;
    const result = input.resultDimensionScores?.[meta.key] ?? null;
    return {
      key: meta.key,
      label: meta.label,
      baseline,
      result,
      delta: result == null ? null : result - baseline,
    };
  });
  const totalDelta =
    input.resultMaturityScore == null ? null : input.resultMaturityScore - input.baselineMaturityScore;
  return { totalDelta, dimensions };
}

export type MonthlyPlanWorkspaceStage =
  | "none"
  | "executing"
  | "waiting_retest"
  | "retest_ready"
  | "completed";

export function resolveMonthlyPlanWorkspaceStage(input: {
  hasActivePlan: boolean;
  latestPlanStatus: "active" | "completed" | null;
  allTasksCompleted: boolean;
  retestScheduledAt: Date | string | null | undefined;
  retestCompletedAt: Date | string | null | undefined;
}): MonthlyPlanWorkspaceStage | null {
  if (input.latestPlanStatus === "completed" && !input.hasActivePlan) {
    return "completed";
  }
  if (!input.hasActivePlan) {
    return "none";
  }
  if (input.retestCompletedAt) {
    return "completed";
  }
  if (input.allTasksCompleted) {
    if (isMonthlyPlanRetestReady({ retestScheduledAt: input.retestScheduledAt })) {
      return "retest_ready";
    }
    return "waiting_retest";
  }
  return "executing";
}

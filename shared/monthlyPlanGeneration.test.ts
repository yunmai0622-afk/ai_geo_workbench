import { describe, expect, it } from "vitest";
import {
  buildMonthlyPlanComparison,
  buildMonthlyPlanTaskDrafts,
  computeMonthlyPlanTargetCount,
  resolveMonthlyPlanWorkspaceStage,
  resolveTopWeakDimensions,
} from "./monthlyPlanGeneration";

describe("monthlyPlanGeneration", () => {
  const baseScores = {
    brandIdentityScore: 55,
    categoryPositioningScore: 70,
    questionCoverageScore: 45,
    sourceGraphScore: 50,
    trustEvidenceScore: 40,
    aiTestPerformanceScore: 48,
    totalScore: 52,
    calculationDetail: {},
  };

  it("computeMonthlyPlanTargetCount respects formula", () => {
    expect(computeMonthlyPlanTargetCount(40)).toBe(3);
    expect(computeMonthlyPlanTargetCount(30)).toBe(3);
    expect(computeMonthlyPlanTargetCount(20)).toBe(4);
    expect(computeMonthlyPlanTargetCount(60)).toBe(0);
    expect(computeMonthlyPlanTargetCount(10)).toBe(5);
  });

  it("buildMonthlyPlanTaskDrafts covers 4 task types for weak dimensions", () => {
    const tasks = buildMonthlyPlanTaskDrafts({
      maturityScores: {
        ...baseScores,
        sourceGraphScore: 35,
        brandIdentityScore: 70,
        categoryPositioningScore: 75,
      },
      verifiedEvidenceCount: 2,
      brandSourceCount: 3,
      uncoveredQuestionIds: [101, 102, 103],
    });
    expect(tasks.length).toBeGreaterThanOrEqual(4);
    expect(tasks.length).toBeLessThanOrEqual(6);
    const types = new Set(tasks.map(t => t.taskType));
    expect(types.has("evidence_addition")).toBe(true);
    expect(types.has("source_discovery")).toBe(true);
    expect(types.has("content_generation")).toBe(true);
    for (const task of tasks) {
      expect(task.title.trim().length).toBeGreaterThan(0);
      expect(task.reason.trim().length).toBeGreaterThan(0);
      expect(task.actionUrl.startsWith("/")).toBe(true);
    }
  });

  it("resolveTopWeakDimensions returns lowest 3", () => {
    const weak = resolveTopWeakDimensions(baseScores, 3);
    expect(weak[0]?.key).toBe("trustEvidence");
    expect(weak.map(w => w.label)).toContain("信任证据强度");
  });

  it("buildMonthlyPlanComparison computes deltas", () => {
    const comparison = buildMonthlyPlanComparison({
      baselineMaturityScore: 52,
      baselineDimensionScores: {
        brandIdentity: 55,
        trustEvidence: 40,
      },
      resultMaturityScore: 58,
      resultDimensionScores: {
        brandIdentity: 60,
        trustEvidence: 48,
      },
    });
    expect(comparison.totalDelta).toBe(6);
    expect(comparison.dimensions.find(d => d.key === "trustEvidence")?.delta).toBe(8);
  });

  it("resolveMonthlyPlanWorkspaceStage covers lifecycle", () => {
    expect(
      resolveMonthlyPlanWorkspaceStage({
        hasActivePlan: false,
        latestPlanStatus: null,
        allTasksCompleted: false,
        retestScheduledAt: null,
        retestCompletedAt: null,
      }),
    ).toBe("none");
    expect(
      resolveMonthlyPlanWorkspaceStage({
        hasActivePlan: true,
        latestPlanStatus: "active",
        allTasksCompleted: false,
        retestScheduledAt: null,
        retestCompletedAt: null,
      }),
    ).toBe("executing");
    expect(
      resolveMonthlyPlanWorkspaceStage({
        hasActivePlan: true,
        latestPlanStatus: "active",
        allTasksCompleted: true,
        retestScheduledAt: new Date(Date.now() - 60_000),
        retestCompletedAt: null,
      }),
    ).toBe("retest_ready");
  });
});

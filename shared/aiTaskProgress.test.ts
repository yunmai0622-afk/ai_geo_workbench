import { describe, expect, it } from "vitest";
import {
  AI_TASK_PROGRESS_MAX_INCOMPLETE,
  clampIncompleteProgressPercent,
  pickTimedOptimisticStage,
  AI_DIAGNOSIS_PROGRESS_STAGES,
} from "./aiTaskProgress";

describe("aiTaskProgress", () => {
  it("caps incomplete progress at 95%", () => {
    expect(clampIncompleteProgressPercent(100)).toBe(AI_TASK_PROGRESS_MAX_INCOMPLETE);
    expect(clampIncompleteProgressPercent(55)).toBe(55);
  });

  it("advances optimistic stage over time without exceeding cap", () => {
    const early = pickTimedOptimisticStage(AI_DIAGNOSIS_PROGRESS_STAGES, 2_000, 95);
    const later = pickTimedOptimisticStage(AI_DIAGNOSIS_PROGRESS_STAGES, 45_000, 95);
    expect(early.percent).toBeLessThanOrEqual(95);
    expect(later.percent).toBeLessThanOrEqual(95);
    expect(later.percent).toBeGreaterThanOrEqual(early.percent);
  });
});

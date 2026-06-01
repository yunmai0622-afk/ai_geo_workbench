import { describe, expect, it } from "vitest";
import {
  AI_TASK_PROGRESS_MAX_INCOMPLETE,
  clampIncompleteProgressPercent,
  pickTimedOptimisticStage,
  AI_DIAGNOSIS_PROGRESS_STAGES,
  PLATFORM_CONTENT_PROGRESS_HINT_90S,
  PLATFORM_CONTENT_PROGRESS_STAGES,
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

  it("defines platform content generation stages with descriptions", () => {
    expect(PLATFORM_CONTENT_PROGRESS_STAGES.map(s => s.percent)).toEqual([10, 30, 60, 80, 95, 100]);
    expect(PLATFORM_CONTENT_PROGRESS_STAGES.map(s => s.label)).toEqual([
      "准备企业资料",
      "生成文章结构",
      "生成正文内容",
      "执行质量检测",
      "保存内容",
      "完成",
    ]);
    for (const stage of PLATFORM_CONTENT_PROGRESS_STAGES) {
      expect(stage.description?.length).toBeGreaterThan(0);
    }
    expect(PLATFORM_CONTENT_PROGRESS_HINT_90S).toBe("生成时间较长，请耐心等待...");
  });
});

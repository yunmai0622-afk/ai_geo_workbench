import { describe, expect, it } from "vitest";
import {
  computeAiDiagnosisRunningProgress,
  formatAiDiagnosisRunningProgressLabel,
} from "./aiDiagnosisReportDisplay";

describe("formatAiDiagnosisRunningProgressLabel", () => {
  it("shows generic hint when no run data", () => {
    const progress = computeAiDiagnosisRunningProgress({
      runs: [],
      totalQuestions: 10,
      runsPerQuestion: 3,
      activePlatformIds: ["doubao", "deepseek", "kimi"],
    });
    expect(formatAiDiagnosisRunningProgressLabel({ progress, hasRuns: false })).toBe("检测进行中，请稍候");
  });

  it("prefers platform dimension when runs exist", () => {
    const runs = [{ questionId: 1, platform: "doubao" }];
    const progress = computeAiDiagnosisRunningProgress({
      runs,
      totalQuestions: 10,
      runsPerQuestion: 3,
      activePlatformIds: ["doubao", "deepseek", "kimi"],
    });
    expect(formatAiDiagnosisRunningProgressLabel({ progress, hasRuns: true })).toBe(
      "已完成 0 / 5 个平台检测",
    );
  });

  it("shows question percent when only question dimension is available", () => {
    const progress = {
      percent: 40,
      completedPlatforms: 0,
      totalPlatforms: 0,
      completedQuestions: 2,
      totalQuestions: 5,
    };
    expect(formatAiDiagnosisRunningProgressLabel({ progress, hasRuns: true })).toBe("已完成 40%");
  });

  it("does not expose question index wording", () => {
    const label = formatAiDiagnosisRunningProgressLabel({
      progress: {
        percent: 20,
        completedPlatforms: 1,
        totalPlatforms: 5,
        completedQuestions: 3,
        totalQuestions: 55,
      },
      hasRuns: true,
    });
    expect(label).not.toMatch(/第/);
    expect(label).not.toMatch(/共.*题/);
    expect(label).toContain("1 / 5 个平台检测");
  });
});

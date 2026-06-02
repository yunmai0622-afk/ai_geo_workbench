import { describe, expect, it } from "vitest";
import {
  diagnosisMentionRateHint,
  diagnosisRecommendRateHint,
  resolveAiDiagnosisLastTestLabel,
} from "./aiDiagnosisResultDisplay";

describe("aiDiagnosisResultDisplay", () => {
  it("returns latest test timestamp label", () => {
    const label = resolveAiDiagnosisLastTestLabel({
      analysisTimestamps: ["2026-06-01T10:00:00.000Z"],
      t0FinishedAt: "2026-06-01T12:00:00.000Z",
      runTestedAtList: ["2026-06-01T11:30:00.000Z"],
    });
    expect(label).not.toBe("暂无数据");
  });

  it("provides explanation when mention rate is zero", () => {
    expect(diagnosisMentionRateHint(0, true)).toContain("基线阶段");
  });

  it("provides optimization suggestion when recommend rate is zero", () => {
    expect(diagnosisRecommendRateHint(0, true)).toContain("优化建议");
  });
});

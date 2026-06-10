import { describe, expect, it } from "vitest";
import {
  buildDetectionScopeDisplay,
  buildT0BaselineSummary,
  DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER,
} from "./deliveryReportExperimentalDisplay";

describe("deliveryReportExperimentalDisplay", () => {
  const baseRound = {
    id: "t0-id",
    roundType: "T0_BASELINE",
    roundName: "AI 现状检测",
    status: "completed",
    platforms: ["doubao", "deepseek"],
    questionsCount: 5,
    runsPerQuestion: 3,
    finishedAt: "2026-01-01",
  };

  const compareRound = {
    id: "t1-id",
    roundType: "T1_RETEST",
    roundName: "7天后复测",
    status: "completed",
    platforms: ["doubao", "deepseek"],
    questionsCount: 5,
    runsPerQuestion: 3,
    finishedAt: "2026-02-01",
  };

  it("exports fixed uncertainty disclaimer", () => {
    expect(DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER).toContain("不承诺单次优化必然带来推荐率提升");
    expect(DELIVERY_REPORT_UNCERTAINTY_DISCLAIMER).toContain("连续复测判断长期趋势");
  });

  it("builds detection scope from T0/T1 rounds", () => {
    const scope = buildDetectionScopeDisplay({
      baseRound,
      compareRound,
    });
    expect(scope.questionCount).toBe("5");
    expect(scope.platformCount).toBe("2");
    expect(scope.detectionRounds).toBe("3");
    expect(scope.hasData).toBe(true);
  });

  it("falls back to aggregate counts when rounds missing", () => {
    const scope = buildDetectionScopeDisplay({
      baseRound: null,
      compareRound: null,
      fallbackQuestionCount: 8,
      fallbackPlatformCount: 2,
    });
    expect(scope.questionCount).toBe("8");
    expect(scope.platformCount).toBe("2");
  });

  it("builds T0 baseline summary without engineering fields", () => {
    const summary = buildT0BaselineSummary([baseRound], []);
    expect(summary.hasData).toBe(true);
    expect(summary.roundName).toBe("AI 现状检测");
    expect(summary.summaryLines[0]).toContain("检测问题 5 个");
    expect(summary.summaryLines.join(" ")).not.toContain("roundType");
  });
});

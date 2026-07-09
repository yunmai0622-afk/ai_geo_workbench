import { describe, expect, it } from "vitest";
import {
  buildOverallChangeSummary,
  changeDirectionSymbol,
  filterComparisonsForRoundPair,
  formatOverallSummaryLines,
  resolveQuestionTypeDisplayLabel,
  resolveT0T1ComparisonRows,
} from "./retestComparisonDisplay";

describe("retestComparisonDisplay", () => {
  const baseRound = {
    id: "t0-id",
    roundType: "T0_BASELINE",
    roundName: "AI 能见度诊断",
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

  const comparisonRows = [
    {
      id: "c1",
      projectId: 1,
      baseRoundId: "t0-id",
      compareRoundId: "t1-id",
      questionType: "品牌认知",
      platform: "doubao",
      baseMentionCount: 6,
      compareMentionCount: 9,
      baseRecommendCount: 3,
      compareRecommendCount: 5,
      baseCompetitorCount: 2,
      compareCompetitorCount: 1,
      changeDirection: "up" as const,
      systemConclusion: "在豆包，品牌识别类问题出现频次从 6 次上升至 9 次，建议继续复测确认趋势。",
      confidenceLevel: "medium",
    },
  ];

  it("maps question types to customer labels", () => {
    expect(resolveQuestionTypeDisplayLabel("品牌认知")).toBe("品牌识别类问题");
  });

  it("maps change direction to symbols", () => {
    expect(changeDirectionSymbol("up")).toBe("↑");
    expect(changeDirectionSymbol("down")).toBe("↓");
    expect(changeDirectionSymbol("flat")).toBe("→");
    expect(changeDirectionSymbol("unknown")).toBe("—");
  });

  it("filters comparisons for T0/T1 round pair", () => {
    const resolved = resolveT0T1ComparisonRows(comparisonRows, [compareRound, baseRound]);
    expect(resolved.baseRound?.id).toBe("t0-id");
    expect(resolved.compareRound?.id).toBe("t1-id");
    expect(resolved.rows).toHaveLength(1);
    expect(filterComparisonsForRoundPair(comparisonRows, "t0-id", "t1-id")).toHaveLength(1);
  });

  it("builds overall summary lines without engineering fields", () => {
    const summary = buildOverallChangeSummary(comparisonRows, baseRound, compareRound);
    const lines = formatOverallSummaryLines(summary);
    expect(lines.mentionLine).toContain("品牌提及率");
    expect(lines.recommendLine).toContain("推荐率");
    expect(lines.competitorLine).toContain("竞品出现");
    expect(lines.mentionLine).not.toContain("confidenceLevel");
  });
});

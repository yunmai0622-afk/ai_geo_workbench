import { describe, expect, it } from "vitest";
import { buildT0DiagnosisVisualization } from "./t0DiagnosisVisualization";

describe("t0DiagnosisVisualization", () => {
  it("builds geo score bars, question type hit rates, and platform comparison from ai_test_runs", () => {
    const questionTypeByQuestionId = new Map<number, string>([
      [1, "品牌认知"],
      [2, "行业推荐"],
      [3, "竞品对比"],
      [4, "scenario_need"],
      [5, "long_tail_conversion"],
    ]);
    const visualization = buildT0DiagnosisVisualization(
      [
        {
          questionId: 1,
          platform: "doubao",
          mentionedCompany: true,
          recommendedCompany: true,
          competitorMentioned: true,
          hasSourceLinks: true,
        },
        {
          questionId: 1,
          platform: "kimi",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: true,
          hasSourceLinks: false,
        },
        {
          questionId: 2,
          platform: "deepseek",
          mentionedCompany: true,
          recommendedCompany: false,
          competitorMentioned: false,
          hasSourceLinks: true,
        },
        {
          questionId: 3,
          platform: "doubao",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: false,
          hasSourceLinks: false,
        },
        {
          questionId: 4,
          platform: "kimi",
          mentionedCompany: true,
          recommendedCompany: false,
          competitorMentioned: false,
          hasSourceLinks: false,
        },
        {
          questionId: 5,
          platform: "deepseek",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: false,
          hasSourceLinks: false,
        },
      ],
      questionTypeByQuestionId,
    );

    expect(visualization?.dataSource).toBe("ai_test_runs");
    expect(visualization?.totalRuns).toBe(6);
    expect(visualization?.geoScoreBars[0]).toMatchObject({ label: "品牌识别率", percent: 50 });
    expect(visualization?.platformComparison[1]).toMatchObject({ label: "Kimi", percent: 50 });
  });

  it("returns null when there are no runs", () => {
    expect(buildT0DiagnosisVisualization([], new Map())).toBeNull();
  });
});

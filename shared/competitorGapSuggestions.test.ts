import { describe, expect, it } from "vitest";
import { buildCompetitorGapSuggestions } from "./competitorGapSuggestions";

describe("GEO-V1.1-Competitor-Gap-Analysis", () => {
  it("builds gap suggestions per question type from ai_test_runs competitor mentions", () => {
    const questionTypeByQuestionId = new Map<number, string>([
      [1, "行业推荐"],
      [2, "行业推荐"],
      [3, "竞品对比"],
    ]);

    const result = buildCompetitorGapSuggestions(
      [
        {
          questionId: 1,
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: true,
          competitorNames: ["小鹅通"],
        },
        {
          questionId: 2,
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: true,
          competitorNames: ["有赞"],
        },
        {
          questionId: 3,
          mentionedCompany: true,
          recommendedCompany: true,
          competitorMentioned: false,
          competitorNames: [],
        },
      ],
      questionTypeByQuestionId,
    );

    expect(result?.dataSource).toBe("ai_test_runs");
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]?.message).toBe(
      "竞品在行业推荐类问题上被提及2次，建议补充行业选型与推荐场景说明",
    );
    expect(result?.items[0]?.brandCoveragePercent).toBe(0);
  });

  it("returns null when competitors never appear or brand fully covers the type", () => {
    const questionTypeByQuestionId = new Map<number, string>([[1, "品牌认知"]]);
    expect(
      buildCompetitorGapSuggestions(
        [
          {
            questionId: 1,
            mentionedCompany: true,
            recommendedCompany: true,
            competitorMentioned: true,
            competitorNames: ["竞品A"],
          },
        ],
        questionTypeByQuestionId,
      ),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildT0ContentGapSuggestions } from "./t0ContentGapSuggestions";

describe("GEO-V1.1-T0-To-Content-Bridge", () => {
  it("builds gap suggestions from ai_test_runs with zero mention types, uncovered platforms, and competitor gaps", () => {
    const questionTypeByQuestionId = new Map<number, string>([
      [1, "品牌认知"],
      [2, "行业推荐"],
      [3, "scenario_need"],
    ]);

    const result = buildT0ContentGapSuggestions(
      [
        {
          questionId: 1,
          platform: "kimi",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: false,
          competitorNames: [],
        },
        {
          questionId: 2,
          platform: "deepseek",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: false,
          competitorNames: [],
        },
        {
          questionId: 3,
          platform: "doubao",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: true,
          competitorNames: ["竞品X", "竞品X"],
        },
        {
          questionId: 3,
          platform: "kimi",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: true,
          competitorNames: ["竞品X"],
        },
      ],
      questionTypeByQuestionId,
      "round-1",
    );

    expect(result?.dataSource).toBe("ai_test_runs");
    expect(result?.headline).toBe("检测发现3个内容缺口：");
    expect(result?.items).toHaveLength(3);
    expect(result?.items.some(item => item.message.includes("知乎") && item.message.includes("品牌认知"))).toBe(
      true,
    );
    expect(result?.items.some(item => item.message.includes("Kimi") || item.message.includes("DeepSeek"))).toBe(
      true,
    );
    expect(result?.items.some(item => item.message.includes("竞品X"))).toBe(true);
    expect(result?.items[0]?.actionPath).toContain("/weekly?");
  });

  it("returns null when all types and platforms have brand mentions", () => {
    const questionTypeByQuestionId = new Map<number, string>([[1, "品牌认知"]]);
    expect(
      buildT0ContentGapSuggestions(
        [
          {
            questionId: 1,
            platform: "doubao",
            mentionedCompany: true,
            recommendedCompany: true,
            competitorMentioned: false,
            competitorNames: [],
          },
        ],
        questionTypeByQuestionId,
        "round-1",
      ),
    ).toBeNull();
  });
});

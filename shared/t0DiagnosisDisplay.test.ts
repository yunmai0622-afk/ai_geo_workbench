import { describe, expect, it } from "vitest";
import {
  buildT0DiagnosisResultsDisplay,
  computeT0QuestionProgress,
  formatT0Rate,
} from "./t0DiagnosisDisplay";

describe("t0DiagnosisDisplay", () => {
  it("formats rate as percentage", () => {
    expect(formatT0Rate(0.5)).toBe("50%");
    expect(formatT0Rate(0)).toBe("0%");
  });

  it("computes question progress from partial runs", () => {
    const completedQuestionRuns = Array.from({ length: 6 }, () => ({ questionId: 1 }));
    const progress = computeT0QuestionProgress(
      [...completedQuestionRuns, { questionId: 2 }, { questionId: 2 }],
      5,
      6,
    );
    expect(progress).toEqual({ currentQuestion: 2, totalQuestions: 5 });
  });

  it("builds grouped diagnosis results without engineering fields", () => {
    const questionTypeByQuestionId = new Map<number, string>([
      [1, "品牌认知"],
      [2, "行业推荐"],
    ]);
    const display = buildT0DiagnosisResultsDisplay(
      [
        {
          questionId: 1,
          mentionedCompany: true,
          recommendedCompany: true,
          competitorMentioned: true,
          competitorNames: ["竞品A"],
        },
        {
          questionId: 1,
          mentionedCompany: false,
          recommendedCompany: false,
          competitorMentioned: false,
          competitorNames: [],
        },
        {
          questionId: 2,
          mentionedCompany: true,
          recommendedCompany: false,
          competitorMentioned: false,
          competitorNames: [],
        },
      ],
      questionTypeByQuestionId,
    );

    expect(display?.totalRuns).toBe(3);
    expect(display?.mentionedCount).toBe(2);
    expect(display?.recommendedCount).toBe(1);
    expect(display?.competitorAppearances).toBe(1);
    expect(display?.competitorNames).toEqual(["竞品A"]);
    expect(display?.byQuestionType).toHaveLength(2);
    expect(display?.byQuestionType[0]?.label).toBe("品牌识别类问题");
    expect(display?.byPlatform).toHaveLength(5);
    expect(display?.byPlatform.find(group => group.platform === "doubao")).toBeTruthy();
    expect(JSON.stringify(display)).not.toContain("questionId");
  });
});

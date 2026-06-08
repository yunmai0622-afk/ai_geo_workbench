import { describe, expect, it } from "vitest";
import {
  aggregateRetestQuestionResult,
  computeQuestionPoolCoveragePercent,
  computeQuestionPoolUpdates,
  mergeNextRoundSuggestions,
  sourceLinkMatchesRecordUrl,
} from "./retestFeedbackLoop";
import type { SearchPoolQuestionRow } from "./questionSearchPool";

describe("retestFeedbackLoop", () => {
  it("aggregates retest question results by platform runs", () => {
    expect(
      aggregateRetestQuestionResult([
        { recommendedCompany: false, mentionedCompany: false, competitorMentioned: true },
        { recommendedCompany: false, mentionedCompany: true, competitorMentioned: false },
      ]),
    ).toBe("mentioned");

    expect(
      aggregateRetestQuestionResult([
        { recommendedCompany: false, mentionedCompany: false, competitorMentioned: true },
        { recommendedCompany: false, mentionedCompany: false, competitorMentioned: true },
      ]),
    ).toBe("competitor_won");

    expect(
      aggregateRetestQuestionResult([
        { recommendedCompany: true, mentionedCompany: false, competitorMentioned: false },
      ]),
    ).toBe("recommended");
  });

  it("matches citation urls to brand source records", () => {
    expect(sourceLinkMatchesRecordUrl("https://www.zhihu.com/question/1", "https://zhihu.com/about")).toBe(true);
    expect(sourceLinkMatchesRecordUrl("https://example.com/a", "https://other.com/b")).toBe(false);
  });

  it("computes question pool coverage and update deltas", () => {
    const questions = [
      { lastTestResult: "mentioned" },
      { lastTestResult: "recommended" },
      { lastTestResult: "not_mentioned" },
      { lastTestResult: "competitor_won" },
    ] as SearchPoolQuestionRow[];
    expect(computeQuestionPoolCoveragePercent(questions)).toBe(50);

    const before = new Map<number, "not_mentioned" | "mentioned" | null>([
      [1, "not_mentioned"],
      [2, "mentioned"],
      [3, null],
    ]);
    const after = new Map([
      [1, "recommended" as const],
      [2, "not_mentioned" as const],
      [3, "competitor_won" as const],
    ]);
    expect(computeQuestionPoolUpdates(before, after)).toEqual({
      improved: 2,
      declined: 1,
      newCompetitorWon: 1,
    });
  });

  it("merges enhancement, weak questions and declined comparisons", () => {
    const suggestions = mergeNextRoundSuggestions(
      [
        {
          id: "missing-ai-citation",
          kind: "ai_citation",
          icon: "citation",
          description: "以下信源尚未被 AI 引用，建议优先强化",
          affectedSources: ["知乎"],
          relatedQuestions: [],
        },
      ],
      [
        {
          id: 1,
          questionText: "哪个平台适合知识付费？",
          lastTestResult: "not_mentioned",
          requiredSourceTypes: ["zhihu"],
        } as SearchPoolQuestionRow,
      ],
      [{ questionType: "行业推荐", platform: "doubao", changeDirection: "down" }],
      10001,
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.actionUrl).toContain("gapType=");
  });
});

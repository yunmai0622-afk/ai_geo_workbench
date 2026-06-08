import { describe, expect, it } from "vitest";
import {
  buildRoundComparison,
  computeRoundRateSummary,
  formatComparisonChangeLabel,
  formatRateDelta,
  formatRatePercent,
  resolveComparisonChange,
  resolveQuestionLastTestResult,
} from "./testRoundComparison";

describe("testRoundComparison", () => {
  it("computes mention and recommend rates", () => {
    const summary = computeRoundRateSummary([
      { questionId: 1, platform: "doubao", mentionedCompany: true, recommendedCompany: true, competitorNames: [] },
      { questionId: 1, platform: "kimi", mentionedCompany: true, recommendedCompany: false, competitorNames: [] },
      { questionId: 2, platform: "doubao", mentionedCompany: false, recommendedCompany: false, competitorNames: ["竞品A"] },
    ]);
    expect(formatRatePercent(summary.mentionRate)).toBe("67%");
    expect(formatRatePercent(summary.recommendRate)).toBe("33%");
    expect(formatRatePercent(summary.competitorRate)).toBe("33%");
  });

  it("builds comparison rows and delta summary", () => {
    const result = buildRoundComparison(
      "round-a",
      "round-b",
      [
        {
          questionId: 1,
          platform: "doubao",
          mentionedCompany: false,
          recommendedCompany: false,
          competitorNames: [],
        },
      ],
      [
        {
          questionId: 1,
          platform: "doubao",
          mentionedCompany: true,
          recommendedCompany: true,
          competitorNames: [],
        },
      ],
      new Map([[1, "哪家适合中小企业？"]]),
    );
    expect(result.rows[0]?.change).toBe("up");
    expect(formatRateDelta(result.mentionRateDelta)).toBe("+100%");
    expect(formatComparisonChangeLabel("up")).toBe("↑提升");
  });

  it("resolves question last test result priority", () => {
    expect(resolveQuestionLastTestResult(true, true, [])).toBe("recommended");
    expect(resolveQuestionLastTestResult(true, false, [])).toBe("mentioned");
    expect(resolveQuestionLastTestResult(false, false, ["竞品A"])).toBe("competitor_won");
    expect(resolveQuestionLastTestResult(false, false, [])).toBe("not_mentioned");
  });

  it("resolves flat comparison when scores equal", () => {
    expect(
      resolveComparisonChange(
        { mentioned: true, recommended: false, competitors: [] },
        { mentioned: true, recommended: false, competitors: [] },
      ),
    ).toBe("flat");
  });
});

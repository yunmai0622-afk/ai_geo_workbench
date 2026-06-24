import { describe, expect, it } from "vitest";
import {
  buildQuestionOpportunityOverview,
  computeQuestionCompetitorRates,
  enrichQuestionOpportunityFields,
  isCompetitorOccupiedQuestion,
  resolveQuestionOpportunityLabel,
} from "./questionOpportunityMap";

describe("questionOpportunityMap", () => {
  it("computes competitor occupancy from ai test runs", () => {
    const rates = computeQuestionCompetitorRates([
      { questionId: 1, competitorMentioned: true },
      { questionId: 1, competitorMentioned: true },
      { questionId: 1, competitorMentioned: false },
      { questionId: 2, competitorMentioned: false },
    ]);
    expect(rates.get(1)).toBeCloseTo(2 / 3);
    expect(isCompetitorOccupiedQuestion(rates.get(1))).toBe(true);
    expect(isCompetitorOccupiedQuestion(rates.get(2))).toBe(false);
  });

  it("resolves opportunity labels by priority", () => {
    expect(
      resolveQuestionOpportunityLabel({
        enabled: true,
        competitorOccupied: true,
        contentPublished: false,
        hasContentPending: false,
      }),
    ).toBe("竞品占位");
    expect(
      resolveQuestionOpportunityLabel({
        enabled: true,
        competitorOccupied: false,
        contentPublished: true,
        hasContentPending: false,
      }),
    ).toBe("已覆盖");
    expect(
      resolveQuestionOpportunityLabel({
        enabled: true,
        competitorOccupied: false,
        contentPublished: false,
        hasContentPending: true,
      }),
    ).toBe("待优化");
    expect(
      resolveQuestionOpportunityLabel({
        enabled: true,
        competitorOccupied: false,
        contentPublished: false,
        hasContentPending: false,
      }),
    ).toBe("高价值");
  });

  it("builds overview metrics", () => {
    const overview = buildQuestionOpportunityOverview({
      questions: [
        {
          id: 1,
          enabled: 1,
          contentStatus: "已发布",
          competitorOccupied: false,
          monthlyFocus: true,
        },
        {
          id: 2,
          enabled: 1,
          contentStatus: "未生成",
          competitorOccupied: true,
          monthlyFocus: false,
        },
      ],
    });
    expect(overview.totalQuestions).toBe(2);
    expect(overview.coveredContentQuestions).toBe(1);
    expect(overview.competitorOccupiedQuestions).toBe(1);
    expect(overview.monthlyFocusQuestions).toBe(1);
  });

  it("enriches fields from question and runs", () => {
    const fields = enrichQuestionOpportunityFields({
      question: { id: 3, enabled: 1, questionText: "test", questionType: "品牌认知" },
      contentStatus: "已生成",
      hasContentTask: true,
      competitorRate: 0.8,
      monthlyFocusQuestionIds: new Set([3]),
    });
    expect(fields.competitorOccupied).toBe(true);
    expect(fields.opportunityLabel).toBe("竞品占位");
    expect(fields.monthlyFocus).toBe(true);
  });
});

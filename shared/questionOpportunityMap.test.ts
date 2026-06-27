import { describe, expect, it } from "vitest";
import {
  buildQuestionOpportunityMapView,
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

  it("builds a customer-facing opportunity map with next actions", () => {
    const view = buildQuestionOpportunityMapView({
      hasDiagnosisData: true,
      questions: [
        {
          id: 1,
          questionText: "海豚知道和竞品相比哪个好？",
          enabled: 1,
          searchPoolType: "comparison",
          diagnosisGap: "竞品占位",
          contentStatus: "未生成",
          aiPerformanceLabel: "竞品占优",
          hasContentTask: false,
          competitorOccupied: true,
          contentPublished: false,
          hasContentPending: false,
          monthlyFocus: true,
          opportunityLabel: "竞品占位",
          priorityLevel: "high",
          requiredSourceTypes: ["zhihu", "media"],
          lastTestResult: "competitor_won",
        },
        {
          id: 2,
          questionText: "海豚知道是什么？",
          enabled: 1,
          searchPoolType: "brand_search",
          diagnosisGap: "已提及品牌",
          contentStatus: "已发布",
          aiPerformanceLabel: "已提及",
          hasContentTask: true,
          competitorOccupied: false,
          contentPublished: true,
          hasContentPending: false,
          monthlyFocus: false,
          opportunityLabel: "已覆盖",
          requiredSourceTypes: [],
          lastTestResult: "mentioned",
        },
      ],
    });

    expect(view.headline).toContain("竞品占位");
    expect(view.proofLine).toContain("核心问题 2 个");
    expect(view.primaryActionLabel).toBe("优先处理竞品占位");
    expect(view.lanes.find(lane => lane.id === "compete")?.count).toBe(1);
    expect(view.topItems[0]?.questionText).toContain("竞品相比");
    expect(view.topItems[0]?.reason).toContain("竞品占位");
    expect(view.topItems[0]?.sourceLine).toContain("知乎");
    expect(view.topItems[0]?.nextActionLabel).toBe("生成内容任务");
  });

  it("guides diagnosis first when there is no ai evidence", () => {
    const view = buildQuestionOpportunityMapView({
      hasDiagnosisData: false,
      questions: [
        {
          id: 3,
          questionText: "知识付费工具怎么选？",
          enabled: 1,
          searchPoolType: "category_recommend",
          contentStatus: "未生成",
          hasContentTask: false,
          competitorOccupied: false,
          contentPublished: false,
          hasContentPending: false,
          monthlyFocus: false,
          opportunityLabel: "高价值",
          requiredSourceTypes: null,
          lastTestResult: null,
        },
      ],
    });

    expect(view.summary).toContain("完成 AI 实测");
    expect(view.primaryActionLabel).toBe("先跑 AI 实测诊断");
    expect(view.topItems[0]?.nextActionLabel).toBe("加入本轮诊断");
  });
});

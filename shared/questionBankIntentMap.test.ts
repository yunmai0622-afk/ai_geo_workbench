import { describe, expect, it } from "vitest";
import {
  buildQuestionBankOverviewMetrics,
  groupQuestionsByIntent,
  resolveQuestionContentStatus,
  resolveQuestionIntentGroupKey,
  resolveQuestionNextAction,
  resolveQuestionPriorityLevel,
  resolveQuestionSourceLabel,
  resolveQuestionTestStatus,
  resolveTestRoundDisplayName,
  resolveTestRoundStatusLabel,
} from "./questionBankIntentMap";

describe("questionBankIntentMap", () => {
  it("maps T0 and target question intents into UX groups", () => {
    expect(resolveQuestionIntentGroupKey({ id: 1, questionText: "a", questionType: "品牌认知", enabled: 1 })).toBe(
      "brand_awareness",
    );
    expect(
      resolveQuestionIntentGroupKey({
        id: 2,
        questionText: "b",
        questionType: "scenario_need",
        enabled: 1,
      }),
    ).toBe("scenario_pain");
    expect(
      resolveQuestionIntentGroupKey({
        id: 3,
        questionText: "c",
        questionType: "指定问题",
        enabled: 1,
        targetKeyword: JSON.stringify({ intent: "竞品对比", disadvantaged: true }),
      }),
    ).toBe("competitor_compare");
  });

  it("derives priority, source, test and content status from real fields", () => {
    const gapQuestion = {
      id: 10,
      questionText: "如何选型？",
      questionType: "指定问题",
      enabled: 1,
      source: "ai_generated",
      contentGapTags: ["高优先级缺口"],
      targetKeyword: JSON.stringify({ intent: "选型问题", disadvantaged: true }),
    };
    expect(resolveQuestionPriorityLevel(gapQuestion)).toBe("高");
    expect(resolveQuestionSourceLabel(gapQuestion)).toBe("AI 诊断发现");
    expect(resolveQuestionTestStatus(gapQuestion, new Set([10]), true)).toBe("发现缺口");
    expect(
      resolveQuestionContentStatus(gapQuestion, [
        {
          status: "已发布",
          generationBasis: { customerQuestion: "如何选型？" },
        },
      ]),
    ).toBe("已发布");
  });

  it("builds overview metrics and intent groups", () => {
    const questions = [
      { id: 1, questionText: "品牌是什么", questionType: "品牌认知", enabled: 1 },
      { id: 2, questionText: "痛点", questionType: "scenario_need", enabled: 0 },
    ];
    const overview = buildQuestionBankOverviewMetrics({
      questions,
      currentRoundQuestionCount: 1,
      contentTaskCount: 0,
      hasCompletedT0Baseline: false,
    });
    expect(overview.total).toBe(2);
    expect(overview.enabledCount).toBe(1);
    expect(groupQuestionsByIntent(questions).grouped.brand_awareness).toHaveLength(1);
  });

  it("formats test round labels", () => {
    expect(
      resolveTestRoundDisplayName({ roundType: "T0_BASELINE", roundName: "优化前基线" }),
    ).toBe("AI 现状检测");
    expect(resolveTestRoundStatusLabel("running")).toBe("检测中");
    expect(resolveQuestionTestStatus(
      { id: 1, questionText: "x", questionType: "品牌认知", enabled: 1 },
      new Set([1]),
      true,
    )).toBe("已覆盖");
  });

  it("derives next action from real question state", () => {
    const disabled = { id: 1, questionText: "x", questionType: "品牌认知", enabled: 0 };
    expect(
      resolveQuestionNextAction({
        question: disabled,
        testedQuestionIds: new Set(),
        hasCompletedT0Baseline: false,
        articles: [],
      }),
    ).toBe("启用问题");

    const gap = {
      id: 2,
      questionText: "如何选型？",
      questionType: "指定问题",
      enabled: 1,
      contentGapTags: ["高优先级缺口"],
    };
    expect(
      resolveQuestionNextAction({
        question: gap,
        testedQuestionIds: new Set([2]),
        hasCompletedT0Baseline: true,
        articles: [],
      }),
    ).toBe("围绕缺口生成内容");
  });
});

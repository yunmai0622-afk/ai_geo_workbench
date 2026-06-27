import { describe, expect, it } from "vitest";
import { buildSellableDeliveryLoopView } from "./sellableDeliveryLoop";

describe("sellableDeliveryLoop", () => {
  it("explains the sellable loop when monthly plan exists but content is not published yet", () => {
    const view = buildSellableDeliveryLoopView({
      maturityScore: 54,
      maturityLevel: "初步建立",
      hasDiagnosis: true,
      monthlyPlanTotalCount: 3,
      monthlyPlanCompletedCount: 0,
      articleCount: 1,
      publishCount: 0,
      monitoringRecordCount: 0,
      retestComparisonCount: 0,
      reportCount: 0,
      brandMentionRate: 0.42,
      recommendRate: 0.26,
      priorities: [
        { title: "提升 AI 提及与推荐", dimensionName: "AI 可见与推荐表现", source: "existing_task" },
      ],
      nextActionLabel: "继续执行本月计划",
      nextActionReason: "本月优化计划进行中，请优先完成计划内关键动作。",
    });

    expect(view.headline).toContain("发布");
    expect(view.stageSummary).toContain("成熟度 54 分");
    expect(view.currentFocus).toContain("AI 可见与推荐表现");
    expect(view.proofLine).toContain("本月任务 0/3");
    expect(view.renewalReason).toContain("不是只发文章");
    expect(view.steps.find(step => step.id === "publish")?.status).toBe("current");
  });

  it("positions completed retest and report as renewal proof", () => {
    const view = buildSellableDeliveryLoopView({
      maturityScore: 82,
      maturityLevel: "增长优化中",
      hasDiagnosis: true,
      monthlyPlanTotalCount: 4,
      monthlyPlanCompletedCount: 4,
      articleCount: 5,
      publishCount: 5,
      monitoringRecordCount: 5,
      retestComparisonCount: 2,
      reportCount: 1,
      brandMentionRate: 0.67,
      recommendRate: 0.41,
      priorities: [],
    });

    expect(view.headline).toContain("续费沟通");
    expect(view.renewalReason).toContain("从执行动作到 AI 变化");
    expect(view.steps.every(step => step.status === "done")).toBe(true);
  });
});

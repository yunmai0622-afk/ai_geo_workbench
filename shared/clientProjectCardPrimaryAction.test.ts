import { describe, expect, it } from "vitest";
import {
  CLIENT_PROFILE_COMPLETE_THRESHOLD,
  resolveClientProjectCardPrimaryAction,
} from "./clientProjectCardPrimaryAction";

describe("resolveClientProjectCardPrimaryAction", () => {
  it("规则1：建档未完成时引导完成品牌建档", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: CLIENT_PROFILE_COMPLETE_THRESHOLD - 1,
      hasCompletedT0Baseline: false,
      hasActiveMonthlyPlan: false,
    });
    expect(action.ctaLabel).toBe("去完善资料");
    expect(action.ctaPath).toBe("/enterprise-profile");
    expect(action.nextStepHint).toContain("补齐品牌");
    expect(action.majorProblem).toContain("资料不完整");
    expect(action.needsAttention).toBe(true);
  });

  it("规则2：建档完成但未做 AI 能见度诊断", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 85,
      hasCompletedT0Baseline: false,
      hasActiveMonthlyPlan: false,
    });
    expect(action.ctaLabel).toBe("去看诊断");
    expect(action.ctaPath).toBe("/ai-diagnosis");
    expect(action.nextStepHint).toContain("AI 是否知道");
    expect(action.riskLabels).toContain("未完成诊断");
  });

  it("规则3：检测完成但无 active 月度计划", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 90,
      hasCompletedT0Baseline: true,
      hasActiveMonthlyPlan: false,
    });
    expect(action.ctaLabel).toBe("去月度优化计划");
    expect(action.ctaPath).toBe("/monthly-plan");
    expect(action.nextStepHint).toContain("本月 3 件服务事项");
    expect(action.stageLabel).toBe("待制定方案");
  });

  it("规则4：有 active 月度计划时展示进度", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 90,
      hasCompletedT0Baseline: true,
      hasActiveMonthlyPlan: true,
      monthlyPlanCompletedCount: 2,
      monthlyPlanTotalCount: 5,
    });
    expect(action.ctaLabel).toBe("去执行进度");
    expect(action.ctaPath).toBe("/weekly");
    expect(action.nextStepHint).toContain("2/5 项完成");
    expect(action.monthlyProgressLabel).toBe("2/5 项完成");
    expect(action.serviceActive).toBe(true);
  });

  it("规则5：有内容待发布时进入执行进度并提示待发布", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 90,
      hasCompletedT0Baseline: true,
      hasActiveMonthlyPlan: true,
      monthlyPlanCompletedCount: 1,
      monthlyPlanTotalCount: 3,
      articleCount: 2,
      publishCount: 0,
    });
    expect(action.stageLabel).toBe("待发布");
    expect(action.ctaPath).toBe("/weekly");
    expect(action.riskLabels).toContain("待发布");
    expect(action.needsAttention).toBe(true);
  });

  it("规则6：计划任务完成时可以出报告", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 90,
      hasCompletedT0Baseline: true,
      hasActiveMonthlyPlan: true,
      monthlyPlanCompletedCount: 3,
      monthlyPlanTotalCount: 3,
    });
    expect(action.stageLabel).toBe("可出报告");
    expect(action.ctaPath).toBe("/delivery-reports");
    expect(action.reportReady).toBe(true);
  });

  it("规则7：续费风险优先进入交付报告", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 90,
      hasCompletedT0Baseline: true,
      hasActiveMonthlyPlan: true,
      monthlyPlanCompletedCount: 1,
      monthlyPlanTotalCount: 3,
      articleCount: 1,
      subscriptionServiceStatus: "expiring_soon",
    });
    expect(action.stageLabel).toBe("续费跟进");
    expect(action.ctaPath).toBe("/delivery-reports");
    expect(action.renewalRisk).toBe(true);
  });
});

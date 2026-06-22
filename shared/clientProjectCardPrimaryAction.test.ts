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
    expect(action.ctaLabel).toBe("完成品牌建档");
    expect(action.ctaPath).toBe("/enterprise-profile");
    expect(action.nextStepHint).toContain("补齐品牌信息");
  });

  it("规则2：建档完成但未做 AI 现状检测", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 85,
      hasCompletedT0Baseline: false,
      hasActiveMonthlyPlan: false,
    });
    expect(action.ctaLabel).toBe("开始AI现状检测");
    expect(action.ctaPath).toBe("/ai-diagnosis");
    expect(action.nextStepHint).toContain("检测AI当前是否认识");
  });

  it("规则3：检测完成但无 active 月度计划", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 90,
      hasCompletedT0Baseline: true,
      hasActiveMonthlyPlan: false,
    });
    expect(action.ctaLabel).toBe("生成本月优化计划");
    expect(action.ctaPath).toBe("/monthly-plan");
    expect(action.nextStepHint).toContain("根据AI短板");
  });

  it("规则4：有 active 月度计划时展示进度", () => {
    const action = resolveClientProjectCardPrimaryAction({
      completionScore: 90,
      hasCompletedT0Baseline: true,
      hasActiveMonthlyPlan: true,
      monthlyPlanCompletedCount: 2,
      monthlyPlanTotalCount: 5,
    });
    expect(action.ctaLabel).toBe("继续执行本月计划");
    expect(action.ctaPath).toBe("/monthly-plan");
    expect(action.nextStepHint).toBe("当前进度2/5项已完成");
  });
});

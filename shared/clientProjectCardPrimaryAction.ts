/**
 * 客户项目卡片首步引导（/clients）— 与建档 / 检测 / 月度计划状态对齐
 */

export const CLIENT_PROFILE_COMPLETE_THRESHOLD = 80;

export type ClientProjectCardPrimaryActionId =
  | "profile_incomplete"
  | "ai_diagnosis_pending"
  | "monthly_plan_generate"
  | "monthly_plan_active";

export type ClientProjectCardPrimaryActionInput = {
  completionScore: number;
  hasCompletedT0Baseline: boolean;
  hasActiveMonthlyPlan: boolean;
  monthlyPlanCompletedCount?: number;
  monthlyPlanTotalCount?: number;
};

export type ClientProjectCardPrimaryAction = {
  id: ClientProjectCardPrimaryActionId;
  stageLabel: string;
  ctaLabel: string;
  /** 不含 projectId，由前端 buildProjectUrl 拼接 */
  ctaPath: string;
  nextStepHint: string;
};

/**
 * 客户卡片主按钮与下一步文案（命中即停止）：
 * 1. 建档未完成（completionScore < 80）
 * 2. 建档完成但未完成 AI 现状检测
 * 3. 检测完成且有进行中的月度计划
 * 4. 检测完成但无 active 月度计划
 */
export function resolveClientProjectCardPrimaryAction(
  input: ClientProjectCardPrimaryActionInput,
): ClientProjectCardPrimaryAction {
  if (input.completionScore < CLIENT_PROFILE_COMPLETE_THRESHOLD) {
    return {
      id: "profile_incomplete",
      stageLabel: "待建档",
      ctaLabel: "完成品牌建档",
      ctaPath: "/enterprise-profile",
      nextStepHint: "补齐品牌信息，让AI正确认识你",
    };
  }

  if (!input.hasCompletedT0Baseline) {
    return {
      id: "ai_diagnosis_pending",
      stageLabel: "待诊断",
      ctaLabel: "开始AI现状检测",
      ctaPath: "/ai-diagnosis",
      nextStepHint: "检测AI当前是否认识并推荐你的品牌",
    };
  }

  if (input.hasActiveMonthlyPlan) {
    const completed = input.monthlyPlanCompletedCount ?? 0;
    const total = input.monthlyPlanTotalCount ?? 0;
    const progressHint =
      total > 0 ? `当前进度${completed}/${total}项已完成` : "当前进度进行中";
    return {
      id: "monthly_plan_active",
      stageLabel: "优化中",
      ctaLabel: "继续执行本月计划",
      ctaPath: "/monthly-plan",
      nextStepHint: progressHint,
    };
  }

  return {
    id: "monthly_plan_generate",
    stageLabel: "待计划",
    ctaLabel: "生成本月优化计划",
    ctaPath: "/monthly-plan",
    nextStepHint: "根据AI短板制定本月优化任务",
  };
}

/**
 * 客户项目卡片首步引导（/clients）— 与建档 / 检测 / 月度计划状态对齐
 */

export const CLIENT_PROFILE_COMPLETE_THRESHOLD = 80;

export type ClientProjectCardPrimaryActionId =
  | "profile_incomplete"
  | "ai_diagnosis_pending"
  | "monthly_plan_generate"
  | "monthly_plan_active"
  | "publish_pending"
  | "verification_pending"
  | "report_ready"
  | "renewal_follow_up";

export type ClientProjectCardPrimaryActionInput = {
  completionScore: number;
  hasCompletedT0Baseline: boolean;
  hasActiveMonthlyPlan: boolean;
  monthlyPlanCompletedCount?: number;
  monthlyPlanTotalCount?: number;
  articleCount?: number;
  publishCount?: number;
  aiTestCount?: number;
  latestGeoScore?: number | null;
  subscriptionServiceStatus?: string | null;
};

export type ClientProjectCardPrimaryAction = {
  id: ClientProjectCardPrimaryActionId;
  stageLabel: string;
  ctaLabel: string;
  /** 不含 projectId，由前端 buildProjectUrl 拼接 */
  ctaPath: string;
  nextStepHint: string;
  majorProblem: string;
  monthlyProgressLabel: string;
  riskLabels: string[];
  needsAttention: boolean;
  serviceActive: boolean;
  reportReady: boolean;
  renewalRisk: boolean;
};

function buildAction(input: {
  id: ClientProjectCardPrimaryActionId;
  stageLabel: string;
  ctaLabel: string;
  ctaPath: string;
  nextStepHint: string;
  majorProblem: string;
  monthlyProgressLabel: string;
  riskLabels?: string[];
  needsAttention?: boolean;
  serviceActive?: boolean;
  reportReady?: boolean;
  renewalRisk?: boolean;
}): ClientProjectCardPrimaryAction {
  return {
    id: input.id,
    stageLabel: input.stageLabel,
    ctaLabel: input.ctaLabel,
    ctaPath: input.ctaPath,
    nextStepHint: input.nextStepHint,
    majorProblem: input.majorProblem,
    monthlyProgressLabel: input.monthlyProgressLabel,
    riskLabels: input.riskLabels ?? [],
    needsAttention: input.needsAttention ?? false,
    serviceActive: input.serviceActive ?? false,
    reportReady: input.reportReady ?? false,
    renewalRisk: input.renewalRisk ?? false,
  };
}

function monthlyProgressLabel(input: ClientProjectCardPrimaryActionInput): string {
  const completed = input.monthlyPlanCompletedCount ?? 0;
  const total = input.monthlyPlanTotalCount ?? 0;
  if (total > 0) return `${completed}/${total} 项完成`;
  return input.hasActiveMonthlyPlan ? "服务执行中" : "待制定";
}

function renewalRiskFromStatus(status: string | null | undefined): boolean {
  return status === "expired" || status === "expiring_soon" || status === "paused";
}

/**
 * 客户卡片主按钮与下一步文案（命中即停止）：
 * 1. 建档未完成（completionScore < 80）
 * 2. 建档完成但未完成 AI 能见度诊断
 * 3. 检测完成且有进行中的月度计划
 * 4. 检测完成但无 active 月度计划
 */
export function resolveClientProjectCardPrimaryAction(
  input: ClientProjectCardPrimaryActionInput,
): ClientProjectCardPrimaryAction {
  const renewalRisk = renewalRiskFromStatus(input.subscriptionServiceStatus);
  const baseRiskLabels = renewalRisk ? ["续费风险"] : [];

  if (
    renewalRisk &&
    input.hasCompletedT0Baseline &&
    ((input.monthlyPlanCompletedCount ?? 0) > 0 || (input.articleCount ?? 0) > 0 || (input.publishCount ?? 0) > 0)
  ) {
    return buildAction({
      id: "renewal_follow_up",
      stageLabel: "续费跟进",
      ctaLabel: "查看交付报告",
      ctaPath: "/delivery-reports",
      nextStepHint: "先用本月执行和效果证据解释续费价值",
      majorProblem: "服务即将到期，需要准备续费证明",
      monthlyProgressLabel: monthlyProgressLabel(input),
      riskLabels: baseRiskLabels,
      needsAttention: true,
      serviceActive: true,
      reportReady: true,
      renewalRisk: true,
    });
  }

  if (input.completionScore < CLIENT_PROFILE_COMPLETE_THRESHOLD) {
    return buildAction({
      id: "profile_incomplete",
      stageLabel: "待建档",
      ctaLabel: "去完善资料",
      ctaPath: "/enterprise-profile",
      nextStepHint: "补齐品牌、客户和案例资料，后续诊断才有依据",
      majorProblem: "资料不完整，AI 还难以准确理解品牌",
      monthlyProgressLabel: "待完善资料",
      riskLabels: ["资料不完整", ...baseRiskLabels],
      needsAttention: true,
      renewalRisk,
    });
  }

  if (!input.hasCompletedT0Baseline) {
    return buildAction({
      id: "ai_diagnosis_pending",
      stageLabel: "待诊断",
      ctaLabel: "去看诊断",
      ctaPath: "/ai-diagnosis",
      nextStepHint: "先确认 AI 是否知道、提到并推荐这个客户",
      majorProblem: "缺少 AI 现状基线，暂时无法证明问题",
      monthlyProgressLabel: "待诊断",
      riskLabels: ["未完成诊断", ...baseRiskLabels],
      needsAttention: true,
      renewalRisk,
    });
  }

  if (input.hasActiveMonthlyPlan) {
    const completed = input.monthlyPlanCompletedCount ?? 0;
    const total = input.monthlyPlanTotalCount ?? 0;
    const progressLabel = monthlyProgressLabel(input);
    const allPlanTasksDone = total > 0 && completed >= total;
    if (allPlanTasksDone || ((input.publishCount ?? 0) > 0 && (input.aiTestCount ?? 0) > 0)) {
      return buildAction({
        id: "report_ready",
        stageLabel: "可出报告",
      ctaLabel: "去交付报告",
        ctaPath: "/delivery-reports",
        nextStepHint: "整理本月执行、效果变化和下月建议，用于客户复盘",
        majorProblem: "需要把服务动作转成客户能看懂的价值证明",
        monthlyProgressLabel: progressLabel,
        riskLabels: baseRiskLabels,
        serviceActive: true,
        reportReady: true,
        renewalRisk,
      });
    }
    if ((input.articleCount ?? 0) > (input.publishCount ?? 0)) {
      return buildAction({
        id: "publish_pending",
        stageLabel: "待发布",
        ctaLabel: "去执行进度",
        ctaPath: "/weekly",
        nextStepHint: "已有内容资产，优先推进发布和公开信源沉淀",
        majorProblem: "内容已生成但还没有形成公开证据",
        monthlyProgressLabel: progressLabel,
        riskLabels: ["待发布", ...baseRiskLabels],
        needsAttention: true,
        serviceActive: true,
        renewalRisk,
      });
    }
    if ((input.publishCount ?? 0) > 0 && (input.aiTestCount ?? 0) === 0) {
      return buildAction({
        id: "verification_pending",
        stageLabel: "待验证",
        ctaLabel: "去收录与 AI 复测",
        ctaPath: "/inclusion-monitoring",
        nextStepHint: "发布后需要验证内容是否被搜索和 AI 看见",
        majorProblem: "已有发布动作，但缺少收录与 AI 复测",
        monthlyProgressLabel: progressLabel,
        riskLabels: ["待验证", ...baseRiskLabels],
        needsAttention: true,
        serviceActive: true,
        renewalRisk,
      });
    }
    return buildAction({
      id: "monthly_plan_active",
      stageLabel: "本月服务中",
      ctaLabel: "去执行进度",
      ctaPath: "/weekly",
      nextStepHint: total > 0 ? `按月度优化计划继续推进，当前 ${completed}/${total} 项完成` : "按月度优化计划继续推进交付",
      majorProblem:
        input.latestGeoScore != null && input.latestGeoScore < 60
          ? "AI 成熟度偏低，需要继续补内容和信源"
          : "本月服务正在执行，需要持续推进",
      monthlyProgressLabel: progressLabel,
      riskLabels: baseRiskLabels,
      serviceActive: true,
      renewalRisk,
    });
  }

  return buildAction({
    id: "monthly_plan_generate",
    stageLabel: "待制定方案",
    ctaLabel: "去月度优化计划",
    ctaPath: "/monthly-plan",
    nextStepHint: "根据 AI 短板制定本月 3 件服务事项",
    majorProblem:
      input.latestGeoScore != null && input.latestGeoScore < 60
        ? "AI 成熟度偏低，需要明确本月优先级"
        : "已有诊断结果，但还没有转成服务方案",
    monthlyProgressLabel: "待制定",
    riskLabels: ["待制定方案", ...baseRiskLabels],
    needsAttention: true,
    renewalRisk,
  });
}

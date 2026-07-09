export type SellableDeliveryLoopStepId =
  | "diagnosis"
  | "maturity"
  | "monthlyPlan"
  | "content"
  | "publish"
  | "monitoring"
  | "retest"
  | "report";

export type SellableDeliveryLoopStepStatus = "done" | "current" | "pending";

export type SellableDeliveryLoopStep = {
  id: SellableDeliveryLoopStepId;
  label: string;
  status: SellableDeliveryLoopStepStatus;
  customerMeaning: string;
};

export type SellableDeliveryLoopPriority = {
  title: string;
  dimensionName: string;
  source: "existing_task" | "suggestion";
};

export type SellableDeliveryLoopInput = {
  maturityScore: number | null;
  maturityLevel?: string | null;
  hasDiagnosis: boolean;
  monthlyPlanTotalCount: number;
  monthlyPlanCompletedCount: number;
  articleCount: number;
  publishCount: number;
  monitoringRecordCount: number;
  retestComparisonCount: number;
  reportCount: number;
  brandMentionRate: number | null;
  recommendRate: number | null;
  priorities: SellableDeliveryLoopPriority[];
  nextActionLabel?: string | null;
  nextActionReason?: string | null;
};

export type SellableDeliveryLoopView = {
  headline: string;
  stageSummary: string;
  currentFocus: string;
  proofLine: string;
  renewalReason: string;
  nextActionLabel: string;
  nextActionReason: string;
  steps: SellableDeliveryLoopStep[];
};

const STEP_META: Array<Omit<SellableDeliveryLoopStep, "status">> = [
  {
    id: "diagnosis",
    label: "诊断",
    customerMeaning: "先确认 AI 是否认识、提及、推荐品牌。",
  },
  {
    id: "maturity",
    label: "评分",
    customerMeaning: "把问题归因到成熟度短板，知道为什么不推荐。",
  },
  {
    id: "monthlyPlan",
    label: "计划",
    customerMeaning: "把短板转成本月 Top 3 服务方案。",
  },
  {
    id: "content",
    label: "内容",
    customerMeaning: "围绕 AI 搜索问题生成可引用内容资产。",
  },
  {
    id: "publish",
    label: "发布",
    customerMeaning: "让内容进入公开平台，成为 AI 可读取信源。",
  },
  {
    id: "monitoring",
    label: "监测",
    customerMeaning: "确认内容是否被收录、曝光、触发关键词。",
  },
  {
    id: "retest",
    label: "复测",
    customerMeaning: "验证 AI 回答是否开始变化。",
  },
  {
    id: "report",
    label: "月报",
    customerMeaning: "沉淀本月做了什么、有什么变化、下月为什么继续。",
  },
];

function percent(value: number | null): string {
  if (value == null) return "待复测";
  return `${Math.round(value * 100)}%`;
}

function resolveDoneSteps(input: SellableDeliveryLoopInput): Set<SellableDeliveryLoopStepId> {
  const done = new Set<SellableDeliveryLoopStepId>();
  if (input.hasDiagnosis) done.add("diagnosis");
  if (input.maturityScore != null) done.add("maturity");
  if (input.monthlyPlanTotalCount > 0 || input.priorities.length > 0) done.add("monthlyPlan");
  if (input.articleCount > 0) done.add("content");
  if (input.publishCount > 0) done.add("publish");
  if (input.monitoringRecordCount > 0) done.add("monitoring");
  if (input.retestComparisonCount > 0) done.add("retest");
  if (input.reportCount > 0) done.add("report");
  return done;
}

function resolveCurrentStep(done: Set<SellableDeliveryLoopStepId>): SellableDeliveryLoopStepId {
  return STEP_META.find(step => !done.has(step.id))?.id ?? "report";
}

function resolveHeadline(currentStep: SellableDeliveryLoopStepId, input: SellableDeliveryLoopInput): string {
  if (currentStep === "diagnosis") return "先建立 AI 搜索现状基线";
  if (currentStep === "maturity") return "把诊断结果转成成熟度评分";
  if (currentStep === "monthlyPlan") return "把短板转成月度优化计划";
  if (currentStep === "content") return "月度优化计划执行中";
  if (currentStep === "publish") return "内容资产已生成，下一步发布成公开信源";
  if (currentStep === "monitoring") return "已进入发布后监测阶段";
  if (currentStep === "retest") return "等待 AI 复测证明变化";
  if (input.reportCount > 0) return "本月交付证据已可用于续费沟通";
  return "准备沉淀本月交付报告";
}

function resolveCurrentFocus(input: SellableDeliveryLoopInput): string {
  if (input.priorities.length === 0) {
    return "当前重点：先完成诊断、成熟度评分与本月计划。";
  }
  const top = input.priorities
    .slice(0, 3)
    .map(priority => priority.dimensionName || priority.title)
    .join("、");
  return `当前重点：${top}。`;
}

function resolveProofLine(input: SellableDeliveryLoopInput): string {
  const monthly =
    input.monthlyPlanTotalCount > 0
      ? `本月任务 ${input.monthlyPlanCompletedCount}/${input.monthlyPlanTotalCount}`
      : "本月任务待制定";
  return [
    monthly,
    `内容资产 ${input.articleCount} 篇`,
    `发布记录 ${input.publishCount} 条`,
    `监测记录 ${input.monitoringRecordCount} 条`,
    `复测对比 ${input.retestComparisonCount} 次`,
    `交付报告 ${input.reportCount} 份`,
  ].join(" · ");
}

function resolveRenewalReason(input: SellableDeliveryLoopInput): string {
  if (input.reportCount > 0 && input.retestComparisonCount > 0) {
    return "续费解释：本月已经形成从执行动作到 AI 变化的证据，下月应继续扩大问题覆盖和推荐理由。";
  }
  if (input.publishCount > 0 || input.articleCount > 0) {
    return "续费解释：本月不是只发文章，而是在补 AI 可读取的品牌答案资产；下一步要用收录监测和 AI 复测证明变化。";
  }
  if (input.monthlyPlanTotalCount > 0 || input.priorities.length > 0) {
    return "续费解释：当前已经明确本月短板和服务方案，价值会在内容发布、监测和复测后逐步被证明。";
  }
  return "续费解释：当前仍处在基线建立阶段，需要先让客户看懂 AI 为什么不推荐，再进入持续优化。";
}

export function buildSellableDeliveryLoopView(input: SellableDeliveryLoopInput): SellableDeliveryLoopView {
  const done = resolveDoneSteps(input);
  const currentStep = resolveCurrentStep(done);
  const steps: SellableDeliveryLoopStep[] = STEP_META.map(step => ({
    ...step,
    status: done.has(step.id) ? "done" : step.id === currentStep ? "current" : "pending",
  }));
  const scoreText = input.maturityScore == null
    ? "成熟度待评分"
    : `成熟度 ${input.maturityScore} 分${input.maturityLevel ? ` · ${input.maturityLevel}` : ""}`;
  const rateText = `提及率 ${percent(input.brandMentionRate)} · 推荐率 ${percent(input.recommendRate)}`;

  return {
    headline: resolveHeadline(currentStep, input),
    stageSummary: `${scoreText}；${rateText}`,
    currentFocus: resolveCurrentFocus(input),
    proofLine: resolveProofLine(input),
    renewalReason: resolveRenewalReason(input),
    nextActionLabel: input.nextActionLabel?.trim() || STEP_META.find(step => step.id === currentStep)?.label || "继续推进",
    nextActionReason:
      input.nextActionReason?.trim() ||
      STEP_META.find(step => step.id === currentStep)?.customerMeaning ||
      "继续推进下一轮优化。",
    steps,
  };
}

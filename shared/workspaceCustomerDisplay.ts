import type { MonthlyPlanWorkspaceStage } from "./monthlyPlanGeneration";
import type { WorkspaceStageId } from "./workspaceStateMachine";

/** 客户可读阶段（不暴露内部枚举名） */
export const CUSTOMER_STAGE_LABELS: Record<WorkspaceStageId, string> = {
  bind_publish_env: "待绑定发布",
  complete_geo_profile: "待建档",
  ai_diagnosis: "待诊断",
  generate_content: "待生产",
  publish_content: "待发布",
  retest_queue: "待监测",
  optimize: "优化中",
  delivery_report: "报告已生成",
};

export const MONTHLY_PLAN_CUSTOMER_STATUS_LABELS: Record<MonthlyPlanWorkspaceStage, string> = {
  none: "待制定本月计划",
  executing: "本月计划执行中",
  waiting_retest: "等待复测",
  retest_ready: "可执行复测",
  completed: "本月计划已完成",
};

export type WorkspaceCustomerStatusInput = {
  stageId: WorkspaceStageId;
  monthlyPlanStage?: MonthlyPlanWorkspaceStage | null;
  hasAiTestData: boolean;
  hasCompletedT0Baseline: boolean;
};

/** 工作台右上角状态标签：与当前阶段主按钮一致，禁止「有待实测数据仍显示待诊断」 */
export function resolveWorkspaceCustomerStatusLabel(input: WorkspaceCustomerStatusInput): string {
  if (input.monthlyPlanStage && input.monthlyPlanStage !== "none") {
    return MONTHLY_PLAN_CUSTOMER_STATUS_LABELS[input.monthlyPlanStage];
  }
  if (
    input.hasAiTestData ||
    input.hasCompletedT0Baseline ||
    (input.stageId === "ai_diagnosis" && input.hasAiTestData)
  ) {
    if (input.stageId === "ai_diagnosis") {
      return "实测已完成";
    }
  }
  return CUSTOMER_STAGE_LABELS[input.stageId];
}

export function workspaceHasAiTestData(metrics: {
  aiTestResultCount?: number;
  brandMentionRate?: number | null;
  hasCompletedT0Baseline?: boolean;
}): boolean {
  return (
    (metrics.aiTestResultCount ?? 0) > 0 ||
    metrics.brandMentionRate != null ||
    Boolean(metrics.hasCompletedT0Baseline)
  );
}

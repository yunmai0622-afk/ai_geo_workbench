/**
 * GEO-V2.1-P3：代运营交付驾驶舱（纯展示/聚合逻辑）
 */

import { daysUntil } from "./platformAdmin";
import { ONBOARDING_WIZARD_STEPS } from "./onboardingWizardSteps";
import { isWizardStepComplete } from "./onboardingWizardCompleteness";

export const DELIVERY_COMMAND_CENTER_TITLE = "交付驾驶舱";
export const DELIVERY_COMMAND_CENTER_SUBTITLE = "管理所有客户项目的交付进度与风险。";

export const PROFILE_COMPLETENESS_STEP_TOTAL = ONBOARDING_WIZARD_STEPS.length;

export type DeliveryTodoUrgency = "urgent" | "pending" | "in_progress";

export type CommandCenterRenewalRisk = "normal" | "attention" | "high";

export const COMMAND_CENTER_RENEWAL_RISK_LABELS: Record<CommandCenterRenewalRisk, string> = {
  normal: "正常",
  attention: "关注",
  high: "高风险",
};

export type DeliveryQuickAction = "workspace" | "profile" | "aiDiagnosis" | "monthlyPlan" | "content";

export const DELIVERY_QUICK_ACTION_LABELS: Record<DeliveryQuickAction, string> = {
  workspace: "进入工作台",
  profile: "去完成建档",
  aiDiagnosis: "去 AI 诊断",
  monthlyPlan: "去执行本月计划",
  content: "去内容生产",
};

export type DeliveryCommandProjectInput = {
  companyId: number;
  companyName: string;
  projectId: number;
  projectName: string;
  hasSubscription: boolean;
  subscriptionExpiresAt: Date | string | null;
  profileCompletionScore: number;
  profileCompletedSteps: number;
  hasAiTest: boolean;
  lastAiTestAt: Date | string | null;
  monthlyPlanProgress: { completedCount: number; totalCount: number; rate: number };
  monthlyPlanStatus: "none" | "active" | "completed";
  monthlyReportStatus: string;
  retestScheduledAt: Date | string | null;
  retestCompletedAt: Date | string | null;
  contentGeneratedCount: number;
  contentPublishedCount: number;
  inclusionIncludedCount: number;
  inclusionPendingCount: number;
  contentGeneratingCount: number;
  contentStuckGeneratingCount: number;
  contentPendingReviewCount: number;
  contentPendingReviewStaleCount: number;
  contentGeneratedThisMonthCount: number;
  contentPublishedThisMonthCount: number;
  currentMonthPlanRate: number | null;
  recentTwoMonthPlanRates: number[];
  lastActivityAt: Date | string | null;
  lastReportAt: Date | string | null;
};

export type DeliveryTodoItem = {
  id: string;
  urgency: DeliveryTodoUrgency;
  companyName: string;
  clientLabel: string;
  projectId: number;
  projectName: string;
  description: string;
  lastActionAt: string | null;
  actionPath: string;
  actionLabel: string;
};

export type DeliveryCommandOverviewRow = {
  companyId: number;
  companyName: string;
  projectId: number;
  projectName: string;
  subscriptionExpiresAt: string | null;
  subscriptionLabel: string;
  profileCompletedSteps: number;
  profileTotalSteps: number;
  currentStageLabel: string;
  contentAssetsLabel: string;
  monthlyReportStatus: string;
  renewalRisk: CommandCenterRenewalRisk;
  renewalRiskLabel: string;
  highlightedQuickAction: DeliveryQuickAction;
  quickActionPaths: Record<DeliveryQuickAction, string>;
  workspacePath: string;
};

export type DeliveryCommandMonthlyStats = {
  totalCustomers: number;
  aiDiagnosisCompletedThisMonth: number;
  contentGeneratedThisMonth: number;
  contentPublishedThisMonth: number;
  monthlyReportsGeneratedThisMonth: number;
  highRenewalRiskCount: number;
};

export type DeliveryCommandCenterView = {
  todos: {
    urgent: DeliveryTodoItem[];
    pending: DeliveryTodoItem[];
    inProgress: DeliveryTodoItem[];
  };
  overview: DeliveryCommandOverviewRow[];
  monthlyStats: DeliveryCommandMonthlyStats;
  unconfiguredSubscriptionCount: number;
};

const MS_PER_HOUR = 3_600_000;

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function formatDateTime(value: Date | string | null | undefined): string | null {
  const ts = toTimestamp(value);
  if (ts == null) return null;
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function hoursSince(value: Date | string | null | undefined, now: Date): number | null {
  const ts = toTimestamp(value);
  if (ts == null) return null;
  return (now.getTime() - ts) / MS_PER_HOUR;
}

function daysSince(value: Date | string | null | undefined, now: Date): number | null {
  const hours = hoursSince(value, now);
  if (hours == null) return null;
  return Math.floor(hours / 24);
}

function isSameCalendarMonth(value: Date | string | null | undefined, now: Date): boolean {
  const ts = toTimestamp(value);
  if (ts == null) return false;
  const date = new Date(ts);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function countProfileCompletedSteps(input: {
  profile: Record<string, unknown> | null | undefined;
  questionCount?: number;
  customerCaseCount?: number;
  brandSourceCount?: number;
}): number {
  const profile = input.profile ?? {};
  let completed = 0;
  for (let step = 1; step <= PROFILE_COMPLETENESS_STEP_TOTAL; step += 1) {
    if (
      isWizardStepComplete(step, profile, {
        questionCount: input.questionCount ?? 0,
        customerCaseCount: input.customerCaseCount ?? 0,
        brandSourceCount: input.brandSourceCount ?? 0,
      })
    ) {
      completed += 1;
    }
  }
  return completed;
}

export function countProjectsByCompany(
  projects: Pick<DeliveryCommandProjectInput, "companyId">[],
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const project of projects) {
    counts.set(project.companyId, (counts.get(project.companyId) ?? 0) + 1);
  }
  return counts;
}

export function formatDeliveryClientLabel(input: {
  companyName: string;
  projectName: string;
  projectId: number;
  companyProjectCount: number;
}): string {
  if (input.companyProjectCount <= 1) return input.companyName;
  const companyName = input.companyName.trim();
  const projectName = input.projectName.trim();
  if (!projectName || projectName === companyName) {
    return `${companyName} · 项目#${input.projectId}`;
  }
  return `${companyName} · ${projectName}`;
}

export function formatCommandCenterSubscriptionLabel(input: {
  hasSubscription: boolean;
  subscriptionExpiresAt: Date | string | null;
  now?: Date;
}): string {
  if (!input.hasSubscription || !input.subscriptionExpiresAt) return "未配置";
  return new Date(input.subscriptionExpiresAt).toLocaleDateString("zh-CN");
}

export function formatCommandCenterCurrentStageLabel(input: {
  profileCompletionScore: number;
  profileCompletedSteps: number;
  profileTotalSteps: number;
  hasAiTest: boolean;
  monthlyPlanStatus: "none" | "active" | "completed";
  completedCount: number;
  totalCount: number;
}): string {
  if (input.profileCompletionScore < 80) {
    return `建档中 ${input.profileCompletedSteps}/${input.profileTotalSteps}步`;
  }
  if (!input.hasAiTest) return "待诊断";
  if (input.monthlyPlanStatus === "none" || input.totalCount === 0) return "待制定计划";
  if (
    input.monthlyPlanStatus === "active" &&
    input.totalCount > 0 &&
    input.completedCount < input.totalCount
  ) {
    return `执行中 ${input.completedCount}/${input.totalCount}`;
  }
  return "本月完成";
}

export function formatCommandCenterContentAssetsLabel(input: {
  contentGeneratedCount: number;
  inclusionIncludedCount: number;
}): string {
  return `已生成${input.contentGeneratedCount}篇 · 已收录${input.inclusionIncludedCount}篇`;
}

export function resolveDeliveryQuickActionHighlight(
  project: Pick<
    DeliveryCommandProjectInput,
    | "profileCompletionScore"
    | "hasAiTest"
    | "monthlyPlanStatus"
    | "monthlyPlanProgress"
    | "contentGeneratingCount"
    | "contentPendingReviewCount"
  >,
): DeliveryQuickAction {
  if (project.profileCompletionScore < 80) return "profile";
  if (!project.hasAiTest) return "aiDiagnosis";
  if (project.monthlyPlanStatus === "none" || project.monthlyPlanProgress.totalCount === 0) {
    return "monthlyPlan";
  }
  if (
    project.monthlyPlanStatus === "active" &&
    project.monthlyPlanProgress.completedCount < project.monthlyPlanProgress.totalCount
  ) {
    return "monthlyPlan";
  }
  if (project.contentGeneratingCount > 0 || project.contentPendingReviewCount > 0) {
    return "content";
  }
  return "workspace";
}

export function buildDeliveryQuickActionPaths(projectId: number): Record<DeliveryQuickAction, string> {
  return {
    workspace: workspacePath(projectId, "/workspace"),
    profile: workspacePath(projectId, "/enterprise-profile"),
    aiDiagnosis: workspacePath(projectId, "/ai-diagnosis"),
    monthlyPlan: workspacePath(projectId, "/monthly-plan"),
    content: workspacePath(projectId, "/weekly"),
  };
}

function hasUnfinishedDeliveryContent(project: DeliveryCommandProjectInput): boolean {
  const { monthlyPlanProgress, contentGeneratingCount, contentPendingReviewCount } = project;
  return (
    (monthlyPlanProgress.totalCount > 0 &&
      monthlyPlanProgress.completedCount < monthlyPlanProgress.totalCount) ||
    contentGeneratingCount > 0 ||
    contentPendingReviewCount > 0
  );
}

export function computeCommandCenterRenewalRisk(input: {
  hasSubscription: boolean;
  daysUntilExpiry: number | null;
  currentMonthPlanRate: number | null;
  recentTwoMonthPlanRates: number[];
  hasUnfinishedContent?: boolean;
}): CommandCenterRenewalRisk {
  if (!input.hasSubscription) {
    const rate = input.currentMonthPlanRate ?? 0;
    if (rate === 0 && input.hasUnfinishedContent) return "attention";
    return "normal";
  }

  const rate = input.currentMonthPlanRate ?? 1;
  const days = input.daysUntilExpiry;

  if (days != null && days <= 30 && rate < 0.5) return "high";

  const twoMonthLow =
    input.recentTwoMonthPlanRates.length >= 2 &&
    input.recentTwoMonthPlanRates.every(planRate => planRate < 0.5);
  if ((days != null && days <= 60) || twoMonthLow) return "attention";

  return "normal";
}

export function formatCommandCenterAiDiagnosisLabel(input: {
  hasAiTest: boolean;
  lastAiTestAt: Date | string | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  if (!input.hasAiTest) return "未开始";
  const days = daysSince(input.lastAiTestAt, now);
  if (days == null) return "已完成";
  if (days === 0) return "已完成（今天）";
  return `已完成（${days} 天前）`;
}

export function formatCommandCenterMonthlyPlanLabel(input: {
  monthlyPlanStatus: "none" | "active" | "completed";
  completedCount: number;
  totalCount: number;
}): string {
  if (input.monthlyPlanStatus === "none" || input.totalCount === 0) return "未生成";
  if (input.monthlyPlanStatus === "completed" || input.completedCount >= input.totalCount) {
    return "已完成";
  }
  return `执行中 ${input.completedCount}/${input.totalCount}`;
}

function workspacePath(projectId: number, path: string): string {
  return `${path}?projectId=${projectId}`;
}

export function buildDeliveryCommandTodos(
  projects: DeliveryCommandProjectInput[],
  now: Date = new Date(),
): DeliveryCommandCenterView["todos"] {
  const urgent: DeliveryTodoItem[] = [];
  const pending: DeliveryTodoItem[] = [];
  const inProgress: DeliveryTodoItem[] = [];
  const projectsByCompany = countProjectsByCompany(projects);

  for (const project of projects) {
    const clientLabel = formatDeliveryClientLabel({
      companyName: project.companyName,
      projectName: project.projectName,
      projectId: project.projectId,
      companyProjectCount: projectsByCompany.get(project.companyId) ?? 1,
    });
    const base = {
      companyName: project.companyName,
      clientLabel,
      projectId: project.projectId,
      projectName: project.projectName,
      lastActionAt: formatDateTime(project.lastActivityAt),
    };
    const expiryDays = daysUntil(project.subscriptionExpiresAt, now);

    const reportOverdue =
      project.monthlyPlanStatus !== "none" &&
      project.monthlyPlanProgress.totalCount > 0 &&
      project.monthlyPlanProgress.completedCount >= project.monthlyPlanProgress.totalCount &&
      project.monthlyReportStatus !== "已生成";

    if (reportOverdue) {
      urgent.push({
        ...base,
        id: `${project.projectId}-report-overdue`,
        urgency: "urgent",
        description: "月报已到期未生成",
        actionPath: workspacePath(project.projectId, "/delivery-reports"),
        actionLabel: "去生成月报",
      });
    }

    if (project.contentStuckGeneratingCount > 0) {
      urgent.push({
        ...base,
        id: `${project.projectId}-content-stuck`,
        urgency: "urgent",
        description: `内容生成卡住超过 24 小时（${project.contentStuckGeneratingCount} 项）`,
        actionPath: workspacePath(project.projectId, "/weekly"),
        actionLabel: "去处理内容",
      });
    }

    if (expiryDays != null && expiryDays < 0) {
      urgent.push({
        ...base,
        id: `${project.projectId}-expired`,
        urgency: "urgent",
        description: "客户套餐已到期",
        actionPath: workspacePath(project.projectId, "/workspace"),
        actionLabel: "进入项目",
      });
    } else if (expiryDays != null && expiryDays >= 0 && expiryDays <= 7) {
      urgent.push({
        ...base,
        id: `${project.projectId}-expiring-soon`,
        urgency: "urgent",
        description: `客户套餐 ${expiryDays} 天内到期`,
        actionPath: workspacePath(project.projectId, "/workspace"),
        actionLabel: "进入项目",
      });
    } else if (expiryDays != null && expiryDays > 7 && expiryDays <= 30) {
      pending.push({
        ...base,
        id: `${project.projectId}-expiring-month`,
        urgency: "pending",
        description: `客户套餐 ${expiryDays} 天内到期，建议提前续费`,
        actionPath: workspacePath(project.projectId, "/workspace"),
        actionLabel: "进入项目",
      });
    }

    if (project.profileCompletionScore < 80) {
      pending.push({
        ...base,
        id: `${project.projectId}-profile-incomplete`,
        urgency: "pending",
        description: `建档未完成（完成度 ${project.profileCompletionScore}%）`,
        actionPath: workspacePath(project.projectId, "/enterprise-profile"),
        actionLabel: "去完善建档",
      });
    }

    const aiDays = daysSince(project.lastAiTestAt, now);
    if (!project.hasAiTest || (aiDays != null && aiDays > 30)) {
      pending.push({
        ...base,
        id: `${project.projectId}-ai-diagnosis`,
        urgency: "pending",
        description: project.hasAiTest ? "AI 诊断超过 30 天未复测" : "AI 诊断未开始",
        actionPath: workspacePath(project.projectId, "/ai-diagnosis"),
        actionLabel: "去 AI 诊断",
      });
    }

    if (
      project.monthlyPlanStatus === "active" &&
      project.monthlyPlanProgress.totalCount > 0 &&
      project.monthlyPlanProgress.completedCount === 0
    ) {
      pending.push({
        ...base,
        id: `${project.projectId}-plan-not-started`,
        urgency: "pending",
        description: `本月计划未执行（0/${project.monthlyPlanProgress.totalCount}）`,
        actionPath: workspacePath(project.projectId, "/monthly-plan"),
        actionLabel: "去执行计划",
      });
    }

    if (project.contentPendingReviewStaleCount > 0) {
      pending.push({
        ...base,
        id: `${project.projectId}-review-stale`,
        urgency: "pending",
        description: `有 ${project.contentPendingReviewStaleCount} 篇内容待质检超过 3 天`,
        actionPath: workspacePath(project.projectId, "/weekly"),
        actionLabel: "去质检",
      });
    }

    if (project.contentGeneratingCount > 0) {
      inProgress.push({
        ...base,
        id: `${project.projectId}-content-generating`,
        urgency: "in_progress",
        description: `内容生成中（${project.contentGeneratingCount} 项）`,
        actionPath: workspacePath(project.projectId, "/weekly"),
        actionLabel: "查看进度",
      });
    }

    if (project.inclusionPendingCount > 0) {
      inProgress.push({
        ...base,
        id: `${project.projectId}-inclusion-pending`,
        urgency: "in_progress",
        description: `收录待确认（${project.inclusionPendingCount} 篇）`,
        actionPath: workspacePath(project.projectId, "/inclusion-monitoring"),
        actionLabel: "去确认收录",
      });
    }

    const retestDue =
      project.retestScheduledAt &&
      !project.retestCompletedAt &&
      toTimestamp(project.retestScheduledAt) != null &&
      toTimestamp(project.retestScheduledAt)! <= now.getTime();
    if (retestDue) {
      inProgress.push({
        ...base,
        id: `${project.projectId}-retest-pending`,
        urgency: "in_progress",
        description: "AI 复测待触发",
        actionPath: workspacePath(project.projectId, "/ai-diagnosis"),
        actionLabel: "去复测",
      });
    }
  }

  return { urgent, pending, inProgress };
}

export function buildDeliveryCommandOverviewRow(
  project: DeliveryCommandProjectInput,
  now: Date = new Date(),
): DeliveryCommandOverviewRow {
  const renewalRisk = computeCommandCenterRenewalRisk({
    hasSubscription: project.hasSubscription,
    daysUntilExpiry: daysUntil(project.subscriptionExpiresAt, now),
    currentMonthPlanRate: project.currentMonthPlanRate,
    recentTwoMonthPlanRates: project.recentTwoMonthPlanRates,
    hasUnfinishedContent: hasUnfinishedDeliveryContent(project),
  });
  const highlightedQuickAction = resolveDeliveryQuickActionHighlight(project);

  return {
    companyId: project.companyId,
    companyName: project.companyName,
    projectId: project.projectId,
    projectName: project.projectName,
    subscriptionExpiresAt: project.subscriptionExpiresAt
      ? new Date(project.subscriptionExpiresAt).toISOString()
      : null,
    subscriptionLabel: formatCommandCenterSubscriptionLabel({
      hasSubscription: project.hasSubscription,
      subscriptionExpiresAt: project.subscriptionExpiresAt,
      now,
    }),
    profileCompletedSteps: project.profileCompletedSteps,
    profileTotalSteps: PROFILE_COMPLETENESS_STEP_TOTAL,
    currentStageLabel: formatCommandCenterCurrentStageLabel({
      profileCompletionScore: project.profileCompletionScore,
      profileCompletedSteps: project.profileCompletedSteps,
      profileTotalSteps: PROFILE_COMPLETENESS_STEP_TOTAL,
      hasAiTest: project.hasAiTest,
      monthlyPlanStatus: project.monthlyPlanStatus,
      completedCount: project.monthlyPlanProgress.completedCount,
      totalCount: project.monthlyPlanProgress.totalCount,
    }),
    contentAssetsLabel: formatCommandCenterContentAssetsLabel({
      contentGeneratedCount: project.contentGeneratedCount,
      inclusionIncludedCount: project.inclusionIncludedCount,
    }),
    monthlyReportStatus: project.monthlyReportStatus,
    renewalRisk,
    renewalRiskLabel: COMMAND_CENTER_RENEWAL_RISK_LABELS[renewalRisk],
    highlightedQuickAction,
    quickActionPaths: buildDeliveryQuickActionPaths(project.projectId),
    workspacePath: workspacePath(project.projectId, "/workspace"),
  };
}

export function buildDeliveryCommandMonthlyStats(
  projects: DeliveryCommandProjectInput[],
  overview: DeliveryCommandOverviewRow[],
  now: Date = new Date(),
): DeliveryCommandMonthlyStats {
  let aiDiagnosisCompletedThisMonth = 0;
  let contentGeneratedThisMonth = 0;
  let contentPublishedThisMonth = 0;
  let monthlyReportsGeneratedThisMonth = 0;

  for (const project of projects) {
    if (project.hasAiTest && isSameCalendarMonth(project.lastAiTestAt, now)) {
      aiDiagnosisCompletedThisMonth += 1;
    }
    if (project.monthlyReportStatus === "已生成" && isSameCalendarMonth(project.lastReportAt, now)) {
      monthlyReportsGeneratedThisMonth += 1;
    }
    contentGeneratedThisMonth += project.contentGeneratedThisMonthCount;
    contentPublishedThisMonth += project.contentPublishedThisMonthCount;
  }

  return {
    totalCustomers: projects.length,
    aiDiagnosisCompletedThisMonth,
    contentGeneratedThisMonth,
    contentPublishedThisMonth,
    monthlyReportsGeneratedThisMonth,
    highRenewalRiskCount: overview.filter(row => row.renewalRisk === "high").length,
  };
}

export function buildDeliveryCommandCenterView(
  projects: DeliveryCommandProjectInput[],
  now: Date = new Date(),
): DeliveryCommandCenterView {
  const overview = projects.map(project => buildDeliveryCommandOverviewRow(project, now));
  return {
    todos: buildDeliveryCommandTodos(projects, now),
    overview,
    monthlyStats: buildDeliveryCommandMonthlyStats(projects, overview, now),
    unconfiguredSubscriptionCount: projects.filter(project => !project.hasSubscription).length,
  };
}

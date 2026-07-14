export type ScheduledRetestStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "overdue"
  | "retry_required";

export type ScheduledRetestMilestone = {
  key: string;
  dueDate: string;
  status: ScheduledRetestStatus | string | null | undefined;
};

function shanghaiDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function deriveScheduledRetestState(input: {
  milestones: ScheduledRetestMilestone[];
  currentKey?: string | null;
  currentStatus?: string | null;
  lastError?: string | null;
  now?: Date;
}) {
  const today = shanghaiDate(input.now ?? new Date());
  const milestones = [...input.milestones]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map(milestone => {
      const rawStatus = milestone.status ?? "pending";
      if (rawStatus === "completed") return { ...milestone, status: "completed" as const };
      if (rawStatus === "running") return { ...milestone, status: "running" as const };
      const isPast = milestone.dueDate < today;
      const isFailed = rawStatus === "failed"
        || (input.currentKey === milestone.key && input.currentStatus === "failed");
      if (isFailed) return { ...milestone, status: "retry_required" as const };
      if (isPast) return { ...milestone, status: "overdue" as const };
      return { ...milestone, status: "pending" as const };
    });
  const retryMilestones = milestones.filter(item => item.status === "retry_required" || item.status === "overdue");
  const nextMilestone = milestones.find(item => item.status !== "completed" && item.dueDate >= today) ?? null;
  const runningMilestone = milestones.find(item => item.status === "running") ?? null;
  const healthStatus = runningMilestone
    ? "running"
    : retryMilestones.length > 0 || input.currentStatus === "failed"
      ? "needs_attention"
      : "healthy";
  return {
    today,
    milestones,
    nextMilestone,
    retryMilestones,
    retryRequired: retryMilestones.length > 0,
    healthStatus,
    lastError: input.lastError ?? null,
  } as const;
}

export function scheduledRetestStatusLabel(status: string | null | undefined): string {
  if (status === "completed") return "已完成";
  if (status === "running") return "执行中";
  if (status === "failed" || status === "retry_required") return "自动复测失败，需补跑";
  if (status === "overdue") return "计划已过期，等待补跑";
  return "待执行";
}

export function deriveRetestReportState(input: {
  hasRetestRecord: boolean;
  currentRetestReadyCount: number;
  automaticStatus?: string | null;
  retryRequired?: boolean;
  reportPageAvailable: boolean;
  formalMonthlyReportGenerated: boolean;
  effectLoopCompleted: boolean;
}) {
  const planFailed = input.automaticStatus === "failed" || Boolean(input.retryRequired);
  return {
    hasRetestRecord: input.hasRetestRecord,
    retestRecordLabel: input.hasRetestRecord ? "已有复测记录" : "暂无复测记录",
    currentRetestReadyCount: Math.max(0, input.currentRetestReadyCount),
    automaticStatus: input.automaticStatus ?? "pending",
    planFailed,
    planRetryRequired: planFailed,
    reportPageAvailable: input.reportPageAvailable,
    formalMonthlyReportGenerated: input.formalMonthlyReportGenerated,
    effectLoopCompleted: input.effectLoopCompleted,
  } as const;
}

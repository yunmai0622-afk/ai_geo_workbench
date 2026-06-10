import {
  daysSincePublish,
  findLatestCompletedPublishAt,
  T1_RETEST_AUTO_TRIGGER_CTA_PATH,
  T1_RETEST_AUTO_TRIGGER_MESSAGE,
  type CompletedPublishTaskRow,
  type T1RetestAutoTriggerInput,
} from "./t1RetestAutoTrigger";
import {
  hasCompletedT1Retest,
  hasCompletedT2Retest,
  hasCompletedT3Retest,
  isCompletedTestRound,
  type TestRoundRow,
} from "./workspaceMainChain";

export const T1_RETEST_PLAN_DAYS = 7;
export const T2_RETEST_PLAN_DAYS = 30;
export const T3_RETEST_PLAN_DAYS = 90;

export const T2_RETEST_DUE_MESSAGE = "距上次发布已超过30天，建议执行14天后复测";
export const T3_RETEST_DUE_MESSAGE = "距上次发布已超过90天，建议执行30天后复测";
export const RETEST_DUE_CTA_LABEL = "去执行复测";
export const RETEST_DUE_CTA_PATH = T1_RETEST_AUTO_TRIGGER_CTA_PATH;

export type RetestPhase = "T1" | "T2" | "T3";

export type RetestPlanMilestone = {
  phase: RetestPhase;
  roundType: "T1_RETEST" | "T2_RETEST" | "T3_RETEST";
  daysAfterPublish: number;
  title: string;
  scheduleHint: string;
};

export const RETEST_PLAN_MILESTONES: readonly RetestPlanMilestone[] = [
  {
    phase: "T1",
    roundType: "T1_RETEST",
    daysAfterPublish: T1_RETEST_PLAN_DAYS,
    title: "7天后复测",
    scheduleHint: "发布后第 7 天",
  },
  {
    phase: "T2",
    roundType: "T2_RETEST",
    daysAfterPublish: T2_RETEST_PLAN_DAYS,
    title: "14天后复测",
    scheduleHint: "发布后第 30 天",
  },
  {
    phase: "T3",
    roundType: "T3_RETEST",
    daysAfterPublish: T3_RETEST_PLAN_DAYS,
    title: "30天后复测",
    scheduleHint: "发布后第 90 天",
  },
] as const;

export type RetestMilestoneStatus = "completed" | "due" | "scheduled";

export type RetestPlanMilestoneView = {
  phase: RetestPhase;
  title: string;
  scheduleHint: string;
  suggestedAt: string;
  suggestedAtLabel: string;
  status: RetestMilestoneStatus;
  statusLabel: string;
  dueInDaysLabel: string;
};

export type RetestPlanView = {
  publishAt: string | null;
  publishAtLabel: string | null;
  milestones: RetestPlanMilestoneView[];
  nextSuggestion: {
    phase: RetestPhase;
    title: string;
    suggestedAt: string;
    suggestedAtLabel: string;
  } | null;
};

export type RetestDueReminder = {
  phase: RetestPhase;
  message: string;
  ctaLabel: string;
  ctaPath: string;
};

export type RetestPlanInput = {
  completedPublishTasks: CompletedPublishTaskRow[];
  testRounds: TestRoundRow[];
  now?: Date;
};

const MS_PER_DAY = 86_400_000;

function hasCompletedRetestRound(testRounds: TestRoundRow[], roundType: string): boolean {
  if (roundType === "T1_RETEST") return hasCompletedT1Retest(testRounds);
  if (roundType === "T2_RETEST") return hasCompletedT2Retest(testRounds);
  if (roundType === "T3_RETEST") return hasCompletedT3Retest(testRounds);
  return testRounds.some(
    round => round.roundType === roundType && isCompletedTestRound(round),
  );
}

export function addDaysAfterPublish(publishAt: Date | string, days: number): Date {
  const base = new Date(publishAt);
  return new Date(base.getTime() + days * MS_PER_DAY);
}

export function formatRetestPlanDate(value: Date | string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期待定";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

function milestoneStatusLabel(status: RetestMilestoneStatus): string {
  if (status === "completed") return "已完成";
  if (status === "due") return "已到期，建议执行";
  return "计划中";
}

function dueInDaysLabel(
  status: RetestMilestoneStatus,
  daysSince: number,
  daysAfterPublish: number,
): string {
  if (status === "completed") return "已完成";
  const remaining = daysAfterPublish - daysSince;
  if (remaining > 0) return `还有 ${remaining} 天到期`;
  return "已到期，可执行复测";
}

function resolveMilestoneStatus(
  completed: boolean,
  daysSince: number,
  daysAfterPublish: number,
): RetestMilestoneStatus {
  if (completed) return "completed";
  if (daysSince > daysAfterPublish) return "due";
  return "scheduled";
}

function dueMessageForPhase(phase: RetestPhase): string {
  if (phase === "T1") return T1_RETEST_AUTO_TRIGGER_MESSAGE;
  if (phase === "T2") return T2_RETEST_DUE_MESSAGE;
  return T3_RETEST_DUE_MESSAGE;
}

export function resolveRetestDueReminder(input: RetestPlanInput): RetestDueReminder | null {
  const publishAt = findLatestCompletedPublishAt(input.completedPublishTasks);
  if (!publishAt) return null;

  const now = input.now ?? new Date();
  const elapsed = daysSincePublish(publishAt, now);

  for (const milestone of RETEST_PLAN_MILESTONES) {
    if (hasCompletedRetestRound(input.testRounds, milestone.roundType)) continue;
    if (elapsed <= milestone.daysAfterPublish) return null;
    return {
      phase: milestone.phase,
      message: dueMessageForPhase(milestone.phase),
      ctaLabel: RETEST_DUE_CTA_LABEL,
      ctaPath: RETEST_DUE_CTA_PATH,
    };
  }

  return null;
}

export function buildRetestPlan(input: RetestPlanInput): RetestPlanView {
  const now = input.now ?? new Date();
  const publishAt = findLatestCompletedPublishAt(input.completedPublishTasks);
  const publishAtIso = publishAt ? new Date(publishAt).toISOString() : null;
  const elapsed = publishAt ? daysSincePublish(publishAt, now) : 0;

  const milestones: RetestPlanMilestoneView[] = RETEST_PLAN_MILESTONES.map(milestone => {
    const completed = hasCompletedRetestRound(input.testRounds, milestone.roundType);
    const suggestedAt = publishAt
      ? addDaysAfterPublish(publishAt, milestone.daysAfterPublish).toISOString()
      : "";
    const status = publishAt
      ? resolveMilestoneStatus(completed, elapsed, milestone.daysAfterPublish)
      : "scheduled";

    return {
      phase: milestone.phase,
      title: milestone.title,
      scheduleHint: milestone.scheduleHint,
      suggestedAt,
      suggestedAtLabel: publishAt ? formatRetestPlanDate(suggestedAt, now) : "待有发布记录后计算",
      status,
      statusLabel: milestoneStatusLabel(status),
      dueInDaysLabel: publishAt
        ? dueInDaysLabel(status, elapsed, milestone.daysAfterPublish)
        : "待有发布记录后计算",
    };
  });

  const nextOpen = RETEST_PLAN_MILESTONES.find(
    milestone => !hasCompletedRetestRound(input.testRounds, milestone.roundType),
  );

  const nextSuggestion =
    publishAt && nextOpen
      ? {
          phase: nextOpen.phase,
          title: nextOpen.title,
          suggestedAt: addDaysAfterPublish(publishAt, nextOpen.daysAfterPublish).toISOString(),
          suggestedAtLabel: formatRetestPlanDate(
            addDaysAfterPublish(publishAt, nextOpen.daysAfterPublish),
            now,
          ),
        }
      : null;

  return {
    publishAt: publishAtIso,
    publishAtLabel: publishAt ? formatRetestPlanDate(publishAt, now) : null,
    milestones,
    nextSuggestion,
  };
}

/** 是否存在可作为复测计划起点的真实发布完成时间 */
export function hasRetestPlanPublishBaseline(plan: RetestPlanView): boolean {
  return Boolean(plan.publishAt);
}

/** 三轮复测节点均标记为已完成（需配合发布基线，避免无数据时误判） */
export function areAllRetestMilestonesCompleted(plan: RetestPlanView): boolean {
  return (
    plan.milestones.length > 0 && plan.milestones.every(milestone => milestone.status === "completed")
  );
}

export function shouldShowRetestPlanAllCompleteMessage(plan: RetestPlanView): boolean {
  return hasRetestPlanPublishBaseline(plan) && areAllRetestMilestonesCompleted(plan);
}

/** 与 T1 自动提醒一致：返回当前最早到期且未完成的复测阶段是否应为 T1 */
export function shouldShowT1RetestAutoTriggerReminderFromPlan(
  input: T1RetestAutoTriggerInput,
): boolean {
  return resolveRetestDueReminder(input)?.phase === "T1";
}

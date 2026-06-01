import { hasCompletedT1Retest, type TestRoundRow } from "./workspaceMainChain";

export const T1_RETEST_AFTER_PUBLISH_DAYS = 7;

export const T1_RETEST_AUTO_TRIGGER_MESSAGE = "距上次发布已超过7天，建议执行T1复测";
export const T1_RETEST_AUTO_TRIGGER_CTA_LABEL = "去执行复测";
export const T1_RETEST_AUTO_TRIGGER_CTA_PATH = "/ai-diagnosis";

const MS_PER_DAY = 86_400_000;

export type CompletedPublishTaskRow = {
  status: string;
  agentFinishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type T1RetestAutoTriggerInput = {
  completedPublishTasks: CompletedPublishTaskRow[];
  testRounds: TestRoundRow[];
  now?: Date;
};

export function resolvePublishCompletedAt(task: CompletedPublishTaskRow): Date | string | null {
  return task.agentFinishedAt ?? task.updatedAt ?? task.createdAt ?? null;
}

export function findLatestCompletedPublishAt(
  tasks: CompletedPublishTaskRow[],
): Date | string | null {
  let latestMs: number | null = null;
  let latestValue: Date | string | null = null;

  for (const task of tasks) {
    if (task.status !== "completed") continue;
    const at = resolvePublishCompletedAt(task);
    if (!at) continue;
    const ts = new Date(at).getTime();
    if (Number.isNaN(ts)) continue;
    if (latestMs == null || ts > latestMs) {
      latestMs = ts;
      latestValue = at;
    }
  }

  return latestValue;
}

export function daysSincePublish(
  publishedAt: Date | string,
  now: Date = new Date(),
): number {
  const publishedMs = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedMs)) return 0;
  return (now.getTime() - publishedMs) / MS_PER_DAY;
}

export function shouldShowT1RetestAutoTriggerReminder(
  input: T1RetestAutoTriggerInput,
): boolean {
  if (hasCompletedT1Retest(input.testRounds)) return false;

  const latestPublishAt = findLatestCompletedPublishAt(input.completedPublishTasks);
  if (!latestPublishAt) return false;

  const now = input.now ?? new Date();
  return daysSincePublish(latestPublishAt, now) > T1_RETEST_AFTER_PUBLISH_DAYS;
}

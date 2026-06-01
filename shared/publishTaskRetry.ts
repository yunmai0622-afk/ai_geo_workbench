/** 单条发布任务允许的最大重试次数（不含首次自动发布） */
export const MAX_PUBLISH_TASK_RETRIES = 3;

export type PublishTaskRetryLogEntry = {
  at: string;
  reason: string;
  previousError?: string | null;
};

export function parsePublishTaskRetryLog(raw: unknown): PublishTaskRetryLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: PublishTaskRetryLogEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const at = typeof row.at === "string" ? row.at : "";
    const reason = typeof row.reason === "string" ? row.reason : "";
    if (!at || !reason) continue;
    const previousError =
      typeof row.previousError === "string"
        ? row.previousError
        : row.previousError === null || row.previousError === undefined
          ? null
          : undefined;
    const entry: PublishTaskRetryLogEntry = { at, reason };
    if (previousError !== undefined) entry.previousError = previousError;
    entries.push(entry);
  }
  return entries;
}

export function canRetryPublishTask(task: { status: string; retryCount?: number | null }): boolean {
  return task.status === "failed" && (task.retryCount ?? 0) < MAX_PUBLISH_TASK_RETRIES;
}

export function isPublishRetryExhausted(task: { status: string; retryCount?: number | null }): boolean {
  return task.status === "failed" && (task.retryCount ?? 0) >= MAX_PUBLISH_TASK_RETRIES;
}

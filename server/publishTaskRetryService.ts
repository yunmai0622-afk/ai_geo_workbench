import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { publishTasks } from "../drizzle/schema";
import {
  canRetryPublishTask,
  isPublishRetryExhausted,
  MAX_PUBLISH_TASK_RETRIES,
  parsePublishTaskRetryLog,
  type PublishTaskRetryLogEntry,
} from "@shared/publishTaskRetry";
import { appendArticleLifecycleEvent } from "./articleLifecycleService";
import type { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

function resolveRetryReason(
  inputReason: string | undefined,
  task: typeof publishTasks.$inferSelect,
): string {
  const trimmed = inputReason?.trim();
  if (trimmed) return trimmed;
  return (
    task.agentErrorMessage?.trim() ||
    task.errorMessage?.trim() ||
    "发布失败，用户发起重试"
  );
}

export async function retryFailedPublishTask(
  db: DbConn,
  input: {
    projectId: number;
    taskId: number;
    reason?: string;
  },
) {
  const rows = await db
    .select()
    .from(publishTasks)
    .where(and(eq(publishTasks.id, input.taskId), eq(publishTasks.projectId, input.projectId)))
    .limit(1);
  const task = rows[0];
  if (!task) {
    throw new TRPCError({ code: "NOT_FOUND", message: "未找到发布任务" });
  }
  if (task.status !== "failed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `当前状态为「${task.status}」，仅失败任务可重试`,
    });
  }
  if (isPublishRetryExhausted(task)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `已重试 ${MAX_PUBLISH_TASK_RETRIES} 次，请人工处理`,
    });
  }
  if (!canRetryPublishTask(task)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前任务不可重试" });
  }

  const reason = resolveRetryReason(input.reason, task);
  const previousError = task.agentErrorMessage?.trim() || task.errorMessage?.trim() || null;
  const entry: PublishTaskRetryLogEntry = {
    at: new Date().toISOString(),
    reason,
    previousError,
  };
  const retryLog = [...parsePublishTaskRetryLog(task.retryLog), entry];
  const retryCount = (task.retryCount ?? 0) + 1;

  await db
    .update(publishTasks)
    .set({
      status: "pending_agent",
      retryCount,
      retryLog,
      agentPickedAt: null,
      agentFinishedAt: null,
      agentErrorType: null,
      agentErrorMessage: null,
      agentLog: null,
      errorMessage: null,
      draftUrl: null,
      publishedUrl: null,
      resultUrl: null,
    })
    .where(eq(publishTasks.id, input.taskId));

  await appendArticleLifecycleEvent(db, task.articleId, {
    status: "pending_publish",
    source: "publish_task_retry",
    message: `发布失败已重试（第 ${retryCount}/${MAX_PUBLISH_TASK_RETRIES} 次）：${reason}`,
    taskId: input.taskId,
    platform: task.platform,
    publishTaskStatus: "pending_agent",
  });

  return {
    ok: true as const,
    taskId: input.taskId,
    retryCount,
    retryLog,
    canRetryAgain: retryCount < MAX_PUBLISH_TASK_RETRIES,
  };
}

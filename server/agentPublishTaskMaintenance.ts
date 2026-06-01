import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { publishTasks } from "../drizzle/schema";
import {
  AGENT_PROCESSING_TIMEOUT_ERROR_TYPE,
  AGENT_PROCESSING_TIMEOUT_MS,
  agentProcessingTimeoutMessage,
} from "@shared/agentPublishTaskTimeout";
import { publishQueueDedupKey } from "@shared/publishQueueDedup";
import { appendArticleLifecycleEvent } from "./articleLifecycleService";
import type { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

const DUPLICATE_PENDING_ERROR_TYPE = "duplicate_pending";

function duplicatePendingMessage(): string {
  return "同一篇文章、同一平台、同一账号已有更早的待处理任务，本条已自动取消";
}

/** agent_processing 超时 → failed，便于 Web 重试 */
export async function expireStuckAgentProcessingTasks(db: DbConn, localAgentId: string): Promise<number> {
  const cutoff = new Date(Date.now() - AGENT_PROCESSING_TIMEOUT_MS);
  const rows = await db
    .select()
    .from(publishTasks)
    .where(
      and(
        eq(publishTasks.localAgentId, localAgentId),
        eq(publishTasks.status, "agent_processing"),
        or(
          lt(publishTasks.agentPickedAt, cutoff),
          and(sql`${publishTasks.agentPickedAt} IS NULL`, lt(publishTasks.updatedAt, cutoff)),
        ),
      ),
    );

  const now = new Date();
  const message = agentProcessingTimeoutMessage();
  for (const task of rows) {
    await db
      .update(publishTasks)
      .set({
        status: "failed",
        agentFinishedAt: now,
        agentErrorType: AGENT_PROCESSING_TIMEOUT_ERROR_TYPE,
        agentErrorMessage: message,
        errorMessage: message,
      })
      .where(eq(publishTasks.id, task.id));
    await appendArticleLifecycleEvent(db, task.articleId, {
      status: "failed",
      source: "agent_processing_timeout",
      message,
      taskId: task.id,
      platform: task.platform,
      publishTaskStatus: "failed",
    });
  }
  return rows.length;
}

/** 同 article+platform+account 仅保留最早一条 pending_agent，其余标失败 */
export async function collapseDuplicatePendingAgentTasks(db: DbConn, localAgentId: string): Promise<number> {
  const rows = await db
    .select()
    .from(publishTasks)
    .where(and(eq(publishTasks.localAgentId, localAgentId), eq(publishTasks.status, "pending_agent")))
    .orderBy(asc(publishTasks.createdAt));

  const keepIds = new Set<number>();
  const failIds: number[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const accountId = row.platformAccountId;
    if (accountId == null || accountId <= 0) continue;
    const key = publishQueueDedupKey({
      articleId: row.articleId,
      platform: row.platform,
      platformAccountId: accountId,
    });
    if (seen.has(key)) {
      failIds.push(row.id);
    } else {
      seen.add(key);
      keepIds.add(row.id);
    }
  }

  if (failIds.length === 0) return 0;

  const now = new Date();
  const message = duplicatePendingMessage();
  await db
    .update(publishTasks)
    .set({
      status: "failed",
      agentFinishedAt: now,
      agentErrorType: DUPLICATE_PENDING_ERROR_TYPE,
      agentErrorMessage: message,
      errorMessage: message,
    })
    .where(inArray(publishTasks.id, failIds));

  for (const id of failIds) {
    const task = rows.find(r => r.id === id);
    if (!task) continue;
    await appendArticleLifecycleEvent(db, task.articleId, {
      status: "failed",
      source: "duplicate_pending_collapse",
      message,
      taskId: id,
      platform: task.platform,
      publishTaskStatus: "failed",
    });
  }

  return failIds.length;
}

export async function maintainAgentPublishTasks(db: DbConn, localAgentId: string): Promise<void> {
  await expireStuckAgentProcessingTasks(db, localAgentId);
  await collapseDuplicatePendingAgentTasks(db, localAgentId);
}

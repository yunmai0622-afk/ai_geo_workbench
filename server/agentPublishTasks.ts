import { parseDataUrlCover } from "../shared/publishCoverPayload";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { publishTasks } from "../drizzle/schema";
import { appendArticleLifecycleEvent } from "./articleLifecycleService";
import { syncArticleLifecycleFromAgentTask } from "./agentArticleLifecycle";
import { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

export const AGENT_PUBLISH_STATUSES = [
  "pending_agent",
  "agent_processing",
  "draft_saved",
  "completed",
  "failed",
  "session_expired",
  "manual_required",
] as const;

export type AgentPublishStatus = (typeof AGENT_PUBLISH_STATUSES)[number];

const AGENT_POLL_PLATFORMS = new Set(["zhihu", "sohu", "baijiahao", "toutiao", "netease"]);

const TERMINAL_STATUSES = new Set<AgentPublishStatus>([
  "draft_saved",
  "completed",
  "failed",
  "session_expired",
  "manual_required",
]);

export async function pollAgentTasks(db: DbConn, localAgentId: string, limit = 3) {
  const rows = await db
    .select()
    .from(publishTasks)
    .where(and(eq(publishTasks.localAgentId, localAgentId), eq(publishTasks.status, "pending_agent")))
    .orderBy(asc(publishTasks.createdAt))
    .limit(limit);

  const tasks = rows
    .filter(r => AGENT_POLL_PLATFORMS.has(r.platform) && r.localProfileId)
    .map(r => {
      let coverBase64: string | undefined;
      let coverImageUrl = r.coverImageUrl ?? null;
      if (coverImageUrl?.startsWith("data:")) {
        const parsed = parseDataUrlCover(coverImageUrl);
        if (parsed) {
          coverBase64 = parsed.coverImageBase64;
          coverImageUrl = parsed.coverImageUrl;
        }
      }
      return {
        taskId: r.id,
        projectId: r.projectId,
        articleId: r.articleId,
        platform: r.platform,
        platformAccountId: r.platformAccountId,
        expectedAccountName: r.expectedAccountName,
        localProfileId: r.localProfileId!,
        title: r.articleTitle,
        content: r.articleContent,
        coverBase64,
        coverImageUrl,
        action: "publish" as const,
      };
    });

  return { tasks };
}

export async function claimAgentTask(db: DbConn, input: { taskId: number; localAgentId: string }) {
  const rows = await db.select().from(publishTasks).where(eq(publishTasks.id, input.taskId)).limit(1);
  const task = rows[0];
  if (!task || task.localAgentId !== input.localAgentId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "发布任务不存在或不属于当前 Agent" });
  }
  if (task.status !== "pending_agent") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `任务状态为 ${task.status}，无法领取` });
  }

  const now = new Date();
  await db
    .update(publishTasks)
    .set({ status: "agent_processing", agentPickedAt: now })
    .where(eq(publishTasks.id, input.taskId));

  await appendArticleLifecycleEvent(db, task.articleId, {
    status: "agent_processing",
    source: "agent_claim",
    message: "本地 Agent 已领取任务",
    taskId: input.taskId,
    platform: task.platform,
    publishTaskStatus: "agent_processing",
  });

  return { ok: true, taskId: input.taskId, status: "agent_processing" as const };
}

export async function reportAgentTaskResult(
  db: DbConn,
  input: {
    taskId: number;
    localAgentId: string;
    status: AgentPublishStatus;
    publicUrl?: string | null;
    draftUrl?: string | null;
    errorType?: string | null;
    errorMessage?: string | null;
    logs?: string[] | null;
  },
) {
  const rows = await db.select().from(publishTasks).where(eq(publishTasks.id, input.taskId)).limit(1);
  const task = rows[0];
  if (!task || task.localAgentId !== input.localAgentId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "发布任务不存在或不属于当前 Agent" });
  }
  if (task.status !== "agent_processing") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `任务状态为 ${task.status}，无法回传结果` });
  }

  if (input.status === "completed") {
    const url = input.publicUrl?.trim() || input.draftUrl?.trim();
    if (!url) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "completed 状态必须提供 publicUrl" });
    }
  }

  if (input.status === "draft_saved") {
    const evidence = input.draftUrl?.trim() || input.publicUrl?.trim();
    if (!evidence) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "draft_saved 必须提供 draftUrl 或保存成功证据，不能无结果标记成功",
      });
    }
  }

  const now = new Date();
  const draftUrl = input.draftUrl?.trim() || null;
  const publishedUrl = input.status === "completed" ? (input.publicUrl?.trim() || draftUrl) : null;
  const resultUrl = publishedUrl ?? draftUrl ?? null;

  await db
    .update(publishTasks)
    .set({
      status: input.status,
      agentFinishedAt: now,
      agentErrorType: input.errorType?.trim() || null,
      agentErrorMessage: input.errorMessage?.trim() || null,
      agentLog: input.logs ?? null,
      draftUrl,
      publishedUrl,
      resultUrl,
      errorMessage: input.errorMessage?.trim() || null,
    })
    .where(eq(publishTasks.id, input.taskId));

  const lifecycle = await syncArticleLifecycleFromAgentTask(db, task, {
    status: input.status,
    draftUrl,
    publishedUrl,
    errorMessage: input.errorMessage,
  });

  return {
    ok: true,
    taskId: input.taskId,
    status: input.status,
    articleLifecycle: lifecycle,
  };
}

export async function listAgentTasksForClient(
  db: DbConn,
  localAgentId: string,
  limit = 50,
) {
  const rows = await db
    .select({
      id: publishTasks.id,
      projectId: publishTasks.projectId,
      articleId: publishTasks.articleId,
      platform: publishTasks.platform,
      status: publishTasks.status,
      expectedAccountName: publishTasks.expectedAccountName,
      localProfileId: publishTasks.localProfileId,
      articleTitle: publishTasks.articleTitle,
      agentPickedAt: publishTasks.agentPickedAt,
      agentFinishedAt: publishTasks.agentFinishedAt,
      agentErrorType: publishTasks.agentErrorType,
      agentErrorMessage: publishTasks.agentErrorMessage,
      errorMessage: publishTasks.errorMessage,
      createdAt: publishTasks.createdAt,
      draftUrl: publishTasks.draftUrl,
      resultUrl: publishTasks.resultUrl,
    })
    .from(publishTasks)
    .where(eq(publishTasks.localAgentId, localAgentId))
    .orderBy(desc(publishTasks.id))
    .limit(limit);

  return {
    tasks: rows.map(r => ({
      ...r,
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
      agentPickedAt: r.agentPickedAt?.toISOString?.() ?? (r.agentPickedAt ? String(r.agentPickedAt) : null),
      agentFinishedAt: r.agentFinishedAt?.toISOString?.() ?? (r.agentFinishedAt ? String(r.agentFinishedAt) : null),
    })),
  };
}

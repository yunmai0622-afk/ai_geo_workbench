import { eq } from "drizzle-orm";
import { geoArticles } from "../drizzle/schema";
import {
  type ArticleLifecycleEvent,
  type ArticleLifecycleStatus,
  isArticleLifecycleStatus,
  parseLifecycleEvents,
} from "@shared/articleLifecycle";
import type { requireDbConn } from "./projectPlatformAccounts";
import { enqueueReviewAfterPublishSignal } from "./reviewQueueService";
import { recordRewriteTriggersFromAgent } from "./rewritePoolService";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

export type LifecycleTransitionInput = {
  status: ArticleLifecycleStatus;
  source: string;
  message?: string;
  taskId?: number;
  platform?: string;
  publishTaskStatus?: string;
};

function legacyStatusForLifecycle(status: ArticleLifecycleStatus): string | undefined {
  switch (status) {
    case "generated":
      return "已生成";
    case "quality_checked":
      return "质检通过";
    case "confirmed":
    case "pending_publish":
    case "agent_processing":
    case "manual_required":
    case "draft_saved":
      return "审核通过";
    case "published":
      return "已发布";
    case "failed":
      return "需人工审核";
    case "needs_revision":
      return "质检未通过";
    default:
      return undefined;
  }
}

export async function appendArticleLifecycleEvent(
  db: DbConn,
  articleId: number,
  input: LifecycleTransitionInput,
): Promise<{ lifecycleStatus: ArticleLifecycleStatus; events: ArticleLifecycleEvent[] }> {
  const rows = await db.select().from(geoArticles).where(eq(geoArticles.id, articleId)).limit(1);
  const article = rows[0];
  if (!article) {
    throw new Error(`文章 ${articleId} 不存在`);
  }

  const prev = parseLifecycleEvents(article.lifecycleEvents);
  const event: ArticleLifecycleEvent = {
    status: input.status,
    at: new Date().toISOString(),
    source: input.source,
    message: input.message,
    taskId: input.taskId,
    platform: input.platform,
    publishTaskStatus: input.publishTaskStatus,
  };
  const events = [...prev, event];
  const legacy = legacyStatusForLifecycle(input.status);

  await db
    .update(geoArticles)
    .set({
      lifecycleStatus: input.status,
      lifecycleEvents: events,
      ...(legacy ? { status: legacy as typeof article.status } : {}),
      ...(input.status === "published" ? {} : {}),
    })
    .where(eq(geoArticles.id, articleId));

  return { lifecycleStatus: input.status, events };
}

export async function getArticleLifecycleTimeline(db: DbConn, articleId: number) {
  const rows = await db
    .select({
      id: geoArticles.id,
      projectId: geoArticles.projectId,
      title: geoArticles.title,
      status: geoArticles.status,
      lifecycleStatus: geoArticles.lifecycleStatus,
      lifecycleEvents: geoArticles.lifecycleEvents,
      publicPath: geoArticles.publicPath,
    })
    .from(geoArticles)
    .where(eq(geoArticles.id, articleId))
    .limit(1);
  const article = rows[0];
  if (!article) return null;

  const events = parseLifecycleEvents(article.lifecycleEvents);
  const lifecycleStatus =
    article.lifecycleStatus && isArticleLifecycleStatus(article.lifecycleStatus)
      ? article.lifecycleStatus
      : null;

  return {
    articleId: article.id,
    projectId: article.projectId,
    title: article.title,
    legacyStatus: article.status,
    lifecycleStatus,
    publicPath: article.publicPath,
    events,
  };
}

/** Agent / 发布任务回传 → 文章生命周期（不 fake published） */
export async function syncLifecycleFromAgentPublishTask(
  db: DbConn,
  input: {
    articleId: number;
    taskId: number;
    platform: string;
    agentStatus: string;
    publicUrl?: string | null;
    draftUrl?: string | null;
    errorMessage?: string | null;
  },
): Promise<{ lifecycleStatus: ArticleLifecycleStatus | null; skippedPublished: boolean }> {
  let target: ArticleLifecycleStatus | null = null;
  let message = input.errorMessage ?? undefined;

  switch (input.agentStatus) {
    case "manual_required":
      target = "manual_required";
      message = message ?? "已填标题正文，需在平台窗口人工确认保存";
      break;
    case "draft_saved":
      if (!input.draftUrl?.trim()) {
        return { lifecycleStatus: null, skippedPublished: true };
      }
      target = "draft_saved";
      message = `平台草稿已保存：${input.draftUrl.trim()}`;
      break;
    case "completed": {
      const url = input.publicUrl?.trim();
      if (!url) {
        return { lifecycleStatus: null, skippedPublished: true };
      }
      target = "published";
      message = `已发布：${url}`;
      await db
        .update(geoArticles)
        .set({ publicPath: url })
        .where(eq(geoArticles.id, input.articleId));
      break;
    }
    case "failed":
    case "session_expired":
      target = "failed";
      message = message ?? (input.agentStatus === "session_expired" ? "登录态失效" : "发布失败");
      break;
    default:
      return { lifecycleStatus: null, skippedPublished: false };
  }

  if (!target) return { lifecycleStatus: null, skippedPublished: true };

  const { lifecycleStatus } = await appendArticleLifecycleEvent(db, input.articleId, {
    status: target,
    source: "agent_report",
    message,
    taskId: input.taskId,
    platform: input.platform,
    publishTaskStatus: input.agentStatus,
  });

  const articleRows = await db
    .select({ projectId: geoArticles.projectId })
    .from(geoArticles)
    .where(eq(geoArticles.id, input.articleId))
    .limit(1);
  const projectId = articleRows[0]?.projectId;
  if (projectId) {
    if (target === "manual_required" || target === "draft_saved" || target === "published") {
      await enqueueReviewAfterPublishSignal(db, {
        articleId: input.articleId,
        projectId,
        triggerStatus: target,
        publishTaskId: input.taskId,
      });
    }
    if (target === "failed" || input.agentStatus === "session_expired") {
      await recordRewriteTriggersFromAgent(db, {
        articleId: input.articleId,
        projectId,
        agentStatus: input.agentStatus,
        taskId: input.taskId,
        errorMessage: input.errorMessage,
      });
    }
  }

  return { lifecycleStatus, skippedPublished: false };
}

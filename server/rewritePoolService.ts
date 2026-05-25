import { and, desc, eq, inArray } from "drizzle-orm";
import {
  MANUAL_REQUIRED_STALE_HOURS,
  type RewritePoolSource,
  type RewritePoolStatus,
} from "@shared/reviewQueue";
import type { GeoQualityReviewResult } from "@shared/geoQualityReview";
import { geoArticles, geoReviewQueue, geoRewritePool, publishTasks } from "../drizzle/schema";
import { assessGeoArticleAntiDuplication } from "./geoArticleLogic";
import type { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

export type AddRewritePoolInput = {
  articleId: number;
  projectId: number;
  triggerStatus: string;
  source: RewritePoolSource;
  reason: string;
  publishTaskId?: number | null;
};

export async function addToRewritePool(db: DbConn, input: AddRewritePoolInput) {
  const open = await db
    .select({ id: geoRewritePool.id })
    .from(geoRewritePool)
    .where(
      and(
        eq(geoRewritePool.articleId, input.articleId),
        eq(geoRewritePool.source, input.source),
        eq(geoRewritePool.status, "open"),
      ),
    )
    .limit(1);

  if (open[0]) {
    return { id: open[0].id, created: false };
  }

  const inserted = await db.insert(geoRewritePool).values({
    articleId: input.articleId,
    projectId: input.projectId,
    triggerStatus: input.triggerStatus,
    source: input.source,
    reason: input.reason,
    publishTaskId: input.publishTaskId ?? null,
    status: "open",
  }).$returningId();

  return { id: inserted[0]?.id ?? 0, created: true };
}

export async function listRewritePoolForProject(db: DbConn, projectId: number) {
  const rows = await db
    .select({
      id: geoRewritePool.id,
      articleId: geoRewritePool.articleId,
      projectId: geoRewritePool.projectId,
      triggerStatus: geoRewritePool.triggerStatus,
      source: geoRewritePool.source,
      reason: geoRewritePool.reason,
      publishTaskId: geoRewritePool.publishTaskId,
      status: geoRewritePool.status,
      suggestionText: geoRewritePool.suggestionText,
      createdAt: geoRewritePool.createdAt,
      title: geoArticles.title,
      articleStatus: geoArticles.status,
    })
    .from(geoRewritePool)
    .innerJoin(geoArticles, eq(geoArticles.id, geoRewritePool.articleId))
    .where(and(eq(geoRewritePool.projectId, projectId), eq(geoRewritePool.status, "open")))
    .orderBy(desc(geoRewritePool.createdAt));

  const taskIds = rows.map(r => r.publishTaskId).filter((id): id is number => typeof id === "number" && id > 0);
  const tasks =
    taskIds.length > 0
      ? await db
          .select({ id: publishTasks.id, status: publishTasks.status })
          .from(publishTasks)
          .where(inArray(publishTasks.id, taskIds))
      : [];
  const taskById = new Map(tasks.map(t => [t.id, t.status]));

  return rows.map(r => ({
    articleId: r.articleId,
    title: r.title,
    articleStatus: r.articleStatus,
    reason: r.reason,
    source: r.source,
    publishTaskId: r.publishTaskId,
    publishTaskStatus: r.publishTaskId ? taskById.get(r.publishTaskId) ?? null : null,
    suggestionText: r.suggestionText,
    poolId: r.id,
  }));
}

export async function getArticleRewriteFlagsByProject(db: DbConn, projectId: number) {
  const rows = await db
    .select({ articleId: geoRewritePool.articleId })
    .from(geoRewritePool)
    .where(and(eq(geoRewritePool.projectId, projectId), eq(geoRewritePool.status, "open")));
  const needsRewrite = new Set(rows.map(r => r.articleId));
  return { needsRewrite };
}

/** manual_required 超时未处理 → 重写池（查询时评估，无定时任务） */
export async function promoteStaleManualRequiredToRewritePool(db: DbConn, projectId: number) {
  const cutoff = new Date(Date.now() - MANUAL_REQUIRED_STALE_HOURS * 3600 * 1000);
  const stale = await db
    .select({
      id: geoReviewQueue.id,
      articleId: geoReviewQueue.articleId,
      publishTaskId: geoReviewQueue.publishTaskId,
    })
    .from(geoReviewQueue)
    .where(
      and(
        eq(geoReviewQueue.projectId, projectId),
        eq(geoReviewQueue.triggerStatus, "manual_required"),
        eq(geoReviewQueue.status, "pending"),
      ),
    );

  let promoted = 0;
  for (const row of stale) {
    const full = await db.select().from(geoReviewQueue).where(eq(geoReviewQueue.id, row.id)).limit(1);
    const q = full[0];
    if (!q?.createdAt || q.createdAt > cutoff) continue;
    await addToRewritePool(db, {
      articleId: q.articleId,
      projectId,
      triggerStatus: "manual_required",
      source: "manual_required_stale",
      reason: `人工确认超过 ${MANUAL_REQUIRED_STALE_HOURS} 小时未处理`,
      publishTaskId: q.publishTaskId,
    });
    promoted += 1;
  }
  return promoted;
}

/** 基于真实质检/反同质化数据生成改版建议（不 mock） */
export async function generateNextContentSuggestion(db: DbConn, input: { projectId: number; articleId: number }) {
  const articleRows = await db
    .select()
    .from(geoArticles)
    .where(and(eq(geoArticles.id, input.articleId), eq(geoArticles.projectId, input.projectId)))
    .limit(1);
  const article = articleRows[0];
  if (!article) throw new Error("文章不存在");

  const lines: string[] = [];
  const detail = article.geoQualityDetail as GeoQualityReviewResult | null;
  if (detail?.suggestions?.length) {
    lines.push("【GEO 质检建议】", ...detail.suggestions.map(s => `· ${s}`));
  }
  if (article.geoQualityRecommendation === "reject") {
    lines.push("【结论】当前 GEO 质检为 reject，建议重写标题与正文结构，强化品牌实体与可引用片段。");
  } else if (article.geoQualityRecommendation === "revise") {
    lines.push("【结论】建议按 revise 意见局部修订后再发布。");
  }

  const poolRows = await db
    .select()
    .from(geoRewritePool)
    .where(and(eq(geoRewritePool.articleId, input.articleId), eq(geoRewritePool.status, "open")))
    .orderBy(desc(geoRewritePool.createdAt))
    .limit(1);
  if (poolRows[0]?.reason) {
    lines.push(`【进入重写池原因】${poolRows[0].reason}`);
  }

  try {
    const antiDup = assessGeoArticleAntiDuplication({
      article: {
        id: article.id,
        title: article.title,
        markdownContent: article.markdownContent,
        topicId: article.topicId,
        optimizationTaskId: article.optimizationTaskId,
        articleType: article.articleType,
      },
      peers: [],
      topic: null,
      plan: { taskIds: [], weeklyCount: 1 },
    });
    if (antiDup.rewriteSuggestion) {
      lines.push(`【差异化改写】${antiDup.rewriteSuggestion}`);
    }
  } catch {
    /* 可选增强，失败不阻断 */
  }

  if (lines.length === 0) {
    lines.push(
      "【改版方向】补充品牌名+品类+场景的首段实体信号；增加 FAQ 与案例证据块；对照目标问题重写小标题。",
    );
  }

  const suggestionText = lines.join("\n");
  if (poolRows[0]) {
    await db
      .update(geoRewritePool)
      .set({ suggestionText })
      .where(eq(geoRewritePool.id, poolRows[0].id));
  } else {
    await addToRewritePool(db, {
      articleId: input.articleId,
      projectId: input.projectId,
      triggerStatus: article.lifecycleStatus ?? "needs_revision",
      source: "quality_check_fail",
      reason: "用户请求生成新版内容建议",
    });
    const again = await db
      .select()
      .from(geoRewritePool)
      .where(and(eq(geoRewritePool.articleId, input.articleId), eq(geoRewritePool.status, "open")))
      .orderBy(desc(geoRewritePool.createdAt))
      .limit(1);
    if (again[0]) {
      await db.update(geoRewritePool).set({ suggestionText }).where(eq(geoRewritePool.id, again[0].id));
    }
  }

  return { suggestionText };
}

export async function recordRewriteTriggersFromAgent(
  db: DbConn,
  input: {
    articleId: number;
    projectId: number;
    agentStatus: string;
    taskId?: number;
    errorMessage?: string | null;
  },
) {
  if (input.agentStatus === "failed") {
    return addToRewritePool(db, {
      articleId: input.articleId,
      projectId: input.projectId,
      triggerStatus: "failed",
      source: "publish_failed",
      reason: input.errorMessage?.trim() || "本地 Agent 发布失败",
      publishTaskId: input.taskId,
    });
  }
  if (input.agentStatus === "session_expired") {
    return addToRewritePool(db, {
      articleId: input.articleId,
      projectId: input.projectId,
      triggerStatus: "session_expired",
      source: "session_expired",
      reason: input.errorMessage?.trim() || "登录态失效，请重新登录后发布",
      publishTaskId: input.taskId,
    });
  }
  return null;
}

export async function recordRewriteFromQualityReject(
  db: DbConn,
  input: { articleId: number; projectId: number; reason: string; source?: RewritePoolSource },
) {
  return addToRewritePool(db, {
    articleId: input.articleId,
    projectId: input.projectId,
    triggerStatus: "needs_revision",
    source: input.source ?? "quality_reject",
    reason: input.reason,
  });
}

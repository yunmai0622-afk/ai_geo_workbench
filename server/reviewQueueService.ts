import { and, desc, eq, inArray } from "drizzle-orm";
import {
  assertNoMockReviewResult,
  defaultScheduledAt,
  type ReviewQueueResult,
  type ReviewQueueStatus,
  type ReviewType,
  reviewTypeForTriggerStatus,
} from "@shared/reviewQueue";
import { geoArticles, geoReviewQueue } from "../drizzle/schema";
import type { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

export type EnqueueReviewInput = {
  articleId: number;
  projectId: number;
  triggerStatus: string;
  reviewType?: ReviewType;
  scheduledAt?: Date;
  publishTaskId?: number | null;
  resultNote?: string;
};

export async function enqueueReviewQueueItem(db: DbConn, input: EnqueueReviewInput) {
  const reviewType = input.reviewType ?? reviewTypeForTriggerStatus(input.triggerStatus);
  const pending = await db
    .select({ id: geoReviewQueue.id })
    .from(geoReviewQueue)
    .where(
      and(
        eq(geoReviewQueue.articleId, input.articleId),
        eq(geoReviewQueue.reviewType, reviewType),
        eq(geoReviewQueue.status, "pending"),
        eq(geoReviewQueue.triggerStatus, input.triggerStatus),
      ),
    )
    .limit(1);

  if (pending[0]) {
    return { id: pending[0].id, created: false };
  }

  const inserted = await db.insert(geoReviewQueue).values({
    articleId: input.articleId,
    projectId: input.projectId,
    triggerStatus: input.triggerStatus,
    reviewType,
    scheduledAt: input.scheduledAt ?? defaultScheduledAt(24),
    status: "pending",
    result: input.resultNote ? { note: input.resultNote, outcome: "pending_manual" } : null,
    publishTaskId: input.publishTaskId ?? null,
  }).$returningId();

  return { id: inserted[0]?.id ?? 0, created: true };
}

/** manual_required / draft_saved / published 后写入复测队列 */
export async function enqueueReviewAfterPublishSignal(
  db: DbConn,
  input: {
    articleId: number;
    projectId: number;
    triggerStatus: "manual_required" | "draft_saved" | "published";
    publishTaskId?: number | null;
  },
) {
  return enqueueReviewQueueItem(db, {
    articleId: input.articleId,
    projectId: input.projectId,
    triggerStatus: input.triggerStatus,
    publishTaskId: input.publishTaskId,
    resultNote:
      input.triggerStatus === "manual_required"
        ? "平台填稿待人工确认，确认保存后可手动触发复测"
        : input.triggerStatus === "draft_saved"
          ? "平台草稿已保存，待链接复核"
          : "已发布，待收录复测",
  });
}

export async function listReviewQueueForProject(db: DbConn, projectId: number) {
  const rows = await db
    .select({
      id: geoReviewQueue.id,
      articleId: geoReviewQueue.articleId,
      projectId: geoReviewQueue.projectId,
      triggerStatus: geoReviewQueue.triggerStatus,
      reviewType: geoReviewQueue.reviewType,
      scheduledAt: geoReviewQueue.scheduledAt,
      status: geoReviewQueue.status,
      result: geoReviewQueue.result,
      publishTaskId: geoReviewQueue.publishTaskId,
      createdAt: geoReviewQueue.createdAt,
      updatedAt: geoReviewQueue.updatedAt,
      title: geoArticles.title,
    })
    .from(geoReviewQueue)
    .innerJoin(geoArticles, eq(geoArticles.id, geoReviewQueue.articleId))
    .where(
      and(eq(geoReviewQueue.projectId, projectId), inArray(geoReviewQueue.status, ["pending", "in_progress"])),
    )
    .orderBy(desc(geoReviewQueue.createdAt));

  return rows;
}

/** 用户手动触发复测（不 mock 收录/AI 结果） */
export async function triggerManualReview(db: DbConn, input: { queueId: number; projectId: number }) {
  const rows = await db
    .select()
    .from(geoReviewQueue)
    .where(and(eq(geoReviewQueue.id, input.queueId), eq(geoReviewQueue.projectId, input.projectId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("复测任务不存在");
  if (row.status === "completed" || row.status === "cancelled") {
    throw new Error("该复测任务已结束");
  }

  const result: ReviewQueueResult = {
    note: "已手动触发复测，请完成收录/链接/AI 实测后在此回写真实结果（系统不会自动 mock 成功）",
    checkedAt: new Date().toISOString(),
    outcome: "pending_manual",
  };
  assertNoMockReviewResult(result);

  await db
    .update(geoReviewQueue)
    .set({
      status: "in_progress" as ReviewQueueStatus,
      scheduledAt: new Date(),
      result,
    })
    .where(eq(geoReviewQueue.id, input.queueId));

  return { ok: true, queueId: input.queueId, status: "in_progress" as const };
}

export async function getArticleReviewFlagsByProject(db: DbConn, projectId: number) {
  const rows = await db
    .select({ articleId: geoReviewQueue.articleId })
    .from(geoReviewQueue)
    .where(
      and(eq(geoReviewQueue.projectId, projectId), inArray(geoReviewQueue.status, ["pending", "in_progress"])),
    );
  const pendingReview = new Set(rows.map(r => r.articleId));
  return { pendingReview };
}

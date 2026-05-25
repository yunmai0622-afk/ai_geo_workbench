import { listReviewQueueForProject } from "./reviewQueueService";
import { listRewritePoolForProject, promoteStaleManualRequiredToRewritePool } from "./rewritePoolService";
import type { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

export type PostPublishRetestItem = {
  queueId: number;
  articleId: number;
  title: string;
  triggerStatus: string;
  reviewType: string;
  status: string;
  scheduledAt: Date | null;
  publishTaskId: number | null;
};

export type RewritePoolItem = {
  articleId: number;
  title: string;
  articleStatus: string;
  reason: string;
  source: string;
  publishTaskId: number | null;
  publishTaskStatus: string | null;
  suggestionText: string | null;
  poolId: number;
};

/** 待复测队列（DB：geo_review_queue） */
export async function listPostPublishRetestQueue(db: DbConn, projectId: number): Promise<PostPublishRetestItem[]> {
  await promoteStaleManualRequiredToRewritePool(db, projectId);
  const rows = await listReviewQueueForProject(db, projectId);
  return rows.map(r => ({
    queueId: r.id,
    articleId: r.articleId,
    title: r.title,
    triggerStatus: r.triggerStatus,
    reviewType: r.reviewType,
    status: r.status,
    scheduledAt: r.scheduledAt,
    publishTaskId: r.publishTaskId,
  }));
}

/** 重写池（DB：geo_rewrite_pool） */
export async function listRewritePool(db: DbConn, projectId: number): Promise<RewritePoolItem[]> {
  await promoteStaleManualRequiredToRewritePool(db, projectId);
  return listRewritePoolForProject(db, projectId);
}

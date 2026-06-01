import { and, eq } from "drizzle-orm";
import {
  contentPlanItems,
  geoArticleQualityScores,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  geoReviewQueue,
  geoRewritePool,
  publishTasks,
} from "../drizzle/schema";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function deleteGeoArticleCascade(db: Db, projectId: number, articleId: number) {
  await db.delete(geoInclusionMonitoringRecords).where(
    and(eq(geoInclusionMonitoringRecords.projectId, projectId), eq(geoInclusionMonitoringRecords.articleId, articleId)),
  );
  await db.delete(geoPublishRecords).where(
    and(eq(geoPublishRecords.projectId, projectId), eq(geoPublishRecords.articleId, articleId)),
  );
  await db.delete(geoArticleQualityScores).where(
    and(eq(geoArticleQualityScores.projectId, projectId), eq(geoArticleQualityScores.articleId, articleId)),
  );
  await db.delete(publishTasks).where(and(eq(publishTasks.projectId, projectId), eq(publishTasks.articleId, articleId)));
  await db.delete(geoReviewQueue).where(and(eq(geoReviewQueue.projectId, projectId), eq(geoReviewQueue.articleId, articleId)));
  await db.delete(geoRewritePool).where(and(eq(geoRewritePool.projectId, projectId), eq(geoRewritePool.articleId, articleId)));
  await db
    .update(contentPlanItems)
    .set({ articleId: null })
    .where(eq(contentPlanItems.articleId, articleId));
  await db.delete(geoArticles).where(and(eq(geoArticles.projectId, projectId), eq(geoArticles.id, articleId)));
}

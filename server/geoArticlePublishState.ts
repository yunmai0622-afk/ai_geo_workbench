import { eq } from "drizzle-orm";
import { geoArticles } from "../drizzle/schema";
import { syncMonthlyPlanOnArticlePublished } from "./monthlyPlanSync";
import type { requireDbConn } from "./projectPlatformAccounts";

type DbConn = Awaited<ReturnType<typeof requireDbConn>>;

/** 发布成功：标记文章已发布并写入 geo_articles.publishedAt */
export async function markGeoArticlePublishedAt(
  db: DbConn,
  articleId: number,
  input?: { publishedAt?: Date; publicPath?: string | null },
): Promise<void> {
  const publishedAt = input?.publishedAt ?? new Date();
  const publicPath = input?.publicPath?.trim();
  await db
    .update(geoArticles)
    .set({
      status: "已发布",
      publishedAt,
      ...(publicPath ? { publicPath } : {}),
    })
    .where(eq(geoArticles.id, articleId));

  const articleRows = await db
    .select({ projectId: geoArticles.projectId })
    .from(geoArticles)
    .where(eq(geoArticles.id, articleId))
    .limit(1);
  const projectId = articleRows[0]?.projectId;
  if (projectId) {
    await syncMonthlyPlanOnArticlePublished(projectId, articleId).catch(err => {
      console.error("[monthlyPlan] sync on publish failed", { projectId, articleId, err });
    });
  }
}

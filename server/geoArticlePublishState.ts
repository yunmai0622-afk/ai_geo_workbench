import { eq } from "drizzle-orm";
import { geoArticles } from "../drizzle/schema";
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
}

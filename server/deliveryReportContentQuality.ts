import { and, desc, eq, inArray, like, not } from "drizzle-orm";
import { geoArticleQualityScores, geoArticles, optimizationTasks } from "../drizzle/schema";
import { resolveArticleListPublishFields } from "@shared/articlePublishPlatform";
import {
  buildDeliveryReportContentQualitySummary,
  type ContentQualityReportArticleRow,
  type ContentQualityReportScoreRow,
} from "@shared/deliveryReportContentQuality";
import { getGeoArticleMinPassScore, parseOptimizationTaskCard } from "./geoArticleLogic";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function buildProjectDeliveryReportContentQuality(db: Db, projectId: number) {
  const rows = await db
    .select()
    .from(geoArticles)
    .where(and(eq(geoArticles.projectId, projectId), not(like(geoArticles.title, "%如何回答%"))))
    .orderBy(desc(geoArticles.createdAt));

  const uniqueRows = Array.from(new Map(rows.map(r => [r.id, r])).values());
  const articleIds = uniqueRows.map(row => row.id);

  const taskIds = Array.from(
    new Set(uniqueRows.map(row => row.optimizationTaskId).filter((id): id is number => typeof id === "number" && id > 0)),
  );
  const tasks =
    taskIds.length > 0
      ? await db
          .select()
          .from(optimizationTasks)
          .where(and(eq(optimizationTasks.projectId, projectId), inArray(optimizationTasks.id, taskIds)))
      : [];
  const taskById = new Map(tasks.map(task => [task.id, task] as const));

  const qualityRows =
    articleIds.length > 0
      ? await db
          .select({
            articleId: geoArticleQualityScores.articleId,
            totalScore: geoArticleQualityScores.totalScore,
            blocked: geoArticleQualityScores.blocked,
            blockReasons: geoArticleQualityScores.blockReasons,
            reviewSummary: geoArticleQualityScores.reviewSummary,
          })
          .from(geoArticleQualityScores)
          .where(
            and(
              eq(geoArticleQualityScores.projectId, projectId),
              inArray(geoArticleQualityScores.articleId, articleIds),
            ),
          )
          .orderBy(desc(geoArticleQualityScores.createdAt))
      : [];

  const articles: ContentQualityReportArticleRow[] = uniqueRows.map(article => {
    const task = article.optimizationTaskId ? taskById.get(article.optimizationTaskId) : undefined;
    const card = task ? parseOptimizationTaskCard(task.executionSuggestion) : null;
    const taskRecommendedPlatform = card?.recommendedPlatform?.length
      ? card.recommendedPlatform.join("、")
      : "";
    const publishFields = resolveArticleListPublishFields({
      generationBasis: article.generationBasis ?? null,
      taskRecommendedPlatform: taskRecommendedPlatform || null,
      articleType: article.articleType,
      thirdPartyMaterials: article.thirdPartyMaterials ?? null,
    });
    return {
      id: article.id,
      title: article.title,
      status: article.status,
      targetPlatformLabel: publishFields.targetPlatform ?? "待指定平台",
    };
  });

  const scores: ContentQualityReportScoreRow[] = qualityRows.map(row => ({
    articleId: row.articleId,
    totalScore: row.totalScore,
    blocked: row.blocked,
    blockReasons: Array.isArray(row.blockReasons) ? row.blockReasons : [],
    reviewSummary: row.reviewSummary,
  }));

  return buildDeliveryReportContentQualitySummary(articles, scores, {
    minPassScore: getGeoArticleMinPassScore(),
  });
}

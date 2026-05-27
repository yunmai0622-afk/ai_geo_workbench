/**
 * GEO 真实数据链审计：企业建档 + 指定文章平台字段
 * 用法：DATABASE_URL=... PROJECT_ID=30001 ARTICLE_TITLE_KEYWORD=录屏 npx tsx scripts/geo_real_data_chain_audit.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { and, eq, like } from "drizzle-orm";
import { enterpriseGeoProfiles, geoArticles, optimizationTasks, projects } from "../drizzle/schema";
import { evaluateGeoProfileP0Readiness, isP0GeoProfileCompleteFromRecord } from "../shared/geoProfileP0Readiness";
import { evaluatePublishReadiness } from "../shared/publishReadiness";
import {
  getArticlePublishPlatform,
  resolveArticleListPublishFields,
} from "../shared/articlePublishPlatform";
import { getDb } from "../server/db";
import { parseOptimizationTaskCard } from "../server/geoArticleLogic";

loadEnv({ path: resolve(process.cwd(), ".env") });

const projectId = Number(process.env.PROJECT_ID ?? "30001");
const titleKeyword = process.env.ARTICLE_TITLE_KEYWORD ?? "录屏";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error("数据库不可用");
    process.exit(1);
  }

  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const profileRows = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(eq(enterpriseGeoProfiles.projectId, projectId))
    .limit(1);

  const profileRecord = (profileRows[0] ?? null) as Record<string, unknown> | null;
  const p0 = evaluateGeoProfileP0Readiness(profileRecord);

  const articleRows = await db
    .select()
    .from(geoArticles)
    .where(and(eq(geoArticles.projectId, projectId), like(geoArticles.title, `%${titleKeyword}%`)))
    .limit(5);

  const articlesOut = [];
  for (const article of articleRows) {
    const taskRows =
      article.optimizationTaskId != null
        ? await db
            .select()
            .from(optimizationTasks)
            .where(eq(optimizationTasks.id, article.optimizationTaskId))
            .limit(1)
        : [];
    const task = taskRows[0];
    const card = task ? parseOptimizationTaskCard(task.executionSuggestion) : null;
    const taskRecommendedPlatform = card?.recommendedPlatform?.length
      ? card.recommendedPlatform.join("、")
      : "";
    const publishFields = resolveArticleListPublishFields({
      generationBasis: (article.generationBasis ?? null) as Record<string, unknown> | null,
      taskRecommendedPlatform: taskRecommendedPlatform || null,
      articleType: article.articleType,
    });
    const basis = (article.generationBasis ?? null) as Record<string, unknown> | null;
    const ps = basis?.platformContentStrategy as Record<string, unknown> | undefined;
    const platformResolved = getArticlePublishPlatform({
      generationBasis: basis,
      targetPlatform: publishFields.targetPlatform,
      publishPlatform: publishFields.publishPlatform,
      taskRecommendedPlatform,
    });
    const readiness = evaluatePublishReadiness({
      projectAccessible: true,
      enterpriseProfileReady: p0.complete,
      enterpriseProfile: profileRecord,
      diagnosisReady: true,
      article: {
        ...article,
        generationBasis: basis,
        targetPlatform: publishFields.targetPlatform,
        publishPlatform: publishFields.publishPlatform,
        lifecycleStatus: article.lifecycleStatus,
        geoQualityScore: article.geoQualityScore,
        geoQualityRecommendation: article.geoQualityRecommendation,
      },
    });
    articlesOut.push({
      id: article.id,
      projectId: article.projectId,
      title: article.title,
      status: article.status,
      lifecycleStatus: article.lifecycleStatus,
      articleType: article.articleType,
      targetPlatform: publishFields.targetPlatform,
      publishPlatform: publishFields.publishPlatform,
      generationBasisPlatformContentStrategy: ps ?? null,
      targetPublishPlatform: ps?.targetPublishPlatform ?? null,
      targetPublishPlatformLabel: ps?.targetPublishPlatformLabel ?? null,
      taskRecommendedPlatform,
      optimizationTaskId: article.optimizationTaskId,
      platformResolved: {
        slug: platformResolved.slug,
        label: platformResolved.label,
        recognized: platformResolved.recognized,
        weeklyPlatformKey: platformResolved.weeklyPlatformKey,
      },
      isLegacyArticle: !ps?.targetPublishPlatform,
      publishReadiness: {
        ready: readiness.ready,
        blockingCode: readiness.blockingCode,
        message: readiness.message,
      },
    });
  }

  const out = {
    phase: "GEO-Real-Data-Chain-Final-Debug-P0",
    at: new Date().toISOString(),
    projectId,
    projectExists: projectRows.length > 0,
    enterpriseName: projectRows[0]?.enterpriseName ?? null,
    profile: {
      exists: Boolean(profileRecord),
      p0Complete: p0.complete,
      missingLabels: p0.missingLabels,
      isP0GeoProfileCompleteFromRecord: isP0GeoProfileCompleteFromRecord(profileRecord),
    },
    articlesMatched: articlesOut,
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

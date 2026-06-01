import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import {
  analysisResults,
  aiResponses,
  contentPlans,
  geoArticleQualityScores,
  geoArticleTopics,
  geoArticles,
  optimizationTasks,
  questions,
  competitorProfiles,
  contentStyleProfiles,
  customerCases,
  enterpriseGeoProfiles,
  geoAssetSources,
  projects,
} from "../drizzle/schema";
import {
  attachQuestionTextToAnalyses,
  resolveEffectiveAnalysisResults,
} from "./geoLogic";
import {
  assessGeoArticleAntiDuplication,
  isGeoArticleQualityCheckPass,
  rewriteGeoArticleMarkdownForQuality,
  scoreGeoArticleQuality,
  withResolvedEnterpriseProfile,
  type ArticleStatus,
  type GeoArticleAntiDupArticle,
  type P11QualityScore,
  type P12AssetLibraryContext,
} from "./geoArticleLogic";
import { getDb } from "./db";
import { appendArticleLifecycleEvent } from "./articleLifecycleService";
import { recordRewriteFromQualityReject } from "./rewritePoolService";

const MAX_AUTO_QUALITY_REWRITES = 2;

export type GeoArticleQualityCheckFlowResult = {
  success: boolean;
  quality: P11QualityScore;
  autoRewriteCount: number;
  finalStatus: "质检通过" | "需人工审核";
};

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function getProjectOrThrow(db: Db, projectId: number) {
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
  return result[0];
}

async function getAssetLibraryContext(db: Db, projectId: number): Promise<P12AssetLibraryContext> {
  const [profiles, assetSources, cases, competitors, styles] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).orderBy(desc(enterpriseGeoProfiles.updatedAt)).limit(1),
    db.select().from(geoAssetSources).where(eq(geoAssetSources.projectId, projectId)).orderBy(desc(geoAssetSources.updatedAt)),
    db.select().from(customerCases).where(eq(customerCases.projectId, projectId)).orderBy(desc(customerCases.updatedAt)),
    db.select().from(competitorProfiles).where(eq(competitorProfiles.projectId, projectId)).orderBy(desc(competitorProfiles.updatedAt)),
    db.select().from(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, projectId)).orderBy(desc(contentStyleProfiles.updatedAt)),
  ]);
  return withResolvedEnterpriseProfile({
    profile: profiles[0] ?? null,
    assetSources,
    customerCases: cases,
    competitorProfiles: competitors,
    complianceRules: [],
    contentStyleProfiles: styles,
    publishStrategies: [],
  });
}

/** 对单篇文章执行 GEO 质检；未通过时自动换角重写最多 2 次，通过后设为「质检通过」，否则「需人工审核」。 */
export async function runGeoArticleQualityCheckFlow(db: Db, articleId: number): Promise<GeoArticleQualityCheckFlowResult> {
  const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, articleId)).limit(1);
  const article = articleRows[0];
  if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });

  const project = await getProjectOrThrow(db, article.projectId);
  const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, article.projectId));
  const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, article.projectId));
  const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, article.projectId));
  const taskRows = article.optimizationTaskId
    ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, article.optimizationTaskId)).limit(1)
    : [];
  const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
  const assetLibrary = await getAssetLibraryContext(db, article.projectId);

  const peerRows = await db
    .select({
      id: geoArticles.id,
      title: geoArticles.title,
      markdownContent: geoArticles.markdownContent,
      topicId: geoArticles.topicId,
      optimizationTaskId: geoArticles.optimizationTaskId,
      articleType: geoArticles.articleType,
    })
    .from(geoArticles)
    .where(eq(geoArticles.projectId, article.projectId));
  const topicMetaRows = await db
    .select({ id: geoArticleTopics.id, optimizationTaskId: geoArticleTopics.optimizationTaskId })
    .from(geoArticleTopics)
    .where(eq(geoArticleTopics.id, article.topicId))
    .limit(1);
  const latestPlanRows = await db
    .select({ linkedOptimizationTaskIds: contentPlans.linkedOptimizationTaskIds, weeklyArticleCount: contentPlans.weeklyArticleCount })
    .from(contentPlans)
    .where(eq(contentPlans.projectId, article.projectId))
    .orderBy(desc(contentPlans.updatedAt))
    .limit(1);
  const planForAntiDup = {
    taskIds: latestPlanRows[0]?.linkedOptimizationTaskIds ?? [],
    weeklyCount: latestPlanRows[0]?.weeklyArticleCount ?? 3,
  };
  const peers = peerRows.filter(row => row.id !== article.id) as GeoArticleAntiDupArticle[];

  let markdownContent = article.markdownContent;
  const articleLike = article as unknown as Parameters<typeof scoreGeoArticleQuality>[0]["article"];
  const scoreOne = () =>
    scoreGeoArticleQuality({
      article: { ...articleLike, markdownContent },
      project,
      questions: projectQuestions,
      analyses: analysesWithQuestions,
      task: taskRows[0] ?? null,
      assetLibrary,
    });

  let quality = scoreOne();
  let antiDupArticle: GeoArticleAntiDupArticle = {
    id: article.id,
    title: article.title,
    markdownContent,
    topicId: article.topicId,
    optimizationTaskId: article.optimizationTaskId,
    articleType: article.articleType,
  };
  let antiDup = assessGeoArticleAntiDuplication({
    article: antiDupArticle,
    peers,
    topic: topicMetaRows[0] ?? null,
    plan: planForAntiDup,
  });

  const existingVersions = Array.isArray(article.optimizationVersions) ? article.optimizationVersions : [];
  const optimizationVersions: Array<Record<string, unknown>> = [...existingVersions];

  const persistScore = async () => {
    await db.insert(geoArticleQualityScores).values({
      projectId: article.projectId,
      articleId: article.id,
      problemMatchScore: quality.problemMatchScore,
      evidenceScore: quality.evidenceScore,
      structureScore: quality.structureScore,
      originalityScore: quality.originalityScore,
      geoCitableScore: quality.geoCitableScore,
      complianceScore: quality.complianceScore,
      totalScore: quality.totalScore,
      blocked: quality.blocked ? 1 : 0,
      blockReasons: quality.blockReasons,
      reviewSummary: quality.reviewSummary,
    });
  };

  const syncArticleFields = async (status?: ArticleStatus) => {
    await db
      .update(geoArticles)
      .set({
        ...(status ? { status } : {}),
        markdownContent,
        optimizationVersions,
        factTraceability: quality.factTraceability,
        consistencyCheck: quality.consistencyCheck,
      })
      .where(eq(geoArticles.id, article.id));
  };

  await persistScore();
  await db
    .update(geoArticles)
    .set({
      factTraceability: quality.factTraceability,
      consistencyCheck: quality.consistencyCheck,
    })
    .where(eq(geoArticles.id, article.id));

  if (isGeoArticleQualityCheckPass(quality)) {
    await syncArticleFields("质检通过");
    await appendArticleLifecycleEvent(db, articleId, {
      status: "quality_checked",
      source: "quality_check",
      message: "GEO 质检通过",
    });
    return { success: true, quality, autoRewriteCount: 0, finalStatus: "质检通过" };
  }

  let used = 0;
  while (!isGeoArticleQualityCheckPass(quality) && used < MAX_AUTO_QUALITY_REWRITES) {
    const markdownBeforeRewrite = markdownContent;
    try {
      markdownContent = await rewriteGeoArticleMarkdownForQuality({
        projectName: project.enterpriseName,
        articleTitle: article.title,
        markdownContent,
        quality,
        antiDup,
      });
    } catch (error) {
      console.error("[GEO质检] 自动换角重写失败，将标记为需人工审核", error);
      break;
    }
    optimizationVersions.push({
      version: optimizationVersions.length + 1,
      createdAt: new Date().toISOString(),
      mode: "GEO 质检自动重写",
      previousStatus: article.status,
      previousScore: quality.totalScore,
      title: article.title,
      markdownContent: markdownBeforeRewrite,
      consistencyScore: quality.consistencyCheck?.score,
      reason: `质检未通过后系统自动换角重写，依据：${(quality.blockReasons.length ? quality.blockReasons : quality.optimizationSuggestions).slice(0, 5).join("；")}`,
    });
    used += 1;
    quality = scoreOne();
    antiDupArticle = { ...antiDupArticle, markdownContent };
    antiDup = assessGeoArticleAntiDuplication({
      article: antiDupArticle,
      peers,
      topic: topicMetaRows[0] ?? null,
      plan: planForAntiDup,
    });
    await persistScore();
    await db
      .update(geoArticles)
      .set({
        markdownContent,
        optimizationVersions,
        factTraceability: quality.factTraceability,
        consistencyCheck: quality.consistencyCheck,
      })
      .where(eq(geoArticles.id, article.id));
  }

  if (isGeoArticleQualityCheckPass(quality)) {
    await syncArticleFields("质检通过");
    await appendArticleLifecycleEvent(db, articleId, {
      status: "quality_checked",
      source: "quality_check",
      message: "GEO 质检通过（自动重写后）",
    });
    return { success: true, quality, autoRewriteCount: used, finalStatus: "质检通过" };
  }

  await syncArticleFields("需人工审核");
  await appendArticleLifecycleEvent(db, articleId, {
    status: "needs_revision",
    source: "quality_check",
    message: "GEO 质检未通过，需修订",
  });
  await recordRewriteFromQualityReject(db, {
    articleId,
    projectId: article.projectId,
    reason: "GEO 自动质检未通过，需修订后重新质检",
    source: "quality_check_fail",
  });
  return { success: false, quality, autoRewriteCount: used, finalStatus: "需人工审核" };
}

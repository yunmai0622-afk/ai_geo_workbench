import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import type { GeoContentTaskGenerationTrace } from "@shared/platformContentRules";
import { formatPlatformRuleSummaryForGeneration } from "@shared/geoContentTaskSource";
import type { GeoQuestionTemplateReference } from "@shared/questionContentTemplates";
import { getArticlePublishPlatform } from "@shared/articlePublishPlatform";
import {
  applyPlatformDraftTimeoutIfNeeded,
  buildPlatformDraftStatusView,
  isPlatformDraftInFlight,
  mergePlatformDraftGeneration,
  PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE,
  PLATFORM_DRAFT_SERIAL_BUSY_MESSAGE,
  PLATFORM_DRAFT_START_MESSAGE,
  readPlatformDraftGeneration,
  type PlatformDraftGenerationRecord,
} from "@shared/platformDraftGeneration";
import {
  PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
  PLATFORM_CONTENT_QC_MANUAL_REVIEW_MESSAGE,
  PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE,
  toPlatformContentGenerationError,
} from "@shared/platformContentGenerationErrors";
import { classifyPlatformContentLlmError } from "@shared/platformContentLlmErrors";
import { diagnoseLlmProviderEnv, formatMissingLlmEnvServerLog } from "@shared/llmEnvDiagnostics";
import {
  geoArticleTopics,
  geoArticles,
  analysisResults,
  aiResponses,
  competitorProfiles,
  contentStyleProfiles,
  customerCases,
  enterpriseGeoProfiles,
  geoAssetSources,
  optimizationTasks,
  projects,
  publishTasks,
  questions,
} from "../drizzle/schema";
import {
  assertEnterpriseProfileForPlatformGeneration,
  assertPlatformContentStrategyParams,
} from "./platformContentGenerationPreconditions";
import { attachQuestionTextToAnalyses, resolveEffectiveAnalysisResults } from "./geoLogic";
import {
  articleTypes,
  generateGeoArticleDraft,
  mergeProjectWithEnterpriseProfile,
  withResolvedEnterpriseProfile,
  type P12AssetLibraryContext,
} from "./geoArticleLogic";
import { runGeoArticleQualityCheckFlow } from "./geoArticleQualityCheckFlow";
import { appendArticleLifecycleEvent } from "./articleLifecycleService";
import { resolveArticleTargetGapLink } from "./articleGapLink";
import {
  getQuestionTemplateById,
  resolveFilledQuestionTemplatePrompt,
} from "./questionTemplateService";
import {
  buildGeoTaskDurationLogBase,
  logGeoArticlesGenerateDuration,
  type GeoArticlesGenerateStepTimings,
} from "./geoTaskDurationLog";
import {
  GEO_ENHANCEMENT_GOAL_OPTIONS,
  PUBLISH_PLATFORM_IDS,
  normalizeTargetAiPlatforms,
  type PlatformContentStrategyInput,
} from "@shared/platformContentRules";
import { ACCOUNT_GROUP_TYPES, CONTENT_ASSET_TYPES, PUBLISH_IDENTITIES } from "@shared/contentStrategy";
import { getDb } from "./db";

type DbConn = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const runningDraftJobs = new Set<number>();

const PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN = "（内容生成中，请稍候刷新查看）";

async function loadAssetLibraryContext(db: DbConn, projectId: number): Promise<P12AssetLibraryContext> {
  const [profiles, assetSources, cases, competitors, styles] = await Promise.all([
    db
      .select()
      .from(enterpriseGeoProfiles)
      .where(eq(enterpriseGeoProfiles.projectId, projectId))
      .orderBy(desc(enterpriseGeoProfiles.updatedAt))
      .limit(1),
    db
      .select()
      .from(geoAssetSources)
      .where(eq(geoAssetSources.projectId, projectId))
      .orderBy(desc(geoAssetSources.updatedAt)),
    db
      .select()
      .from(customerCases)
      .where(eq(customerCases.projectId, projectId))
      .orderBy(desc(customerCases.updatedAt)),
    db
      .select()
      .from(competitorProfiles)
      .where(eq(competitorProfiles.projectId, projectId))
      .orderBy(desc(competitorProfiles.updatedAt)),
    db
      .select()
      .from(contentStyleProfiles)
      .where(eq(contentStyleProfiles.projectId, projectId))
      .orderBy(desc(contentStyleProfiles.updatedAt)),
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

export type StartPlatformDraftGenerationInput = {
  topicId: number;
  targetPublishPlatform?: (typeof PUBLISH_PLATFORM_IDS)[number];
  contentStrategyType?: (typeof CONTENT_ASSET_TYPES)[number];
  publishIdentity?: (typeof PUBLISH_IDENTITIES)[number];
  recommendedAccountGroup?: (typeof ACCOUNT_GROUP_TYPES)[number];
  targetQuestion?: string;
  geoEnhancementGoal?: (typeof GEO_ENHANCEMENT_GOAL_OPTIONS)[number];
  targetAiPlatforms?: string[];
  contentTaskId?: number;
  diagnosisFinding?: string;
  geoGap?: string;
  platformRule?: string;
  questionTemplateId?: number;
  questionId?: number;
  sourceType?: string;
};

export type StartPlatformDraftGenerationResult = {
  articleId: number;
  topicId: number;
  status: "queued" | "generating";
  message: string;
};

function buildPlatformStrategy(input: StartPlatformDraftGenerationInput): PlatformContentStrategyInput | undefined {
  if (
    !input.targetPublishPlatform ||
    !input.contentStrategyType ||
    !input.publishIdentity ||
    !input.targetQuestion?.trim() ||
    !input.geoEnhancementGoal ||
    !input.targetAiPlatforms?.length
  ) {
    return undefined;
  }
  return {
    targetPublishPlatform: input.targetPublishPlatform,
    contentStrategyType: input.contentStrategyType,
    publishIdentity: input.publishIdentity,
    recommendedAccountGroup: input.recommendedAccountGroup ?? "official_group",
    targetQuestion: input.targetQuestion.trim(),
    geoEnhancementGoal: input.geoEnhancementGoal,
    targetAiPlatforms: normalizeTargetAiPlatforms(input.targetAiPlatforms),
  };
}

async function articleHasBlockingPublishTask(db: DbConn, articleId: number): Promise<boolean> {
  const tasks = await db
    .select({ status: publishTasks.status })
    .from(publishTasks)
    .where(eq(publishTasks.articleId, articleId))
    .orderBy(desc(publishTasks.createdAt))
    .limit(5);
  return tasks.some(
    task => task.status !== "failed" && task.status !== "session_expired" && task.status !== "cancelled",
  );
}

function isArticleProtected(article: typeof geoArticles.$inferSelect): boolean {
  return article.status === "已发布";
}

async function findProjectInFlightDraft(
  db: DbConn,
  projectId: number,
  excludeArticleId?: number,
): Promise<number | null> {
  const rows = await db
    .select({ id: geoArticles.id, generationBasis: geoArticles.generationBasis })
    .from(geoArticles)
    .where(eq(geoArticles.projectId, projectId))
    .orderBy(desc(geoArticles.updatedAt))
    .limit(200);
  for (const row of rows) {
    if (excludeArticleId != null && row.id === excludeArticleId) continue;
    const record = readPlatformDraftGeneration(row.generationBasis ?? null);
    if (isPlatformDraftInFlight(record?.status)) return row.id;
  }
  return null;
}

async function persistDraftRecord(
  db: DbConn,
  articleId: number,
  patch: Partial<PlatformDraftGenerationRecord>,
  extra?: { generationBasis?: Record<string, unknown>; markdownContent?: string; status?: string },
) {
  const rows = await db.select().from(geoArticles).where(eq(geoArticles.id, articleId)).limit(1);
  const article = rows[0];
  if (!article) return;
  const generationBasis = mergePlatformDraftGeneration(article.generationBasis ?? null, patch);
  await db
    .update(geoArticles)
    .set({
      generationBasis: extra?.generationBasis ?? generationBasis,
      ...(extra?.markdownContent != null ? { markdownContent: extra.markdownContent } : {}),
      ...(extra?.status != null ? { status: extra.status as typeof article.status } : {}),
    })
    .where(eq(geoArticles.id, articleId));
}

async function ensureDraftArticleRow(
  db: DbConn,
  input: {
    projectId: number;
    topic: typeof geoArticleTopics.$inferSelect;
    task: typeof optimizationTasks.$inferSelect;
    platformStrategy: PlatformContentStrategyInput;
    contextBasis: Record<string, unknown>;
    existingArticle?: typeof geoArticles.$inferSelect | null;
  },
): Promise<number> {
  const { topic, task, platformStrategy, contextBasis, existingArticle } = input;
  if (existingArticle) {
    if (isArticleProtected(existingArticle)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "已发布内容不可重新生成" });
    }
    if (await articleHasBlockingPublishTask(db, existingArticle.id)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "内容已加入发布队列，暂不可重新生成" });
    }
    const generationBasis = mergePlatformDraftGeneration(existingArticle.generationBasis ?? null, {
      status: "queued",
      platform: platformStrategy.targetPublishPlatform,
      startedAt: new Date().toISOString(),
      errorMessage: null,
      errorCode: null,
      canRetry: false,
    });
    await db
      .update(geoArticles)
      .set({
        generationBasis: { ...generationBasis, ...contextBasis },
        markdownContent: PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
        status: "待生成",
      })
      .where(eq(geoArticles.id, existingArticle.id));
    return existingArticle.id;
  }

  const generationBasis = mergePlatformDraftGeneration(contextBasis, {
    status: "queued",
    platform: platformStrategy.targetPublishPlatform,
    startedAt: new Date().toISOString(),
    errorMessage: null,
    errorCode: null,
    canRetry: false,
  });
  const inserted = await db
    .insert(geoArticles)
    .values({
      projectId: input.projectId,
      topicId: topic.id,
      optimizationTaskId: task.id,
      title: topic.title,
      articleType: topic.articleType,
      markdownContent: PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
      generationBasis,
      thirdPartyMaterials: {},
      status: "待生成",
      lifecycleStatus: "generated",
    })
    .$returningId();
  const articleId = inserted[0]?.id ?? 0;
  if (!articleId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "内容草稿创建失败" });
  return articleId;
}

export async function executePlatformDraftGenerationJob(input: {
  db: DbConn;
  articleId: number;
  topicId: number;
  projectId: number;
  startInput: StartPlatformDraftGenerationInput;
}) {
  const { db, articleId, topicId, projectId, startInput } = input;
  if (runningDraftJobs.has(articleId)) return;
  runningDraftJobs.add(articleId);
  const startedAtMs = Date.now();
  let stepStartMs = startedAtMs;
  const stepTimings: GeoArticlesGenerateStepTimings = {};
  const logDuration = (success: boolean, errorCode: string | null) => {
    logGeoArticlesGenerateDuration({
      ...buildGeoTaskDurationLogBase(startedAtMs),
      projectId,
      platform: startInput.targetPublishPlatform ?? null,
      success,
      errorCode,
      stepTimings,
    });
  };

  try {
    await persistDraftRecord(db, articleId, { status: "generating" });

    const topicRows = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.id, topicId)).limit(1);
    const topic = topicRows[0];
    if (!topic) throw new Error("文章选题不存在");
    const taskRows = topic.optimizationTaskId
      ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, topic.optimizationTaskId)).limit(1)
      : [];
    const task = taskRows[0];
    if (!task || task.projectId !== projectId) throw new Error(PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE);

    const platformStrategy = buildPlatformStrategy(startInput);
    assertPlatformContentStrategyParams(platformStrategy);
    if (!platformStrategy) throw new Error("请选择目标平台和内容类型后再生成。");

    const [projectRows, assetLibrary, projectQuestions, analyses, responses] = await Promise.all([
      db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
      loadAssetLibraryContext(db, projectId),
      db.select().from(questions).where(eq(questions.projectId, projectId)),
      db.select().from(analysisResults).where(eq(analysisResults.projectId, projectId)),
      db.select().from(aiResponses).where(eq(aiResponses.projectId, projectId)),
    ]);
    const projectRow = projectRows[0];
    if (!projectRow) throw new Error("项目不存在");
    const project = mergeProjectWithEnterpriseProfile(projectRow, assetLibrary.profile ?? null);
    assertEnterpriseProfileForPlatformGeneration(projectRow, assetLibrary, platformStrategy);
    stepTimings.dbPrefetchMs = Date.now() - stepStartMs;
    stepStartMs = Date.now();

    if (process.env.GEO_ARTICLE_BODY !== "test-template") {
      const llmEnv = diagnoseLlmProviderEnv();
      if (!llmEnv.configured) {
        console.error("[platformDraftGeneration]", formatMissingLlmEnvServerLog(llmEnv.missingEnvVars), {
          articleId,
          projectId,
        });
        throw new Error(PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE);
      }
    }

    const sourceQuestionIds = Array.isArray(topic.sourceQuestionIds) ? topic.sourceQuestionIds : [];
    const sourceAnalysisIds = Array.isArray(topic.sourceAnalysisIds) ? topic.sourceAnalysisIds : [];
    const questionScope = projectQuestions.filter(question => sourceQuestionIds.includes(question.id));
    const analysesWithQuestions = attachQuestionTextToAnalyses(
      resolveEffectiveAnalysisResults(analyses),
      responses,
      projectQuestions,
    );
    const analysisScope = analysesWithQuestions.filter(analysis => sourceAnalysisIds.includes(analysis.id));

    let geoContentTaskTrace: GeoContentTaskGenerationTrace | undefined;
    if (
      startInput.contentTaskId != null ||
      startInput.diagnosisFinding?.trim() ||
      startInput.geoGap?.trim() ||
      startInput.platformRule?.trim()
    ) {
      geoContentTaskTrace = {
        contentTaskId: startInput.contentTaskId ?? task.id,
        diagnosisFinding: startInput.diagnosisFinding?.trim(),
        geoGap: startInput.geoGap?.trim(),
        platformRuleSummary:
          startInput.platformRule?.trim() ||
          formatPlatformRuleSummaryForGeneration(platformStrategy.targetPublishPlatform),
      };
    }

    let questionTemplateReference: GeoQuestionTemplateReference | undefined;
    if (startInput.questionTemplateId) {
      const template = await getQuestionTemplateById(db, startInput.questionTemplateId);
      if (!template) throw new Error("所选内容模板不存在");
      questionTemplateReference = {
        id: template.id,
        title: template.title,
        filledPrompt: resolveFilledQuestionTemplatePrompt(template, project, assetLibrary.profile ?? null),
      };
    }

    const draft = await generateGeoArticleDraft({
      project,
      topic: {
        ...topic,
        id: topic.id,
        articleType: topic.articleType as (typeof articleTypes)[number],
        optimizationTaskId: task.id,
      },
      task,
      questions: questionScope.length > 0 ? questionScope : projectQuestions,
      analyses: analysisScope.length > 0 ? analysisScope : analysesWithQuestions,
      assetLibrary,
      platformStrategy,
      geoContentTaskTrace,
      questionTemplateReference,
    });
    stepTimings.draftGenerationMs = Date.now() - stepStartMs;
    stepStartMs = Date.now();

    const linkedQuestionText =
      startInput.targetQuestion?.trim() ||
      (typeof draft.generationBasis?.customerQuestion === "string" ? draft.generationBasis.customerQuestion : "");
    const gapLink = await resolveArticleTargetGapLink(db, {
      projectId,
      questionText: linkedQuestionText,
      sourceQuestionIds,
      analyses: analysisScope,
      projectQuestions,
    });
    const generationBasisWithContext = mergePlatformDraftGeneration(
      {
        ...(draft.generationBasis ?? {}),
        ...(startInput.contentTaskId != null ? { contentTaskId: startInput.contentTaskId } : {}),
        ...(startInput.questionId != null ? { sourceQuestionId: startInput.questionId } : {}),
        ...(startInput.sourceType?.trim() ? { sourceType: startInput.sourceType.trim() } : {}),
        ...(startInput.targetQuestion?.trim() ? { entryQuestionText: startInput.targetQuestion.trim() } : {}),
      },
      {
        status: "generated",
        platform: platformStrategy.targetPublishPlatform,
        errorMessage: null,
        errorCode: null,
        canRetry: false,
      },
    );

    await db
      .update(geoArticles)
      .set({
        title: draft.title,
        markdownContent: draft.markdownContent,
        generationBasis: generationBasisWithContext,
        citableSnippets: draft.citableSnippets,
        geoStructure: draft.geoStructure,
        thirdPartyMaterials: draft.thirdPartyMaterials,
        factTraceability: draft.factTraceability,
        consistencyCheck: draft.consistencyCheck,
        optimizationVersions: draft.optimizationVersions,
        targetQuestionId: gapLink?.roundQuestionId?.trim() ? gapLink.roundQuestionId : null,
        targetGapType: gapLink?.gapType ?? null,
        status: "待质检",
      })
      .where(eq(geoArticles.id, articleId));

    await appendArticleLifecycleEvent(db, articleId, {
      status: "generated",
      source: "article_generate",
      message: "内容资产生成完成",
    });
    await db.update(geoArticleTopics).set({ status: "已生成" }).where(eq(geoArticleTopics.id, topic.id));
    stepTimings.dbPersistMs = Date.now() - stepStartMs;
    stepStartMs = Date.now();
    await runGeoArticleQualityCheckFlow(db, articleId);
    stepTimings.qualityCheckMs = Date.now() - stepStartMs;
    logDuration(true, null);
  } catch (error) {
    const raw = error instanceof Error ? error.message : PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE;
    const llmClassified = classifyPlatformContentLlmError(raw, diagnoseLlmProviderEnv());
    const customerMessage = toPlatformContentGenerationError(raw);
    await persistDraftRecord(db, articleId, {
      status: "failed",
      errorCode: llmClassified.code !== "not_llm_error" ? llmClassified.code : "generation_failed",
      errorMessage: customerMessage,
      canRetry: true,
    });
    logDuration(false, llmClassified.code !== "not_llm_error" ? llmClassified.code : "GENERATION_FAILED");
    console.error("[platformDraftGeneration] job failed", {
      articleId,
      projectId,
      errorCode: llmClassified.code,
      message: raw.slice(0, 500),
    });
  } finally {
    runningDraftJobs.delete(articleId);
  }
}

export async function startPlatformDraftGeneration(
  db: DbConn,
  input: StartPlatformDraftGenerationInput,
): Promise<StartPlatformDraftGenerationResult> {
  const topicRows = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.id, input.topicId)).limit(1);
  const topic = topicRows[0];
  if (!topic) throw new TRPCError({ code: "NOT_FOUND", message: "文章选题不存在" });
  const projectId = topic.projectId;

  const platformStrategy = buildPlatformStrategy(input);
  assertPlatformContentStrategyParams(platformStrategy);
  if (!platformStrategy) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请选择目标平台和内容类型后再生成。" });
  }

  const taskRows = topic.optimizationTaskId
    ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, topic.optimizationTaskId)).limit(1)
    : [];
  const task = taskRows[0];
  if (!task || task.projectId !== projectId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE });
  }

  const existingArticles = await db
    .select()
    .from(geoArticles)
    .where(and(eq(geoArticles.projectId, projectId), eq(geoArticles.topicId, topic.id)))
    .orderBy(desc(geoArticles.updatedAt));
  const platformArticles = existingArticles.filter(article => {
    const resolved = getArticlePublishPlatform({
      generationBasis: article.generationBasis ?? null,
      targetPlatform: null,
      publishPlatform: null,
    });
    return resolved.slug === platformStrategy.targetPublishPlatform;
  });
  const existingArticle = platformArticles[0] ?? null;

  const inFlightOther = await findProjectInFlightDraft(db, projectId, existingArticle?.id);
  if (inFlightOther != null) {
    throw new TRPCError({ code: "CONFLICT", message: PLATFORM_DRAFT_SERIAL_BUSY_MESSAGE });
  }

  const [projectRows, assetLibrary] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    loadAssetLibraryContext(db, projectId),
  ]);
  const projectRow = projectRows[0];
  if (!projectRow) {
    throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
  }
  assertEnterpriseProfileForPlatformGeneration(projectRow, assetLibrary, platformStrategy);
  if (process.env.GEO_ARTICLE_BODY !== "test-template") {
    const llmEnv = diagnoseLlmProviderEnv();
    if (!llmEnv.configured) {
      console.error("[platformDraftGeneration]", formatMissingLlmEnvServerLog(llmEnv.missingEnvVars), {
        topicId: input.topicId,
        projectId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
      });
    }
  }

  const contextBasis: Record<string, unknown> = {
    ...(existingArticle?.generationBasis ?? {}),
    ...(input.contentTaskId != null ? { contentTaskId: input.contentTaskId } : {}),
    ...(input.questionId != null ? { sourceQuestionId: input.questionId } : {}),
    ...(input.sourceType?.trim() ? { sourceType: input.sourceType.trim() } : {}),
    ...(input.targetQuestion?.trim() ? { entryQuestionText: input.targetQuestion.trim() } : {}),
  };

  const articleId = await ensureDraftArticleRow(db, {
    projectId,
    topic,
    task,
    platformStrategy,
    contextBasis,
    existingArticle,
  });

  void executePlatformDraftGenerationJob({
    db,
    articleId,
    topicId: topic.id,
    projectId,
    startInput: input,
  }).catch(err => {
    console.error("[platformDraftGeneration] unhandled job error", {
      articleId,
      projectId,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return {
    articleId,
    topicId: topic.id,
    status: "generating",
    message: PLATFORM_DRAFT_START_MESSAGE,
  };
}

export async function getPlatformDraftGenerationStatus(
  db: DbConn,
  input: { projectId: number; articleId: number },
) {
  const rows = await db
    .select()
    .from(geoArticles)
    .where(and(eq(geoArticles.id, input.articleId), eq(geoArticles.projectId, input.projectId)))
    .limit(1);
  const article = rows[0];
  if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "未找到内容草稿" });

  let record = readPlatformDraftGeneration(article.generationBasis ?? null);
  const timed = applyPlatformDraftTimeoutIfNeeded(record);
  if (timed && record && timed.status === "failed" && record.status !== "failed") {
    await persistDraftRecord(db, article.id, timed);
    record = timed;
  }

  const publishResolved = getArticlePublishPlatform({
    generationBasis: article.generationBasis ?? null,
    targetPlatform: null,
    publishPlatform: null,
  });

  const view = buildPlatformDraftStatusView(
    article.id,
    record,
    publishResolved.slug !== "unknown" ? publishResolved.slug : record?.platform ?? null,
  );

  const qualityNotice =
    view.status === "generated" && article.status !== "质检通过" ? PLATFORM_CONTENT_QC_MANUAL_REVIEW_MESSAGE : null;

  return {
    ...view,
    topicId: article.topicId,
    qualityNotice,
  };
}

export async function listInFlightPlatformDraftArticleIds(db: DbConn, projectId: number): Promise<number[]> {
  const rows = await db
    .select({ id: geoArticles.id, generationBasis: geoArticles.generationBasis })
    .from(geoArticles)
    .where(eq(geoArticles.projectId, projectId))
    .orderBy(desc(geoArticles.updatedAt))
    .limit(300);
  const ids: number[] = [];
  for (const row of rows) {
    const record = readPlatformDraftGeneration(row.generationBasis ?? null);
    if (isPlatformDraftInFlight(record?.status)) ids.push(row.id);
  }
  return ids;
}

import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { GEO_SYNTHETIC_AI_RESPONSE_PREFIX, isSyntheticGeoRawAnswer } from "@shared/geoSyntheticResponse";
import { extractProfileForQuestionGeneration } from "@shared/geoProfileQuestionMapping";
import { CREATE_PROJECT_FAILED_USER_MESSAGE } from "@shared/userFacingMutationErrors";
import {
  assertLlmConfiguredForDiagnosis,
  classifyGeoDiagnosisLlmError,
} from "@shared/geoDiagnosisLlmErrors";
import { ensureProjectsOwnerUserIdColumnOnce } from "./ensureProjectsOwnerUserId";
import { mapInclusionMonitoringRecordForApi } from "@shared/inclusionMonitoring";
import { mergeLinkAccessIntoRawJson } from "@shared/inclusionMonitoringDisplay";
import { and, asc, desc, eq, inArray, like, not } from "drizzle-orm";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, upsertUser } from "./db";
import { loginEmailUser, registerEmailUser } from "./emailAuth";
import { setUserSessionCookie } from "./authSession";
import { agentRouter } from "./agentRouter";
import { publishTasksRouter } from "./publishTasksRouter";
import { projectPlatformAccountsRouter } from "./projectPlatformAccountsRouter";
import { effectiveActionsRouter } from "./effectiveActionsRouter";

import {
  aiResponses,
  analysisResults,
  contentPlanItems,
  contentPlans,
  contentTemplates,
  complianceRules,
  competitorProfiles,
  contentStyleProfiles,
  customerCases,
  enterpriseGeoProfiles,
  geoArticleQualityScores,
  geoArticleTopics,
  geoArticles,
  geoPublishRecords,
  geoInclusionMonitoringRecords,
  geoAssetSources,
  geoScores,
  optimizationTasks,
  platformAuthorizationConfigs,
  publishStrategies,
  projects,
  questions,
  reports,
  aiTestRuns,
  retestComparisons,
  roundQuestions,
  testRounds,
  type Project,
} from "../drizzle/schema";
import {
  aiPlatforms,
  generatedQuestionTypes,
  attachQuestionTextToAnalyses,
  calculateGeoScore,
  deriveQuestionDiagnosisMeta,
  generateContentTemplates,
  generateOptimizationTasks,
  generateReportMarkdown,
  resolveEffectiveAnalysisResult,
  resolveEffectiveAnalysisResults,
  projectStatuses,
  questionSources,
  questionTypes,
  taskStatuses,
  taskTypes,
  templateTypes,
} from "./geoLogic";
import {
  articleTypes,
  canAuditArticle,
  canPublishArticle,
  buildOptimizedArticleVersion,
  evaluateAssetLibraryPrePublishCheck,
  generateGeoArticleDraft,
  generateGeoArticleTopics,
  generateTargetQuestions as llmGenerateTargetSearchQuestions,
  GEO_ARTICLE_MIN_PASS_SCORE,
  mergeProjectWithEnterpriseProfile,
  parseOptimizationTaskCard,
  resolveEnterpriseProfileForContent,
  scoreGeoArticleQuality,
  withResolvedEnterpriseProfile,
  type ArticleStatus,
  type P12AssetLibraryContext,
} from "./geoArticleLogic";
import { runGeoArticleQualityCheckFlow } from "./geoArticleQualityCheckFlow";
import { appendArticleLifecycleEvent, getArticleLifecycleTimeline } from "./articleLifecycleService";
import { resolveArticleLifecycleView } from "@shared/articleLifecycle";
import { triggerManualReview, getArticleReviewFlagsByProject, enqueueReviewQueueItem } from "./reviewQueueService";
import { recordRewriteFromQualityReject } from "./rewritePoolService";
import { generateNextContentSuggestion, getArticleRewriteFlagsByProject } from "./rewritePoolService";
import { listPostPublishRetestQueue, listRewritePool } from "./postPublishWorkflow";
import { runContentQualityReview } from "./geoQualityReviewService";
import { storagePut } from "./storage";
import { buildInitialInclusionMonitoringRecord } from "./geoMonitoring";
import { probePublishLinkAccessibility } from "./publishLinkAccessibility";
import { createT0RoundWithQuestions, startT0Execution } from "./geoT0Executor";
import { resolveLatestT0AiTestRunMetrics } from "./t0AiTestRunMetrics";
import { calculateRetestComparison } from "./geoRetestCalculator";
import { ACCOUNT_GROUP_TYPES, CONTENT_ASSET_TYPES, PUBLISH_IDENTITIES } from "@shared/contentStrategy";
import { resolveArticleListPublishFields } from "@shared/articlePublishPlatform";
import {
  GEO_ENHANCEMENT_GOAL_OPTIONS,
  PUBLISH_PLATFORM_IDS,
  formatTargetAiPlatformsForPrompt,
  getDefaultTargetAiPlatforms,
  normalizeTargetAiPlatforms,
} from "@shared/platformContentRules";
import { formatPlatformRuleSummaryForGeneration } from "@shared/geoContentTaskSource";
import type { GeoContentTaskGenerationTrace } from "@shared/platformContentRules";
import {
  PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE,
  PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
  PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE,
  toPlatformContentGenerationError,
  PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
  PLATFORM_CONTENT_QC_MANUAL_REVIEW_MESSAGE,
} from "@shared/platformContentGenerationErrors";
import { classifyPlatformContentLlmError } from "@shared/platformContentLlmErrors";
import { diagnoseLlmProviderEnv, formatMissingLlmEnvServerLog } from "@shared/llmEnvDiagnostics";
import {
  assertEnterpriseProfileForPlatformGeneration,
  assertPlatformContentStrategyParams,
} from "./platformContentGenerationPreconditions";
import { mergeAiTestResultsByStage, normalizeAiTestResult } from "@shared/aiTestEvidence";
import { buildAiMentionSuggestion, runAiMentionCheck } from "./geoAiMentionCheck";
import { resolveProjectCompetitorNames } from "./geoAiMentionEvidence";
import {
  buildDeliveryReportPublicEvidencePayload,
  buildDeliveryReportPublicSharePayload,
  disableEnabledShareTokensForProject,
  getOrCreateShareTokenForProject,
  regenerateShareLinkForProject,
  resolveShareTokenProjectId,
} from "./deliveryReportPublicShare";
import { buildDeliveryReportPublicPath } from "@shared/deliveryReportPublicShare";
import { ARTICLE_COVER_TEMPLATE_IDS, normalizeArticleCoverTemplateId } from "@shared/articleCoverTemplate";
import { runDailyAiCheck } from "./scheduledAiCheck";
import { fetchWorkspaceSummaryMetrics } from "./workspaceSummary";
import { buildGeoTaskDurationLogBase, logGeoAnalysisRunDuration, logGeoArticlesGenerateDuration, type GeoArticlesGenerateStepTimings } from "./geoTaskDurationLog";
import {
  getCurrentUserId,
  getProjectRowConn,
  listAccessibleProjectIds,
  requireAiResponseAccess,
  requireAnalysisAccess,
  requireArticleAccess,
  requireMonitoringRecordAccess,
  requireProjectAccess,
  requireQuestionAccess,
  requireTestRoundAccess,
} from "./projectAccess";
import {
  assetInputModes,
  assetSourceTypes,
  assetTrustLevels,
  buildAssetEvidencePack,
  calculateProfileCompletionScore,
  caseVerificationStatuses,
  createUploadAssetDbRecord,
  customerCaseTypes,
  platformAuthorizationStatuses,
  publishReviewModes,
  summarizeTextToStructuredSummary,
  validateCustomerCaseInput,
} from "./assetLibrary";

const projectInput = z.object({
  enterpriseName: z.string().min(1, "请输入企业名称"),
  industry: z.string().min(1, "请输入行业"),
  website: z.string().min(1, "请输入官网"),
  region: z.string().min(1, "请输入地区"),
  productIntro: z.string().min(1, "请输入产品介绍"),
  targetCustomers: z.string().min(1, "请输入目标客户"),
  coreSellingPoints: z.string().min(1, "请输入核心卖点"),
  competitorNames: z.array(z.string()).default([]),
  coreKeywords: z.array(z.string()).default([]),
});

const questionInput = z.object({
  projectId: z.number().int().positive(),
  questionText: z.string().min(1, "请输入问题"),
  questionType: z.enum(questionTypes),
  targetKeyword: z.string().optional().nullable(),
  intentLevel: z.string().optional().default("高"),
  businessValue: z.number().int().min(1).max(5).optional().default(5),
  source: z.enum(questionSources).optional().default("manual"),
  enabled: z.boolean().default(true),
});

const manualQuestionImportRow = z.object({
  questionText: z.string().min(1, "请输入问题"),
  questionType: z.enum(questionTypes).optional().default("指定问题"),
  targetKeyword: z.string().optional().nullable(),
  intentLevel: z.string().optional().default("高"),
  businessValue: z.number().int().min(1).max(5).optional().default(5),
});

type ManualQuestionImportRow = {
  questionText: string;
  questionType?: (typeof questionTypes)[number];
  targetKeyword?: string | null;
  intentLevel?: string;
  businessValue?: number;
};

const aiResponseInput = z.object({
  projectId: z.number().int().positive(),
  questionId: z.number().int().positive().optional().nullable(),
  questionText: z.string().min(1, "请输入问题"),
  aiPlatform: z.enum(aiPlatforms),
  rawAnswer: z.string().min(1, "请输入 AI 原始回答"),
  checkedAt: z.string().min(1, "请输入检测时间"),
});

const contentPlanInput = z.object({
  id: z.number().int().positive().optional(),
  projectId: z.number().int().positive(),
  planName: z.string().min(1, "请输入计划名称"),
  weekStartDate: z.string().min(1, "请选择周期开始日期"),
  weeklyArticleCount: z.number().int().min(1).max(20),
  targetPlatforms: z.array(z.string().min(1)).min(1, "请选择目标发布平台"),
  contentTypes: z.array(z.string().min(1)).min(1, "请选择内容类型"),
  linkedOptimizationTaskIds: z.array(z.number().int().positive()).min(1, "请选择要绑定的优化任务"),
  status: z.string().optional().default("已配置"),
});

const contentPlanItemInput = z.object({
  projectId: z.number().int().positive(),
  planId: z.number().int().positive(),
  topicId: z.number().int().positive().optional().nullable(),
  articleId: z.number().int().positive().optional().nullable(),
  targetPlatform: z.string().min(1, "请选择目标平台"),
  contentType: z.string().min(1, "请选择内容类型"),
  status: z.string().optional().default("待生成"),
  differentiationAngle: z.string().optional().nullable(),
  duplicateRisk: z.string().optional().nullable(),
});

const manualPublishPlatforms = [
  "自有内容站 / 企业官网 GEO 页面",
  "微信公众号",
  "知乎",
  "百家号",
  "头条号",
  "小红书",
  "搜狐号",
  "网易号",
  "CSDN / 掘金",
] as const;

const manualPublishStatuses = [
  "pending_human_publish",
  "published",
  "publish_failed",
  "manual_publish_needed",
  "link_backfilled",
] as const;

const manualPublishRecordInput = z.object({
  projectId: z.number().int().positive(),
  articleId: z.number().int().positive(),
  publishPlatform: z.enum(manualPublishPlatforms),
  publishTitle: z.string().min(1, "请输入发布标题"),
  publishUrl: z.string().optional().default(""),
  publishedAt: z.string().min(1, "请选择发布时间"),
  publishStatus: z.enum(manualPublishStatuses),
  notes: z.string().optional().default(""),
});
const analysisManualReviewInput = z.object({
  id: z.number().int().positive(),
  mentionsEnterprise: z.boolean(),
  recommendsEnterprise: z.boolean(),
  mentionsCompetitors: z.boolean(),
  recommendedCompetitors: z.array(z.string()).default([]),
  enterpriseWins: z.boolean(),
  recommendationReason: z.string().optional().default(""),
  notRecommendedReason: z.string().optional().default(""),
  hasMisconception: z.boolean(),
  contentGap: z.string().optional().default(""),
  optimizationSuggestion: z.string().optional().default(""),
  confidence: z.number().min(0).max(100).optional().nullable(),
  reviewNote: z.string().optional().nullable(),
});

const requireDb = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接不可用" });
  return db;
};

export const resolveForwardProjectStatus = (
  currentStatus: typeof projectStatuses[number] | null | undefined,
  requestedStatus: typeof projectStatuses[number],
) => {
  const currentIndex = currentStatus ? projectStatuses.indexOf(currentStatus) : -1;
  const requestedIndex = projectStatuses.indexOf(requestedStatus);
  return requestedIndex >= currentIndex ? requestedStatus : currentStatus ?? requestedStatus;
};

const updateProjectStatus = async (projectId: number, status: typeof projectStatuses[number]) => {
  const db = await requireDb();
  const current = await db.select({ status: projects.status }).from(projects).where(eq(projects.id, projectId)).limit(1);
  const nextStatus = resolveForwardProjectStatus(current[0]?.status, status);
  if (nextStatus !== current[0]?.status) {
    await db.update(projects).set({ status: nextStatus }).where(eq(projects.id, projectId));
  }
};

const getAssetLibraryContext = async (projectId: number): Promise<P12AssetLibraryContext> => {
  const db = await requireDb();
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
};

const normalizeQuestionText = (value: string) => value.trim();

/** 保存 AI 原始回答后，将每条回答中的客户问题写入 questions（source=manual）；同一 projectId 下 questionText（trim 后）已存在则跳过 */
async function syncManualQuestionsFromAiResponseImport(
  db: Awaited<ReturnType<typeof requireDb>>,
  rows: Array<{ projectId: number; questionText: string }>,
) {
  const byProject = new Map<number, string[]>();
  for (const row of rows) {
    const text = normalizeQuestionText(row.questionText);
    if (!text) continue;
    const list = byProject.get(row.projectId);
    if (list) list.push(text);
    else byProject.set(row.projectId, [text]);
  }

  for (const [projectId, texts] of Array.from(byProject.entries())) {
    const existingRows = await db.select({ questionText: questions.questionText }).from(questions).where(eq(questions.projectId, projectId));
    const existingSet = new Set(existingRows.map(r => normalizeQuestionText(r.questionText)));

    const batchSeen = new Set<string>();
    const toInsert: Array<{
      projectId: number;
      questionText: string;
      questionType: "指定问题";
      targetKeyword: null;
      intentLevel: string;
      businessValue: number;
      source: "manual";
      enabled: number;
    }> = [];

    for (const text of texts) {
      if (existingSet.has(text) || batchSeen.has(text)) continue;
      batchSeen.add(text);
      existingSet.add(text);
      toInsert.push({
        projectId,
        questionText: text,
        questionType: "指定问题",
        targetKeyword: null,
        intentLevel: "高",
        businessValue: 5,
        source: "manual",
        enabled: 1,
      });
    }

    if (toInsert.length > 0) {
      await db.insert(questions).values(toInsert);
    }
  }
}

async function insertSpecifiedQuestions(projectId: number, rows: ManualQuestionImportRow[], source: "manual" | "csv") {
  const db = await requireDb();
  const existing = await db.select().from(questions).where(eq(questions.projectId, projectId));
  const known = new Map(existing.map(item => [item.questionText, item]));
  const toInsert = [];
  let skippedDuplicateCount = 0;
  let convertedSpecifiedCount = 0;

  for (const row of rows) {
    const questionText = normalizeQuestionText(row.questionText);
    if (!questionText) {
      skippedDuplicateCount += 1;
      continue;
    }

    const existingQuestion = known.get(questionText);
    if (existingQuestion) {
      skippedDuplicateCount += 1;
      if (existingQuestion.source === "ai_generated" || existingQuestion.questionType !== "指定问题") {
        await db.update(questions).set({
          questionType: "指定问题",
          source,
          targetKeyword: row.targetKeyword?.trim() || existingQuestion.targetKeyword,
          intentLevel: row.intentLevel?.trim() || existingQuestion.intentLevel || "高",
          businessValue: row.businessValue ?? existingQuestion.businessValue ?? 5,
          enabled: 1,
        }).where(eq(questions.id, existingQuestion.id));
        known.set(questionText, {
          ...existingQuestion,
          questionType: "指定问题",
          source,
          targetKeyword: row.targetKeyword?.trim() || existingQuestion.targetKeyword,
          intentLevel: row.intentLevel?.trim() || existingQuestion.intentLevel || "高",
          businessValue: row.businessValue ?? existingQuestion.businessValue ?? 5,
          enabled: 1,
        });
        convertedSpecifiedCount += 1;
      }
      continue;
    }

    const inserted = {
      projectId,
      questionText,
      questionType: row.questionType ?? "指定问题" as const,
      targetKeyword: row.targetKeyword?.trim() || null,
      intentLevel: row.intentLevel?.trim() || "高",
      businessValue: row.businessValue ?? 5,
      enabled: 1,
      source,
    };
    known.set(questionText, inserted as typeof questions.$inferSelect);
    toInsert.push(inserted);
  }

  if (toInsert.length > 0) {
    await db.insert(questions).values(toInsert);
  }
  await updateProjectStatus(projectId, "questions_ready");

  return {
    success: true,
    addedCount: toInsert.length,
    skippedDuplicateCount,
    convertedSpecifiedCount,
    totalCount: existing.length + toInsert.length,
  } as const;
}

function parseLLMJson<T>(content: unknown): T {
  if (typeof content !== "string") {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回格式不是文本 JSON" });
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回 JSON 解析失败" });
  }
}

/** V12 目标客户问题在 `questions.targetKeyword` 中写入的 JSON：`{ intent, disadvantaged }`。 */
function parseQuestionGeoMeta(targetKeyword: string | null | undefined): { intent: string; disadvantaged: boolean } {
  const raw = typeof targetKeyword === "string" ? targetKeyword.trim() : "";
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as { intent?: unknown; disadvantaged?: unknown };
      const intent = typeof j.intent === "string" ? j.intent.trim().slice(0, 32) : "";
      return { intent, disadvantaged: j.disadvantaged === true };
    } catch {
      /* ignore */
    }
  }
  return { intent: "", disadvantaged: false };
}

function buildEnterpriseInfoBlockForDiagnosis(
  project: Project,
  profile: (typeof enterpriseGeoProfiles.$inferSelect) | undefined,
): string {
  const resolved = resolveEnterpriseProfileForContent(profile ?? null);
  const painFromProfile = profile?.customerPains?.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
  const painStr = painFromProfile?.length ? painFromProfile.join("；") : resolved.customerPains.join("；") || "（档案未填，请结合行业常识推演）";
  const compArr = profile?.competitors?.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()) ?? [];
  const comps = compArr.length > 0 ? compArr.join("、") : project.competitorNames.join("、") || "（未填）";
  return [
    `企业名称：${project.enterpriseName}`,
    `行业：${project.industry}`,
    `官网：${project.website}`,
    `地区：${project.region}`,
    `品牌/定位摘要：${resolved.oneLiner || project.coreSellingPoints}`,
    `核心产品：${resolved.productDesc || project.productIntro}`,
    `目标客户：${resolved.targetCustomer || project.targetCustomers}`,
    `核心卖点：${project.coreSellingPoints}`,
    `主要竞品：${comps}`,
    `客户核心痛点：${painStr}`,
    `核心关键词：${project.coreKeywords.join("、")}`,
  ].join("\n");
}


const nonEmptyString = z.string().trim().min(1);
const optionalText = z.string().optional().default("");
const optionalUrlText = z.string().optional().default("");
const booleanToInt = (value: boolean) => (value ? 1 : 0);

const enterpriseProfileInput = z.object({
  projectId: z.number().int().positive(),
  enterpriseName: nonEmptyString,
  shortName: optionalText,
  officialWebsite: optionalUrlText,
  industry: optionalText,
  region: optionalText,
  productServiceIntro: optionalText,
  targetCustomers: optionalText,
  coreSellingPoints: optionalText,
  servicePriceRange: optionalText,
  serviceModel: optionalText,
  fitCustomers: optionalText,
  unfitCustomers: optionalText,
  salesChannels: z.array(z.string()).default([]),
  commonQuestions: z.array(z.string()).default([]),
  purchaseDecisionFactors: z.array(z.string()).default([]),
  productIntro: optionalText,
  featureNotes: optionalText,
  serviceProcess: optionalText,
  deliveryPlan: optionalText,
  afterSalesService: optionalText,
  competitorDifference: optionalText,
  priceExplanation: optionalText,
  salesTalkTracks: optionalText,
  commonObjections: optionalText,
  /** 与 `enterprise_geo_profiles` 列对齐：含旧版 NOT NULL JSON 与 V2 扩展列（见 drizzle/schema.ts `enterpriseGeoProfiles`） */
  brandName: optionalText,
  industryTag: optionalText,
  productDesc: optionalText,
  mainChannel: optionalText,
  targetCustomer: optionalText,
  customerPains: z.array(z.string()).optional(),
  competitors: z.array(z.string()).optional(),
  hasCases: z.boolean().optional(),
  oneLiner: optionalText,
  keyPoints: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

const assetSourceBaseInput = z.object({
  projectId: z.number().int().positive(),
  sourceType: z.enum(assetSourceTypes),
  title: nonEmptyString,
  contentDigest: z.string().optional().default(""),
  trustLevel: z.enum(assetTrustLevels).default("中"),
  isPublic: z.boolean().default(false),
  canUseForGeneration: z.boolean().default(false),
  manuallyConfirmed: z.boolean().default(false),
});

const assetTextInput = assetSourceBaseInput.extend({
  inputMode: z.enum(assetInputModes).default("文本粘贴"),
});

const assetUploadInput = assetSourceBaseInput.extend({
  originalFileName: nonEmptyString,
  mimeType: z.string().default("text/plain"),
  fileBase64: z.string().min(1, "请上传文件内容"),
});

const customerCaseInput = z.object({
  projectId: z.number().int().positive(),
  caseType: z.enum(customerCaseTypes),
  customerName: nonEmptyString,
  customerIndustry: optionalText,
  customerBackground: optionalText,
  originalProblem: optionalText,
  chosenReason: optionalText,
  usedProductService: optionalText,
  executionProcess: optionalText,
  resultData: optionalText,
  customerFeedback: optionalText,
  allowPublic: z.boolean().default(false),
  publicVersion: optionalText,
  sensitiveNotes: optionalText,
  sourceAssetIds: z.array(z.number().int().positive()).default([]),
  verificationStatus: z.enum(caseVerificationStatuses).default("待确认"),
});

const competitorInput = z.object({
  projectId: z.number().int().positive(),
  competitorName: nonEmptyString,
  website: optionalUrlText,
  positioning: optionalText,
  strengths: optionalText,
  weaknesses: optionalText,
  priceInfo: optionalText,
  contentAssets: optionalText,
  aiRecommendationSignals: optionalText,
  comparisonNotes: optionalText,
  sourceAssetIds: z.array(z.number().int().positive()).default([]),
  canReference: z.boolean().default(true),
});

const complianceRuleInput = z.object({
  projectId: z.number().int().positive(),
  ruleName: nonEmptyString,
  forbiddenClaims: optionalText,
  forbiddenWords: z.array(z.string()).default([]),
  requiredDisclaimers: optionalText,
  dataUsageRules: optionalText,
  caseUsageRules: optionalText,
  priceUsageRules: optionalText,
  competitorMentionRules: optionalText,
  reviewRequiredTopics: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

const contentStyleInput = z.object({
  projectId: z.number().int().positive(),
  profileName: nonEmptyString,
  tone: nonEmptyString,
  writingStyle: optionalText,
  terminology: z.array(z.string()).default([]),
  forbiddenTone: optionalText,
  exampleTitles: z.array(z.string()).default([]),
  exampleParagraphs: z.array(z.string()).default([]),
  targetReader: optionalText,
  preferredLength: optionalText,
  ctaStyle: optionalText,
  enabled: z.boolean().default(true),
});

const publishStrategyInput = z.object({
  projectId: z.number().int().positive(),
  strategyName: nonEmptyString,
  reviewMode: z.enum(publishReviewModes).default("全人工审核"),
  dailyLimit: z.number().int().positive().nullable().optional(),
  minQualityScore: z.number().int().min(0).max(100).default(GEO_ARTICLE_MIN_PASS_SCORE),
  preferredPlatforms: z.array(z.string()).default([]),
  bannedPlatforms: z.array(z.string()).default([]),
  platformNotes: optionalText,
  enabled: z.boolean().default(true),
});

const platformAuthorizationInput = z.object({
  projectId: z.number().int().positive(),
  platformName: nonEmptyString,
  accountAlias: optionalText,
  authorizationStatus: z.enum(platformAuthorizationStatuses).default("未配置"),
  secureCredentialRef: z.string().optional().default(""),
  authorizationNotes: optionalText,
});

const geoAssetRouter = router({
  summary: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    if (!input.projectId) {
      return {
        profile: null,
        completionScore: 0,
        nextAction: "请先选择项目，再补充企业资料。",
        riskReminders: ["未选择项目，后续内容生成不能引用企业资料依据。"],
        assetSources: [],
        customerCases: [],
        competitors: [],
        complianceRules: [],
        styleProfiles: [],
        publishStrategies: [],
        platformAuthorizations: [],
        counts: { assetSources: 0, usableAssets: 0, customerCases: 0, realCases: 0, competitors: 0, complianceRules: 0, styleProfiles: 0, publishStrategies: 0, platformAuthorizations: 0 },
      } as const;
    }
    await requireProjectAccess(ctx, input.projectId);
    const [profiles, sources, cases, competitors, rules, styles, strategies, authorizations] = await Promise.all([
      db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, input.projectId)).limit(1),
      db.select().from(geoAssetSources).where(eq(geoAssetSources.projectId, input.projectId)).orderBy(desc(geoAssetSources.createdAt)),
      db.select().from(customerCases).where(eq(customerCases.projectId, input.projectId)).orderBy(desc(customerCases.createdAt)),
      db.select().from(competitorProfiles).where(eq(competitorProfiles.projectId, input.projectId)).orderBy(desc(competitorProfiles.createdAt)),
      db.select().from(complianceRules).where(eq(complianceRules.projectId, input.projectId)).orderBy(desc(complianceRules.createdAt)),
      db.select().from(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, input.projectId)).orderBy(desc(contentStyleProfiles.createdAt)),
      db.select().from(publishStrategies).where(eq(publishStrategies.projectId, input.projectId)).orderBy(desc(publishStrategies.createdAt)),
      db.select().from(platformAuthorizationConfigs).where(eq(platformAuthorizationConfigs.projectId, input.projectId)).orderBy(desc(platformAuthorizationConfigs.createdAt)),
    ]);
    const profile = profiles[0] ?? null;
    const completionScore = profile?.completionScore ?? calculateProfileCompletionScore(profile);
    const usableAssetCount = sources.filter(source => source.canUseForGeneration && source.manuallyConfirmed).length;
    const realCaseCount = cases.filter(item => item.caseType === "真实案例" && item.verificationStatus === "已确认").length;
      const counts = { assetSources: sources.length, usableAssets: usableAssetCount, customerCases: cases.length, realCases: realCaseCount, competitors: competitors.length, complianceRules: rules.length, styleProfiles: styles.length, publishStrategies: strategies.length, platformAuthorizations: authorizations.length };
      const riskReminders = [
        usableAssetCount === 0 ? "暂无已确认且允许用于内容生成的资料，后续文章不能直接引用客户资料。" : "已有可用于内容生成的客户资料，后续文章应强制引用。",
      realCaseCount === 0 ? "暂无已确认真实案例，系统不得编造客户案例、结果数据或客户反馈。" : "已有已确认真实案例，引用时仍需遵守公开授权和敏感信息规则。",
      authorizations.some(item => /password|pwd|token|cookie|密码/i.test(`${item.authorizationNotes ?? ""}${item.secureCredentialRef ?? ""}`)) ? "平台授权配置存在疑似敏感信息，请立即清理。" : "平台授权配置采用脱敏或引用方式，不保存明文账号密码。",
    ];
    const nextAction = completionScore < 60
      ? "继续补充企业基础信息、产品服务资料和客户购买决策点。"
      : usableAssetCount === 0
        ? "请确认至少一条资料允许用于内容生成。"
        : realCaseCount === 0
          ? "如需案例型内容，请先补充真实案例来源；否则后续内容应避开案例承诺。"
          : "资产库可支撑后续诊断、内容生成、质检和发布策略。";
      return {
        profile,
        completionScore,
        nextAction,
        riskReminders,
        counts,
        assetSources: sources,
      customerCases: cases,
      competitors,
      complianceRules: rules,
      styleProfiles: styles,
      publishStrategies: strategies,
      platformAuthorizations: authorizations,
    } as const;
  }),
  upsertProfile: protectedProcedure.input(enterpriseProfileInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const completionScore = calculateProfileCompletionScore(input);
    const existing = await db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, input.projectId)).limit(1);
    const raw = { ...input, completionScore } as Record<string, unknown>;
    const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as typeof raw;
    let profileId = existing[0]?.id ?? 0;
    if (existing[0]) {
      await db.update(enterpriseGeoProfiles).set(values).where(eq(enterpriseGeoProfiles.id, existing[0].id));
    } else {
      const inserted = await db.insert(enterpriseGeoProfiles).values(values as never).$returningId();
      profileId = inserted[0]?.id ?? 0;
    }
    const productIntro = String(input.productDesc ?? input.productServiceIntro ?? input.oneLiner ?? input.productIntro ?? "").trim();
    const targetCustomers = String(input.targetCustomer ?? input.targetCustomers ?? "").trim();
    const coreSellingPoints = String(
      input.coreSellingPoints?.trim() || input.keyPoints?.join("；") || input.oneLiner?.trim() || "",
    ).trim();
    await db
      .update(projects)
      .set({
        enterpriseName: input.enterpriseName,
        industry: input.industry?.trim() || input.industryTag?.trim() || undefined,
        productIntro: productIntro || undefined,
        targetCustomers: targetCustomers || undefined,
        coreSellingPoints: coreSellingPoints || undefined,
      })
      .where(eq(projects.id, input.projectId));
    return { success: true, id: profileId, completionScore } as const;
  }),
  addTextSource: protectedProcedure.input(assetTextInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const structuredSummary = summarizeTextToStructuredSummary(input.contentDigest, input.title);
    const inserted = await db.insert(geoAssetSources).values({
      projectId: input.projectId,
      sourceType: input.sourceType,
      inputMode: input.inputMode,
      title: input.title,
      contentDigest: input.contentDigest,
      structuredSummary,
      trustLevel: input.trustLevel,
      parseStatus: input.manuallyConfirmed ? "人工确认" : "已解析",
      isPublic: booleanToInt(input.isPublic),
      canUseForGeneration: booleanToInt(input.canUseForGeneration),
      manuallyConfirmed: booleanToInt(input.manuallyConfirmed),
      parsedAt: new Date(),
    }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  addUploadedSource: protectedProcedure.input(assetUploadInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const raw = Buffer.from(input.fileBase64, "base64");
    if (raw.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "上传文件为空" });
    const relKey = `geo-assets/${input.projectId}/${Date.now()}-${input.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const stored = await storagePut(relKey, raw, input.mimeType);
    const digest = input.contentDigest || `已上传文件：${input.originalFileName}，大小 ${raw.length} 字节。数据库仅保存文件 key、URL 与摘要，不保存文件字节。`;
    const record = createUploadAssetDbRecord({
      projectId: input.projectId,
      sourceType: input.sourceType,
      title: input.title,
      originalFileName: input.originalFileName,
      fileKey: stored.key,
      fileUrl: stored.url,
      mimeType: input.mimeType,
      contentDigest: digest,
      trustLevel: input.trustLevel,
      isPublic: input.isPublic,
      canUseForGeneration: input.canUseForGeneration,
      manuallyConfirmed: input.manuallyConfirmed,
    });
    const inserted = await db.insert(geoAssetSources).values(record).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0, fileKey: stored.key, fileUrl: stored.url } as const;
  }),
  createCustomerCase: protectedProcedure.input(customerCaseInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    try {
      validateCustomerCaseInput(input);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "客户案例校验失败" });
    }
    const inserted = await db.insert(customerCases).values({
      ...input,
      allowPublic: booleanToInt(input.allowPublic),
      verificationStatus: input.caseType === "待补充案例线索" ? "信息不足" : input.verificationStatus,
    }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  updateCustomerCase: protectedProcedure.input(customerCaseInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    try {
      validateCustomerCaseInput(input);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "客户案例校验失败" });
    }
    const { id, ...values } = input;
    await db.update(customerCases).set({
      ...values,
      allowPublic: booleanToInt(values.allowPublic),
      verificationStatus: values.caseType === "待补充案例线索" ? "信息不足" : values.verificationStatus,
    }).where(eq(customerCases.id, id));
    return { success: true, id } as const;
  }),
  createCompetitor: protectedProcedure.input(competitorInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const inserted = await db.insert(competitorProfiles).values({ ...input, canReference: booleanToInt(input.canReference) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  updateCompetitor: protectedProcedure.input(competitorInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const { id, ...values } = input;
    await db.update(competitorProfiles).set({ ...values, canReference: booleanToInt(values.canReference) }).where(eq(competitorProfiles.id, id));
    return { success: true, id } as const;
  }),
  /** 合规规则 / 发布策略 / 平台授权 的客户写入入口已关闭，统一由 `server/systemConfig.ts` 与只读历史表承载。 */
  createComplianceRule: protectedProcedure.input(complianceRuleInput).mutation(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "合规规则已迁移为系统统一配置，此入口已关闭。" });
  }),
  updateComplianceRule: protectedProcedure.input(complianceRuleInput.extend({ id: z.number().int().positive() })).mutation(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "合规规则已迁移为系统统一配置，此入口已关闭。" });
  }),
  createStyleProfile: protectedProcedure.input(contentStyleInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const inserted = await db.insert(contentStyleProfiles).values({ ...input, enabled: booleanToInt(input.enabled) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  createPublishStrategy: protectedProcedure.input(publishStrategyInput).mutation(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "发布策略已迁移为系统统一配置，此入口已关闭。" });
  }),
  updatePublishStrategy: protectedProcedure.input(publishStrategyInput.extend({ id: z.number().int().positive() })).mutation(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "发布策略已迁移为系统统一配置，此入口已关闭。" });
  }),
  createPlatformAuthorization: protectedProcedure.input(platformAuthorizationInput).mutation(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "第三方平台授权已不在企业档案维护，此入口已关闭。" });
  }),
  updatePlatformAuthorization: protectedProcedure.input(platformAuthorizationInput.extend({ id: z.number().int().positive() })).mutation(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "第三方平台授权已不在企业档案维护，此入口已关闭。" });
  }),
  analyzeDocument: protectedProcedure.input(z.object({
    projectId: z.number().int().positive(),
    documentText: z.string().min(20, "资料内容过短，请补充后重试").max(50000, "资料内容过长，请分段上传"),
  })).mutation(async ({ ctx, input }) => {
    const { analyzeEnterpriseProfileDocument } = await import("./enterpriseProfileAnalyze");
    await requireProjectAccess(ctx, input.projectId);
    try {
      const analysis = await analyzeEnterpriseProfileDocument(input.documentText);
      return { success: true as const, analysis };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "资料解析失败，请稍后重试";
      throw new TRPCError({ code: "BAD_REQUEST", message: msg });
    }
  }),
  generateProfileMarketingCopy: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const rows = await db
      .select()
      .from(enterpriseGeoProfiles)
      .where(eq(enterpriseGeoProfiles.projectId, input.projectId))
      .orderBy(desc(enterpriseGeoProfiles.updatedAt))
      .limit(1);
    const p = rows[0];
    if (!p) throw new TRPCError({ code: "BAD_REQUEST", message: "请先保存企业档案。" });
    const brandName = String(p.brandName ?? p.enterpriseName ?? "").trim();
    const industryTag = String(p.industryTag ?? p.industry ?? "").trim();
    const productDesc = String(p.productDesc ?? p.productServiceIntro ?? p.productIntro ?? "").trim();
    const targetCustomer = String(p.targetCustomer ?? p.targetCustomers ?? "").trim();
    const painsRaw: unknown = p.customerPains;
    let pains: string[] = [];
    if (Array.isArray(painsRaw)) pains = painsRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
    else if (typeof painsRaw === "string" && painsRaw.trim()) {
      try {
        const j = JSON.parse(painsRaw) as unknown;
        if (Array.isArray(j)) pains = j.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
      } catch {
        /* ignore */
      }
    }
    if (!brandName || !industryTag || !productDesc || !targetCustomer || pains.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成「基本身份」与「你的客户」必填项并保存。" });
    }
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "你是 B2B 企业内容与市场顾问。只输出符合 JSON Schema 的中文结果；卖点要具体可验证倾向，关键词用于 GEO 内容检索场景。" },
        {
          role: "user",
          content: `根据以下信息生成：1）一句话介绍 oneLiner（不超过 60 字）；2）核心卖点 keyPoints（3-8 条，每条不超过 24 字）；3）核心关键词 keywords（5-12 个词或短语，每条不超过 12 字）。\n\n企业/品牌：${brandName}\n行业方向：${industryTag}\n产品/服务：${productDesc}\n目标客户：${targetCustomer}\n客户痛点：${pains.join("、")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "profile_marketing_snippets",
          strict: true,
          schema: {
            type: "object",
            properties: {
              oneLiner: { type: "string" },
              keyPoints: {
                type: "array",
                minItems: 3,
                maxItems: 8,
                items: { type: "string" },
              },
              keywords: {
                type: "array",
                minItems: 5,
                maxItems: 12,
                items: { type: "string" },
              },
            },
            required: ["oneLiner", "keyPoints", "keywords"],
            additionalProperties: false,
          },
        },
      },
    });
    const parsed = parseLLMJson<{ oneLiner: string; keyPoints: string[]; keywords: string[] }>(response.choices[0]?.message.content);
    return { oneLiner: parsed.oneLiner.trim(), keyPoints: parsed.keyPoints.map(s => s.trim()).filter(Boolean), keywords: parsed.keywords.map(s => s.trim()).filter(Boolean) } as const;
  }),
  evidencePack: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), assetIds: z.array(z.number().int().positive()).min(1) })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireProjectAccess(ctx, input.projectId);
    const sources = await db.select().from(geoAssetSources).where(eq(geoAssetSources.projectId, input.projectId));
    const selected = sources.filter(source => input.assetIds.includes(source.id));
    if (selected.length !== input.assetIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "存在不属于当前项目的资料来源" });
    }
    try {
      return buildAssetEvidencePack(selected.map(source => ({
        id: source.id,
        title: source.title,
        sourceType: source.sourceType,
        trustLevel: source.trustLevel,
        canUseForGeneration: source.canUseForGeneration,
        manuallyConfirmed: source.manuallyConfirmed,
        structuredSummary: source.structuredSummary,
        contentDigest: source.contentDigest,
      })));
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "资料不能作为内容依据" });
    }
  }),
});

const geoRouter = router({
  assetLibrary: geoAssetRouter,
  publishRecords: router({
    listWithStatus: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);

        const records = await db
          .select()
          .from(geoPublishRecords)
          .where(eq(geoPublishRecords.projectId, input.projectId))
          .orderBy(desc(geoPublishRecords.publishedAt));

        const monitoringRecords = await db
          .select({
            publishRecordId: geoInclusionMonitoringRecords.publishRecordId,
            id: geoInclusionMonitoringRecords.id,
            aiMentionStatus: geoInclusionMonitoringRecords.aiMentionMonitorStatus,
            aiRecommendStatus: geoInclusionMonitoringRecords.aiRecommendMonitorStatus,
            inclusionStatus: geoInclusionMonitoringRecords.inclusionMonitorStatus,
            lastAiTestedAt: geoInclusionMonitoringRecords.lastAiTestedAt,
          })
          .from(geoInclusionMonitoringRecords)
          .where(eq(geoInclusionMonitoringRecords.projectId, input.projectId));

        const monitoringMap = new Map(monitoringRecords.map(r => [r.publishRecordId, r]));

        return records.map(r => ({
          ...r,
          monitoring: monitoringMap.get(r.id) ?? null,
        }));
      }),
  }),

  workspace: router({
    summary: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const metrics = await fetchWorkspaceSummaryMetrics(db, input.projectId);
        return metrics;
      }),
  }),

  clientDashboard: router({
    /** 客户管理台聚合查询：仅当前用户可访问项目 */
    listProjectsSummary: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const accessibleIds = await listAccessibleProjectIds(ctx);
      if (accessibleIds.length === 0) return [];

      const allProjects = await db
        .select()
        .from(projects)
        .where(inArray(projects.id, accessibleIds))
        .orderBy(desc(projects.createdAt));

      const projectIds = accessibleIds;
      const [articleRows, publishRows, monitoringRows, analysisRows, scoreRows] = await Promise.all([
        db
          .select({ projectId: geoArticles.projectId })
          .from(geoArticles)
          .where(inArray(geoArticles.projectId, projectIds)),
        db
          .select({ projectId: geoPublishRecords.projectId })
          .from(geoPublishRecords)
          .where(inArray(geoPublishRecords.projectId, projectIds)),
        db
          .select({
            projectId: geoInclusionMonitoringRecords.projectId,
            aiTestResults: geoInclusionMonitoringRecords.aiTestResults,
          })
          .from(geoInclusionMonitoringRecords)
          .where(inArray(geoInclusionMonitoringRecords.projectId, projectIds)),
        db
          .select({
            projectId: analysisResults.projectId,
            createdAt: analysisResults.createdAt,
          })
          .from(analysisResults)
          .where(inArray(analysisResults.projectId, projectIds))
          .orderBy(desc(analysisResults.createdAt)),
        db
          .select({
            projectId: geoScores.projectId,
            score: geoScores.totalScore,
            createdAt: geoScores.createdAt,
          })
          .from(geoScores)
          .where(inArray(geoScores.projectId, projectIds))
          .orderBy(desc(geoScores.createdAt)),
      ]);

      const articleCountMap = new Map<number, number>();
      for (const r of articleRows) {
        articleCountMap.set(r.projectId, (articleCountMap.get(r.projectId) ?? 0) + 1);
      }
      const publishCountMap = new Map<number, number>();
      for (const r of publishRows) {
        publishCountMap.set(r.projectId, (publishCountMap.get(r.projectId) ?? 0) + 1);
      }
      const aiTestCountMap = new Map<number, number>();
      for (const r of monitoringRows) {
        const results = Array.isArray(r.aiTestResults) ? r.aiTestResults : [];
        aiTestCountMap.set(r.projectId, (aiTestCountMap.get(r.projectId) ?? 0) + results.length);
      }
      const lastDiagnosisMap = new Map<number, Date>();
      for (const r of analysisRows) {
        if (!lastDiagnosisMap.has(r.projectId)) {
          lastDiagnosisMap.set(r.projectId, r.createdAt);
        }
      }
      const latestScoreMap = new Map<number, number>();
      for (const r of scoreRows) {
        if (!latestScoreMap.has(r.projectId)) {
          latestScoreMap.set(r.projectId, r.score ?? 0);
        }
      }

      return allProjects.map(p => ({
        id: p.id,
        enterpriseName: p.enterpriseName,
        industry: p.industry,
        website: p.website,
        region: p.region,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        articleCount: articleCountMap.get(p.id) ?? 0,
        publishCount: publishCountMap.get(p.id) ?? 0,
        aiTestCount: aiTestCountMap.get(p.id) ?? 0,
        lastDiagnosisAt: lastDiagnosisMap.get(p.id) ?? null,
        latestGeoScore: latestScoreMap.get(p.id) ?? null,
      }));
    }),
  }),

  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const userId = getCurrentUserId(ctx);
      return db
        .select()
        .from(projects)
        .where(eq(projects.ownerUserId, userId))
        .orderBy(desc(projects.createdAt));
    }),
    create: protectedProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
      await ensureProjectsOwnerUserIdColumnOnce();
      const db = await requireDb();
      const ownerUserId = getCurrentUserId(ctx);
      try {
        await db.insert(projects).values({ ...input, ownerUserId });
      } catch (err) {
        console.error("[geo.projects.create]", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: CREATE_PROJECT_FAILED_USER_MESSAGE,
        });
      }
      return { success: true } as const;
    }),
    update: protectedProcedure.input(projectInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.id);
      const { id, ...values } = input;
      await db.update(projects).set(values).where(eq(projects.id, id));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.id);
      await db.delete(reports).where(eq(reports.projectId, input.id));
      await db.delete(contentTemplates).where(eq(contentTemplates.projectId, input.id));
      await db.delete(optimizationTasks).where(eq(optimizationTasks.projectId, input.id));
      await db.delete(geoScores).where(eq(geoScores.projectId, input.id));
      await db.delete(analysisResults).where(eq(analysisResults.projectId, input.id));
      await db.delete(aiResponses).where(eq(aiResponses.projectId, input.id));
      await db.delete(questions).where(eq(questions.projectId, input.id));
      await db.delete(projects).where(eq(projects.id, input.id));
      return { success: true } as const;
    }),
  }),

  questions: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      return db.select().from(questions).where(eq(questions.projectId, input.projectId)).orderBy(desc(questions.createdAt));
    }),
    create: protectedProcedure.input(questionInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      await db.insert(questions).values({ ...input, targetKeyword: input.targetKeyword?.trim() || null, intentLevel: input.intentLevel ?? "高", businessValue: input.businessValue ?? 5, source: input.source ?? "manual", enabled: input.enabled ? 1 : 0 });
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true } as const;
    }),
    update: protectedProcedure.input(questionInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      const ownedProjectId = await requireQuestionAccess(ctx, id);
      if (values.projectId !== ownedProjectId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权将问题迁移到其它客户项目" });
      }
      await db.update(questions).set({ ...values, targetKeyword: values.targetKeyword?.trim() || null, intentLevel: values.intentLevel ?? "高", businessValue: values.businessValue ?? 5, source: values.source ?? "manual", enabled: values.enabled ? 1 : 0 }).where(eq(questions.id, id));
      return { success: true } as const;
    }),
    toggle: protectedProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireQuestionAccess(ctx, input.id);
      await db.update(questions).set({ enabled: input.enabled ? 1 : 0 }).where(eq(questions.id, input.id));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireQuestionAccess(ctx, input.id);
      await db.delete(questions).where(eq(questions.id, input.id));
      return { success: true } as const;
    }),
    batchAddSpecified: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      questions: z.array(z.string().min(1)).min(1),
    })).mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      return insertSpecifiedQuestions(input.projectId, input.questions.map(questionText => ({ questionText })), "manual");
    }),
    importSpecifiedCsvRows: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      rows: z.array(manualQuestionImportRow).min(1),
    })).mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx, input.projectId);
      return insertSpecifiedQuestions(input.projectId, input.rows, "csv");
    }),
    /** 基于企业档案生成 5–10 条 AI 检索型目标问题，写入 questions（覆盖同项目历史 ai_generated 行）。 */
    generateTargetQuestions: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const project = await requireProjectAccess(ctx, input.projectId);
      const existingRows = await db
        .select({ questionText: questions.questionText })
        .from(questions)
        .where(
          and(
            eq(questions.projectId, input.projectId),
            eq(questions.questionType, "指定问题"),
            eq(questions.enabled, 1),
          ),
        );
      const excludeQuestions = existingRows
        .map(r => (r.questionText ?? "").trim())
        .filter(t => t.length > 0);
      const profileRows = await db
        .select()
        .from(enterpriseGeoProfiles)
        .where(eq(enterpriseGeoProfiles.projectId, input.projectId))
        .orderBy(desc(enterpriseGeoProfiles.updatedAt))
        .limit(1);
      const ep = profileRows[0];
      const mapped = extractProfileForQuestionGeneration({
        profile: (ep ?? null) as Record<string, unknown> | null,
        project,
      });
      const customerPains = mapped.customerPains.length
        ? mapped.customerPains.join("；")
        : "（档案未填客户痛点，请结合行业常识推演）";
      const competitors = mapped.competitors.length > 0 ? mapped.competitors.join("、") : "（未填）";
      const keyPointsStr = mapped.keyPoints.join("；") || project.coreSellingPoints;
      const generatedPack = await llmGenerateTargetSearchQuestions({
        brandName: (mapped.brandName || project.enterpriseName).trim(),
        industryTag: (mapped.industryTag || project.industry).trim(),
        productDesc: (mapped.productDesc || project.productIntro).trim(),
        targetCustomer: (mapped.targetCustomer || project.targetCustomers).trim(),
        customerPains,
        competitors,
        keyPoints: keyPointsStr,
        excludeQuestions,
      });
      const generated = generatedPack.rows;
      await db.delete(questions).where(and(eq(questions.projectId, input.projectId), eq(questions.source, "ai_generated")));
      await db.insert(questions).values(
        generated.map(item => ({
          projectId: input.projectId,
          questionText: item.questionText,
          questionType: "指定问题" as const,
          targetKeyword: JSON.stringify({ intent: item.intent, disadvantaged: item.disadvantaged }),
          intentLevel: "高",
          businessValue: item.disadvantaged ? 9 : 7,
          source: "ai_generated" as const,
          enabled: 1,
        })),
      );
      await updateProjectStatus(input.projectId, "questions_ready");
      return {
        success: true,
        count: generated.length,
        newCount: generated.length,
        filteredCount: generatedPack.filteredCount,
        hadPreviousQuestions: excludeQuestions.length > 0,
      } as const;
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const project = await requireProjectAccess(ctx, input.projectId);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "你是企业 GEO / AI Visibility 诊断顾问。请只输出符合 JSON Schema 的中文结果。" },
          {
            role: "user",
            content: `请根据以下企业信息生成 50 个用户可能向 AI 对话平台提出的问题。必须覆盖问题类型：${generatedQuestionTypes.join("、")}。\n\n企业名称：${project.enterpriseName}\n行业：${project.industry}\n官网：${project.website}\n地区：${project.region}\n产品介绍：${project.productIntro}\n目标客户：${project.targetCustomers}\n核心卖点：${project.coreSellingPoints}\n竞品：${project.competitorNames.join("、")}\n核心关键词：${project.coreKeywords.join("、")}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "geo_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  minItems: 50,
                  maxItems: 50,
                  items: {
                    type: "object",
                    properties: {
                      questionText: { type: "string" },
                      questionType: { type: "string", enum: generatedQuestionTypes },
                    },
                    required: ["questionText", "questionType"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });
      const parsed = parseLLMJson<{ questions: Array<{ questionText: string; questionType: typeof generatedQuestionTypes[number] }> }>(response.choices[0]?.message.content);
      if (parsed.questions.length !== 50) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 未返回 50 个问题，请重新生成" });
      }
      await db.insert(questions).values(parsed.questions.map(item => ({ ...item, projectId: input.projectId, targetKeyword: null, intentLevel: "中", businessValue: 3, source: "ai_generated" as const, enabled: 1 })));
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true, count: parsed.questions.length } as const;
    }),
  }),

  aiResponses: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      return db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId)).orderBy(desc(aiResponses.createdAt));
    }),
    create: protectedProcedure.input(aiResponseInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(aiResponses).values({ ...input, questionId: input.questionId ?? null, checkedAt: new Date(input.checkedAt) });
      await syncManualQuestionsFromAiResponseImport(db, [{ projectId: input.projectId, questionText: input.questionText }]);
      await updateProjectStatus(input.projectId, "responses_imported");
      return { success: true } as const;
    }),
    importCsvRows: protectedProcedure.input(z.object({ rows: z.array(aiResponseInput).min(1) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(aiResponses).values(input.rows.map(row => ({ ...row, questionId: row.questionId ?? null, checkedAt: new Date(row.checkedAt) })));
      await syncManualQuestionsFromAiResponseImport(
        db,
        input.rows.map(row => ({ projectId: row.projectId, questionText: row.questionText })),
      );
      const projectIds = Array.from(new Set(input.rows.map(row => row.projectId)));
      await Promise.all(projectIds.map(projectId => updateProjectStatus(projectId, "responses_imported")));
      return { success: true, count: input.rows.length } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireAiResponseAccess(ctx, input.id);
      await db.delete(analysisResults).where(eq(analysisResults.aiResponseId, input.id));
      await db.delete(aiResponses).where(eq(aiResponses.id, input.id));
      return { success: true } as const;
    }),
  }),

  analysis: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId)).orderBy(desc(analysisResults.createdAt));
      const [responseRows, questionRows] = await Promise.all([
        db.select({ id: aiResponses.id, questionId: aiResponses.questionId, questionText: aiResponses.questionText }).from(aiResponses).where(eq(aiResponses.projectId, input.projectId)),
        db.select({ id: questions.id, questionText: questions.questionText }).from(questions).where(eq(questions.projectId, input.projectId)),
      ]);
      return attachQuestionTextToAnalyses(rows.map(resolveEffectiveAnalysisResult), responseRows, questionRows);
    }),
    run: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const startedAtMs = Date.now();
      const durationBase = () => buildGeoTaskDurationLogBase(startedAtMs);
      const logDuration = (success: boolean, errorCode: string | null) => {
        logGeoAnalysisRunDuration({
          ...durationBase(),
          projectId: input.projectId,
          success,
          errorCode,
        });
      };
      const db = await requireDb();
      const project = await requireProjectAccess(ctx, input.projectId);
      const profileRows = await db
        .select()
        .from(enterpriseGeoProfiles)
        .where(eq(enterpriseGeoProfiles.projectId, input.projectId))
        .orderBy(desc(enterpriseGeoProfiles.updatedAt))
        .limit(1);
      const profileRow = profileRows[0];
      const enterpriseInfo = buildEnterpriseInfoBlockForDiagnosis(project, profileRow);

      const qrows = await db.select().from(questions).where(eq(questions.projectId, input.projectId));
      const diagnosisQuestions = qrows
        .filter(q => q.enabled === 1 && q.questionType === "指定问题")
        .sort((a, b) => (b.businessValue ?? 0) - (a.businessValue ?? 0))
        .slice(0, 10);
      if (diagnosisQuestions.length === 0) {
        logDuration(false, "DIAGNOSIS_DATA_MISSING");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请先在 AI 诊断页点击「重新生成」，或添加「指定问题」类型问题，再运行诊断。",
        });
      }

      const llmPre = assertLlmConfiguredForDiagnosis();
      if (llmPre) {
        console.error("[geo.analysis.run]", llmPre.serverLog);
        logDuration(false, llmPre.code);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: llmPre.userMessage });
      }

      await db.delete(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      await db.delete(aiResponses).where(
        and(eq(aiResponses.projectId, input.projectId), like(aiResponses.rawAnswer, `${GEO_SYNTHETIC_AI_RESPONSE_PREFIX}%`)),
      );

        const diagnosisSystemPrompt = `你是一位GEO内容策略专家，专注于分析企业内容如何更好地回答目标客户的真实问题。
你的任务是推演：当用户在ChatGPT、Perplexity等AI工具中输入这个问题时，该企业现有的内容能否被AI引用来回答这个问题。

分析框架：
1. 这个问题的核心是什么痛点或需求？
2. AI回答这个问题时会引用什么类型的内容？（案例/数据/方法论/工具说明）
3. 该企业目前是否有公开内容能回答这个问题？
4. 内容缺口是什么？需要补充什么类型的内容才能被AI引用？
5. 建议创作的内容方向（不是竞品对比，而是帮客户解决这个问题的内容）

重要约束：
- 不要以「竞品对比」作为内容建议方向
- 内容建议应该是「帮客户解决问题」的视角，不是「证明自己比竞品强」的视角
- 建议标题应该是客户会主动搜索的标题，不是品牌宣传标题
- 「是否易提及」和「是否易推荐」必须独立判断，不要两个布尔值长期雷同（在合理解释前提下）
- 结合用户选定的目标 AI 平台判断品牌可见度与内容缺口；不得将「可见度增强目标」平台伪装为已完成真实检测`;

        const platformItemSchema = {
          type: "string",
          enum: ["知乎", "小红书", "百家号", "头条号", "微信公众号", "官网"],
        } as const;

        const rows = [];
        for (const q of diagnosisQuestions) {
          const stub = `${GEO_SYNTHETIC_AI_RESPONSE_PREFIX}未采集真实 AI 平台原始回答；请仅依据企业档案与目标检索意图做 GEO 缺口推演。`;
          const inserted = await db.insert(aiResponses).values({
            projectId: input.projectId,
            questionId: q.id,
            questionText: q.questionText,
            aiPlatform: "其他",
            rawAnswer: stub,
            checkedAt: new Date(),
          }).$returningId();
          const responseId = inserted[0]?.id ?? 0;
          if (!responseId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "写入诊断占位记录失败" });

          const { intent: questionIntent, disadvantaged: questionDisadvantaged } = parseQuestionGeoMeta(q.targetKeyword);
          const disadvantagedLabel = questionDisadvantaged ? "是" : "否";
          const intentLabel = questionIntent || "（未标注，请结合问题文本推断）";

          let llm;
          try {
            llm = await invokeLLM({
              max_tokens: 4096,
              timeout_ms: 120000,
              messages: [
                { role: "system", content: diagnosisSystemPrompt },
                {
                  role: "user",
                  content: [
                    "企业信息：",
                    enterpriseInfo,
                    "",
                    formatTargetAiPlatformsForPrompt(getDefaultTargetAiPlatforms()),
                    "",
                    `客户问题：${q.questionText}`,
                    `用户意图：${intentLabel}`,
                    `该问题是否为内容覆盖薄弱场景：${disadvantagedLabel}`,
                    "",
                    "若「内容覆盖薄弱场景」为「是」，easyToRecommend 原则上应为 false，除非有明确公开证据表明内容仍易被引用来回答该问题。",
                    "",
                    "请分析并输出以下字段（以 JSON 对象给出，字段名与 Schema 一致）：",
                    "- easyToMention：该企业是否容易在AI回答中被提及（布尔）",
                    "- easyToRecommend：该企业内容是否容易被AI引用来回答这个问题（布尔）",
                    "- contentGap：当前内容缺口，具体指出缺什么类型的内容（2-3句话）",
                    "- suggestedTitle：建议创作的内容标题（客户会主动搜索的标题，不含品牌名，不是竞品对比）",
                    "- coreTheses：支撑该标题的2条核心论点，从客户收益角度表达（字符串数组，长度2）",
                    "- recommendedPlatforms：推荐发布平台（从知乎/小红书/百家号/头条号/微信公众号/官网中选1-2个）",
                    "- strongestCompetitor：在这个问题场景下，哪类内容/方案最容易被AI优先引用（不一定是具体品牌；一句话）",
                  ].join("\n"),
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "geo_analysis_result_v12",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      easyToMention: { type: "boolean" },
                      easyToRecommend: { type: "boolean" },
                      contentGap: { type: "string" },
                      suggestedTitle: { type: "string" },
                      coreTheses: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
                      recommendedPlatforms: { type: "array", minItems: 1, maxItems: 2, items: platformItemSchema },
                      strongestCompetitor: { type: "string" },
                    },
                    required: [
                      "easyToMention",
                      "easyToRecommend",
                      "contentGap",
                      "suggestedTitle",
                      "coreTheses",
                      "recommendedPlatforms",
                      "strongestCompetitor",
                    ],
                    additionalProperties: false,
                  },
                },
              },
            });
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err);
            const classified = classifyGeoDiagnosisLlmError(raw);
            console.error("[geo.analysis.run]", classified.code, classified.serverLog);
            logDuration(false, classified.code);
            throw new TRPCError({
              code: classified.code === "LLM_NOT_CONFIGURED" ? "PRECONDITION_FAILED" : "INTERNAL_SERVER_ERROR",
              message: classified.userMessage,
            });
          }
          const parsed = parseLLMJson<{
            easyToMention: boolean;
            easyToRecommend: boolean;
            contentGap: string;
            suggestedTitle: string;
            coreTheses: string[];
            recommendedPlatforms: Array<"知乎" | "小红书" | "百家号" | "头条号" | "微信公众号" | "官网">;
            strongestCompetitor: string;
          }>(llm.choices[0]?.message.content);

          const recommendedActionType = "补案例证据" as const;
          const strong = typeof parsed.strongestCompetitor === "string" ? parsed.strongestCompetitor.trim() : "";
          const suggestedTitle = typeof parsed.suggestedTitle === "string" ? parsed.suggestedTitle.trim() : "";
          const theses = Array.isArray(parsed.coreTheses) ? parsed.coreTheses.map(x => String(x).trim()).filter(Boolean) : [];
          const t1 = theses[0] ?? "";
          const t2 = theses[1] ?? "";
          const platforms = Array.isArray(parsed.recommendedPlatforms) ? parsed.recommendedPlatforms.map(String) : [];
          const optSuggestionLines = [
            `建议标题：《${suggestedTitle || "（待补充标题）"}》`,
            `核心论点：①${t1 || "—"} ②${t2 || "—"}`,
            `推荐发布平台：${platforms.join("、") || "官网"}`,
          ];
          const optimizationSuggestion = optSuggestionLines.join("\n");
          const mentionsCompetitors = strong.length > 0;
          const recommendedCompetitors = strong ? [strong.slice(0, 120)] : [];
          const recommendationReason = parsed.easyToMention
            ? "推演：在典型中文 AI 对话语境下，企业有一定概率被用户问题顺带提及。"
            : "推演：在公开语料与品牌认知有限时，模型较难主动关联到本企业。";
          const notRecommendedReason = parsed.easyToRecommend
            ? ""
            : "推演：在缺乏可引用结构化内容或竞品声量更高时，模型更倾向不推荐或仅泛化回答。";
          const semanticSummary = [suggestedTitle, t1, t2].filter(Boolean).join("；");
          const evidenceExcerpt = [t1, t2].filter(Boolean).join("；");
          const competitorGap = strong;
          const decisionBasis = `${parsed.contentGap ?? ""}`.slice(0, 500);

          const diagnosisMeta = deriveQuestionDiagnosisMeta({
            questionText: q.questionText,
            recommendedActionType,
            contentGap: parsed.contentGap,
            optimizationSuggestion,
          });
          const userIntentDisplay = questionIntent || diagnosisMeta.userIntent;

          const legacyParsed = {
            mentionsEnterprise: parsed.easyToMention,
            recommendsEnterprise: parsed.easyToRecommend,
            mentionsCompetitors,
            recommendedCompetitors,
            enterpriseWins: parsed.easyToRecommend,
            recommendationReason,
            notRecommendedReason,
            hasMisconception: false,
            contentGap: parsed.contentGap,
            optimizationSuggestion,
            semanticSummary,
            evidenceExcerpt,
            competitorGap,
            decisionBasis,
            recommendedActionType,
          };

          rows.push({
            projectId: input.projectId,
            aiResponseId: responseId,
            mentionsEnterprise: parsed.easyToMention ? 1 : 0,
            recommendsEnterprise: parsed.easyToRecommend ? 1 : 0,
            mentionsCompetitors: mentionsCompetitors ? 1 : 0,
            recommendedCompetitors,
            enterpriseWins: parsed.easyToRecommend ? 1 : 0,
            recommendationReason,
            notRecommendedReason,
            hasMisconception: 0,
            contentGap: parsed.contentGap,
            optimizationSuggestion,
            rawJson: {
              ...legacyParsed,
              syntheticDiagnosis: true,
              questionType: diagnosisMeta.questionType,
              issueType: diagnosisMeta.questionType,
              userIntent: userIntentDisplay,
              questionIntent,
              questionDisadvantaged: questionDisadvantaged,
              questionText: q.questionText,
              aiPlatform: "其他",
              suggestedTitle,
              coreTheses: [t1, t2].filter(Boolean),
              recommendedPlatforms: platforms,
              strongestCompetitor: strong,
              questionDiagnosis: {
                questionText: q.questionText,
                aiPlatform: "其他",
                questionType: diagnosisMeta.questionType,
                issueType: diagnosisMeta.questionType,
                userIntent: userIntentDisplay,
                semanticSummary,
                evidenceExcerpt: "",
                competitorGap,
                decisionBasis,
                recommendedActionType,
                suggestedTitle,
                coreTheses: [t1, t2].filter(Boolean),
                recommendedPlatforms: platforms,
                strongestCompetitor: strong,
              },
            },
            manualOverrideJson: null,
            manuallyReviewed: 0,
            reviewedAt: null,
            reviewNote: null,
          });
        }

      await db.insert(analysisResults).values(rows);
      await updateProjectStatus(input.projectId, "analysis_done");
      logDuration(true, null);
      return { success: true, count: rows.length } as const;
    }),
    saveManualReview: protectedProcedure.input(analysisManualReviewInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireAnalysisAccess(ctx, input.id);
      const manualOverrideJson = {
        mentionsEnterprise: input.mentionsEnterprise,
        recommendsEnterprise: input.recommendsEnterprise,
        mentionsCompetitors: input.mentionsCompetitors,
        recommendedCompetitors: input.recommendedCompetitors.map(item => item.trim()).filter(Boolean),
        enterpriseWins: input.enterpriseWins,
        recommendationReason: input.recommendationReason.trim(),
        notRecommendedReason: input.notRecommendedReason.trim(),
        hasMisconception: input.hasMisconception,
        contentGap: input.contentGap.trim(),
        optimizationSuggestion: input.optimizationSuggestion.trim(),
        confidence: input.confidence ?? null,
      };
      await db.update(analysisResults).set({
        manualOverrideJson,
        manuallyReviewed: 1,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      }).where(eq(analysisResults.id, input.id));
      return { success: true } as const;
    }),
    undoManualReview: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireAnalysisAccess(ctx, input.id);
      await db.update(analysisResults).set({
        manualOverrideJson: null,
        manuallyReviewed: 0,
        reviewedAt: null,
        reviewNote: null,
      }).where(eq(analysisResults.id, input.id));
      return { success: true } as const;
    }),
  }),

  scores: router({
    latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return null;
      await requireProjectAccess(ctx, input.projectId);
      // Fix: 问题4 — 同一项目多条历史评分时，按创建时间再按 id 取最新一条，避免偶发排序不稳定读到旧分。
      // 修复1：多取几行打日志，确认 where projectId 生效且首行即最新（若首行 projectId ≠ 请求 id 说明过滤异常）。
      const candidates = await db
        .select()
        .from(geoScores)
        .where(eq(geoScores.projectId, input.projectId))
        .orderBy(desc(geoScores.createdAt), desc(geoScores.id))
        .limit(3);
      const row = candidates[0] ?? null;
      const mismatched = candidates.filter(r => r.projectId !== input.projectId);
      if (mismatched.length > 0) {
        console.error("[geo.scores.latest] projectId 过滤异常：返回行与请求不一致", {
          requestedProjectId: input.projectId,
          rows: mismatched.map(r => ({ id: r.id, projectId: r.projectId })),
        });
      }
      console.info("[geo.scores.latest]", {
        requestedProjectId: input.projectId,
        returned: row
          ? {
              id: row.id,
              projectId: row.projectId,
              createdAt: row.createdAt,
              totalScore: row.totalScore,
            }
          : null,
        sameProjectTop3: candidates.map(r => ({
          id: r.id,
          projectId: r.projectId,
          createdAt: r.createdAt,
          totalScore: r.totalScore,
        })),
      });

      const t0Metrics = await resolveLatestT0AiTestRunMetrics(db, input.projectId);
      if (!t0Metrics) return row;

      const analyses = await db
        .select()
        .from(analysisResults)
        .where(eq(analysisResults.projectId, input.projectId));
      try {
        const effectiveScore = calculateGeoScore(resolveEffectiveAnalysisResults(analyses), t0Metrics);
        if (row) {
          return {
            ...row,
            aiVisibilityScore: effectiveScore.aiVisibilityScore,
            aiRecommendationScore: effectiveScore.aiRecommendationScore,
            competitorWinScore: effectiveScore.competitorWinScore,
            cognitionAccuracyScore: effectiveScore.cognitionAccuracyScore,
            contentAssetScore: effectiveScore.contentAssetScore,
            totalScore: effectiveScore.totalScore,
            visibilityLevel: effectiveScore.visibilityLevel,
            calculationDetail: effectiveScore.calculationDetail,
          };
        }
        return {
          id: 0,
          projectId: input.projectId,
          createdAt: t0Metrics.finishedAt ?? new Date(),
          updatedAt: t0Metrics.finishedAt ?? new Date(),
          ...effectiveScore,
        };
      } catch {
        return row;
      }
    }),
    t0Metrics: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        if (!input.projectId) return null;
        await requireProjectAccess(ctx, input.projectId);
        return resolveLatestT0AiTestRunMetrics(db, input.projectId);
      }),
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      return db
        .select({
          id: geoScores.id,
          totalScore: geoScores.totalScore,
          aiVisibilityScore: geoScores.aiVisibilityScore,
          aiRecommendationScore: geoScores.aiRecommendationScore,
          createdAt: geoScores.createdAt,
        })
        .from(geoScores)
        .where(eq(geoScores.projectId, input.projectId))
        .orderBy(asc(geoScores.createdAt));
    }),
    calculate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      const t0Metrics = await resolveLatestT0AiTestRunMetrics(db, input.projectId);
      if (analyses.length === 0 && !t0Metrics) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析或 T0 基线测试，再计算 GEO 评分" });
      }
      const score = calculateGeoScore(resolveEffectiveAnalysisResults(analyses), t0Metrics);
      await db.delete(geoScores).where(eq(geoScores.projectId, input.projectId));
      await db.insert(geoScores).values({ projectId: input.projectId, ...score });
      await updateProjectStatus(input.projectId, "score_done");
      return { success: true, score } as const;
    }),
  }),

  tasks: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      return db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId)).orderBy(desc(optimizationTasks.createdAt));
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const project = await requireProjectAccess(ctx, input.projectId);
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE });
      }
      const generated = await generateOptimizationTasks(project, resolveEffectiveAnalysisResults(analyses));
      await db.delete(geoArticleTopics).where(eq(geoArticleTopics.projectId, input.projectId));
      await db.delete(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
      await db.insert(optimizationTasks).values(generated.map(task => ({ ...task, projectId: input.projectId })));
      await updateProjectStatus(input.projectId, "tasks_ready");
      return { success: true, count: generated.length } as const;
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      status: z.enum(taskStatuses),
      publishedUrl: z.string().optional().nullable(),
      needRetest: z.boolean().optional().default(false),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(optimizationTasks).set({
        status: input.status,
        publishedUrl: input.status === "done" ? input.publishedUrl ?? null : null,
        needRetest: input.status === "done" && input.needRetest ? 1 : 0,
        completedAt: input.status === "done" ? new Date() : null,
      }).where(eq(optimizationTasks.id, input.id));
      return { success: true } as const;
    }),
  }),

  templates: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      return db.select().from(contentTemplates).where(eq(contentTemplates.projectId, input.projectId)).orderBy(desc(contentTemplates.createdAt));
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const project = await requireProjectAccess(ctx, input.projectId);
      const tasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
      if (tasks.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先生成优化任务，再生成内容模板" });
      }
      const generated = generateContentTemplates(project, tasks.map(task => ({ id: task.id, taskType: task.taskType, taskName: task.taskName, generationReason: task.generationReason, executionSuggestion: task.executionSuggestion })));
      await db.delete(contentTemplates).where(eq(contentTemplates.projectId, input.projectId));
      await db.insert(contentTemplates).values(generated.map(item => ({ ...item, projectId: input.projectId, templateType: item.templateType as typeof templateTypes[number] })));
      await updateProjectStatus(input.projectId, "report_ready");
      return { success: true, count: generated.length } as const;
    }),
  }),

  reports: router({
    latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return null;
      await requireProjectAccess(ctx, input.projectId);
      const result = await db.select().from(reports).where(eq(reports.projectId, input.projectId)).orderBy(desc(reports.createdAt)).limit(1);
      return result[0] ?? null;
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const project = await requireProjectAccess(ctx, input.projectId);
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      const effectiveAnalyses = resolveEffectiveAnalysisResults(analyses);
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析，再生成诊断报告" });
      }
      const rawScore = calculateGeoScore(analyses);
      const latestScore = await db.select().from(geoScores).where(eq(geoScores.projectId, input.projectId)).orderBy(desc(geoScores.createdAt)).limit(1);
      if (!latestScore[0]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先计算 GEO 评分，再生成诊断报告" });
      }
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId));
      const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, input.projectId));
      const questionStats = {
        totalQuestions: projectQuestions.length,
        aiGeneratedQuestions: projectQuestions.filter(question => question.source === "ai_generated").length,
        specifiedQuestions: projectQuestions.filter(question => question.source === "manual" || question.source === "csv").length,
      };
      const analysesWithQuestions = attachQuestionTextToAnalyses(effectiveAnalyses, responses, projectQuestions);
      const report = generateReportMarkdown(project, {
        aiVisibilityScore: latestScore[0].aiVisibilityScore,
        aiRecommendationScore: latestScore[0].aiRecommendationScore,
        competitorWinScore: latestScore[0].competitorWinScore,
        cognitionAccuracyScore: latestScore[0].cognitionAccuracyScore,
        contentAssetScore: latestScore[0].contentAssetScore,
        totalScore: latestScore[0].totalScore,
        visibilityLevel: latestScore[0].visibilityLevel,
      }, analysesWithQuestions, questionStats, rawScore);
      await db.delete(reports).where(eq(reports.projectId, input.projectId));
      await db.insert(reports).values({ projectId: input.projectId, geoScoreId: latestScore[0].id, ...report });
      await updateProjectStatus(input.projectId, "report_ready");
      return { success: true, report } as const;
    }),
    createShareLink: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const shareToken = await getOrCreateShareTokenForProject(db, input.projectId);
        const sharePath = buildDeliveryReportPublicPath(shareToken);
        return { sharePath, shareToken } as const;
      }),
    disableShareLink: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const result = await disableEnabledShareTokensForProject(db, input.projectId);
        return { success: true, disabled: result.disabled, count: result.count } as const;
      }),
    regenerateShareLink: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const shareToken = await regenerateShareLinkForProject(db, input.projectId);
        const sharePath = buildDeliveryReportPublicPath(shareToken);
        return { success: true, sharePath } as const;
      }),
    publicShare: publicProcedure
      .input(z.object({ token: z.string().min(16).max(64) }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const projectId = await resolveShareTokenProjectId(db, input.token);
        return buildDeliveryReportPublicSharePayload(db, projectId);
      }),
    publicEvidence: publicProcedure
      .input(
        z.object({
          token: z.string().min(16).max(64),
          recordId: z.number().int().positive(),
          resultIndex: z.number().int().min(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        return buildDeliveryReportPublicEvidencePayload(db, input.token, input.recordId, input.resultIndex);
      }),
  }),

  contentPlans: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      return db.select().from(contentPlans).where(eq(contentPlans.projectId, input.projectId)).orderBy(desc(contentPlans.createdAt));
    }),
    latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) {
        return {
          plan: null,
          items: [],
          planName: null,
          startDate: null,
          targetPlatforms: [] as string[],
          contentTypes: [] as string[],
          weeklyArticleCount: null,
          status: null,
          linkedOptimizationTaskIds: [] as number[],
        } as const;
      }
      await requireProjectAccess(ctx, input.projectId);
      const plans = await db.select().from(contentPlans).where(eq(contentPlans.projectId, input.projectId)).orderBy(desc(contentPlans.createdAt)).limit(1);
      const plan = plans[0] ?? null;
      if (!plan) {
        return {
          plan: null,
          items: [],
          planName: null,
          startDate: null,
          targetPlatforms: [] as string[],
          contentTypes: [] as string[],
          weeklyArticleCount: null,
          status: null,
          linkedOptimizationTaskIds: [] as number[],
        } as const;
      }
      const items = await db.select().from(contentPlanItems).where(eq(contentPlanItems.planId, plan.id)).orderBy(desc(contentPlanItems.createdAt));
      // Fix: 问题5 — 为交付页提供与前端约定一致的扁平字段（不改表结构）。
      return {
        plan,
        items,
        planName: plan.planName,
        startDate: plan.weekStartDate,
        targetPlatforms: plan.targetPlatforms,
        contentTypes: plan.contentTypes,
        weeklyArticleCount: plan.weeklyArticleCount,
        status: plan.status,
        linkedOptimizationTaskIds: plan.linkedOptimizationTaskIds,
      } as const;
    }),
    upsert: protectedProcedure.input(contentPlanInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);

      const selectedTasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
      const validTaskIds = new Set(selectedTasks.map(task => task.id));
      const linkedOptimizationTaskIds = input.linkedOptimizationTaskIds.filter(taskId => validTaskIds.has(taskId));
      if (linkedOptimizationTaskIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请至少绑定一个属于当前项目的优化任务（已自动忽略无效或跨项目的任务 ID）。",
        });
      }

      const values = {
        projectId: input.projectId,
        planName: input.planName.trim(),
        weekStartDate: input.weekStartDate,
        weeklyArticleCount: input.weeklyArticleCount,
        targetPlatforms: input.targetPlatforms,
        contentTypes: input.contentTypes,
        linkedOptimizationTaskIds,
        status: input.status,
      };

      if (input.id) {
        const existing = await db.select().from(contentPlans).where(eq(contentPlans.id, input.id)).limit(1);
        if (!existing[0] || existing[0].projectId !== input.projectId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "内容生产计划不存在或不属于当前项目" });
        }
        await db.update(contentPlans).set(values).where(eq(contentPlans.id, input.id));
        return { success: true, planId: input.id } as const;
      }

      const inserted = await db.insert(contentPlans).values(values).$returningId();
      return { success: true, planId: inserted[0]?.id ?? 0 } as const;
    }),
    addItem: protectedProcedure.input(contentPlanItemInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const planRows = await db.select().from(contentPlans).where(eq(contentPlans.id, input.planId)).limit(1);
      const plan = planRows[0];
      if (!plan || plan.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "内容生产计划不存在或不属于当前项目" });
      }
      if (input.topicId) {
        const topicRows = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.id, input.topicId)).limit(1);
        if (!topicRows[0] || topicRows[0].projectId !== input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "内容选题不属于当前项目" });
      }
      if (input.articleId) {
        const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
        if (!articleRows[0] || articleRows[0].projectId !== input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "文章不属于当前项目" });
      }
      const inserted = await db.insert(contentPlanItems).values({
        planId: input.planId,
        topicId: input.topicId ?? null,
        articleId: input.articleId ?? null,
        targetPlatform: input.targetPlatform,
        contentType: input.contentType,
        status: input.status,
        differentiationAngle: input.differentiationAngle ?? null,
        duplicateRisk: input.duplicateRisk ?? null,
      }).$returningId();
      return { success: true, itemId: inserted[0]?.id ?? 0 } as const;
    }),
  }),

  articles: router({
    topics: router({
      list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
        const db = await requireDb();
        if (!input.projectId) return [];
        await requireProjectAccess(ctx, input.projectId);
        return db.select().from(geoArticleTopics).where(eq(geoArticleTopics.projectId, input.projectId)).orderBy(desc(geoArticleTopics.createdAt));
      }),
      generate: protectedProcedure.input(z.object({
        projectId: z.number().int().positive(),
        generationCount: z.number().int().min(1).max(50).optional(),
      })).mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const project = await requireProjectAccess(ctx, input.projectId);
        const tasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
        if (tasks.length === 0) {
          const analyses = await db
            .select({ id: analysisResults.id })
            .from(analysisResults)
            .where(eq(analysisResults.projectId, input.projectId))
            .limit(1);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              analyses.length === 0
                ? PLATFORM_CONTENT_NO_AI_DIAGNOSIS_MESSAGE
                : PLATFORM_CONTENT_NO_OPTIMIZATION_TASKS_MESSAGE,
          });
        }
        const generationCount = input.generationCount ?? 7;
        const generated = generateGeoArticleTopics({
          project,
          targetCount: generationCount,
          tasks: tasks.map(t => ({
            id: t.id,
            taskType: t.taskType,
            taskName: t.taskName,
            priority: t.priority as "P0" | "P1" | "P2",
            generationReason: t.generationReason,
            executionSuggestion: t.executionSuggestion,
            expectedImpact: t.expectedImpact,
            status: t.status,
          })),
        });
        await db.delete(geoArticleTopics).where(eq(geoArticleTopics.projectId, input.projectId));
        await db.insert(geoArticleTopics).values(generated.map(topic => ({ ...topic, articleType: topic.articleType, status: topic.status })));
        return { success: true, count: generated.length, topics: generated } as const;
      }),
    }),
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      // Fix: 问题3 — 排除旧格式「如何回答…」长标题占位文章（较按 topics 时间过滤更直观、可预期）。
      const rows = await db
        .select()
        .from(geoArticles)
        .where(and(eq(geoArticles.projectId, input.projectId), not(like(geoArticles.title, "%如何回答%"))))
        .orderBy(desc(geoArticles.createdAt));
      // 修复2：列表仅 from geoArticles、无 join；若仍出现重复行则按 id 去重（防御性，避免上游或映射层重复）。
      const uniqueRows = Array.from(new Map(rows.map(r => [r.id, r])).values());
      // Fix: 问题2 — 补充目标平台/内容类型：库表无独立列，从绑定优化任务的 executionSuggestion 卡片解析；否则回退 articleType。
      const taskIds = Array.from(new Set(uniqueRows.map(row => row.optimizationTaskId).filter((id): id is number => typeof id === "number" && id > 0)));
      const tasks = taskIds.length
        ? await db
            .select()
            .from(optimizationTasks)
            .where(and(eq(optimizationTasks.projectId, input.projectId), inArray(optimizationTasks.id, taskIds)))
        : [];
      const taskById = new Map(tasks.map(task => [task.id, task] as const));
      const [reviewFlags, rewriteFlags] = await Promise.all([
        getArticleReviewFlagsByProject(db, input.projectId),
        getArticleRewriteFlagsByProject(db, input.projectId),
      ]);
      return uniqueRows.map(article => {
        const task = article.optimizationTaskId ? taskById.get(article.optimizationTaskId) : undefined;
        const card = task ? parseOptimizationTaskCard(task.executionSuggestion) : null;
        const taskRecommendedPlatform = card?.recommendedPlatform?.length
          ? card.recommendedPlatform.join("、")
          : "";
        const publishFields = resolveArticleListPublishFields({
          generationBasis: article.generationBasis ?? null,
          taskRecommendedPlatform: taskRecommendedPlatform || null,
          articleType: article.articleType,
        });
        const contentType = (card?.contentType && card.contentType.trim()) || article.articleType;
        const lifecycle = resolveArticleLifecycleView(article);
        return {
          ...article,
          targetPlatform: publishFields.targetPlatform,
          publishPlatform: publishFields.publishPlatform,
          contentType,
          lifecycle,
          postPublish: {
            pendingReview: reviewFlags.pendingReview.has(article.id),
            needsRewrite: rewriteFlags.needsRewrite.has(article.id),
          },
        };
      });
    }),
    lifecycleTimeline: protectedProcedure
      .input(z.object({ articleId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const articleRow = await db
          .select({ projectId: geoArticles.projectId })
          .from(geoArticles)
          .where(eq(geoArticles.id, input.articleId))
          .limit(1);
        if (!articleRow[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
        }
        await requireProjectAccess(ctx, articleRow[0].projectId);
        const timeline = await getArticleLifecycleTimeline(db, input.articleId);
        if (!timeline) {
          throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
        }
        const lifecycle = resolveArticleLifecycleView({
          lifecycleStatus: timeline.lifecycleStatus,
          lifecycleEvents: timeline.events,
          status: timeline.legacyStatus,
          publicPath: timeline.publicPath,
        });
        return { ...timeline, lifecycle };
      }),
    latestQualityScores: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.projectId, input.projectId)).orderBy(desc(geoArticleQualityScores.createdAt));
      // Fix: 问题1 — isPass 与「仅合规类阻断」一致，避免高分仍显示未通过。
      const hasComplianceBlock = (reasons: string[]) =>
        reasons.some(reason => /禁用词|禁止承诺|合规/.test(reason));
      return rows.map(row => {
        const blockReasons = Array.isArray(row.blockReasons) ? row.blockReasons : [];
        const isPass = row.totalScore >= 60 && !hasComplianceBlock(blockReasons);
        return { ...row, isPass };
      });
    }),
    publishRecords: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      return db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, input.projectId)).orderBy(desc(geoPublishRecords.publishedAt));
    }),
    createManualPublishRecord: protectedProcedure.input(manualPublishRecordInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await requireProjectAccess(ctx, input.projectId);
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到属于当前项目的内容" });
      }
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      if (!latestScore || latestScore.blocked || latestScore.totalScore < GEO_ARTICLE_MIN_PASS_SCORE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `只有已通过 GEO 质检且质量分不低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 的内容才能记录人工发布结果` });
      }
      const publishedAt = new Date(input.publishedAt);
      if (Number.isNaN(publishedAt.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "发布时间格式不正确" });
      }
      const inserted = await db.insert(geoPublishRecords).values({
        projectId: input.projectId,
        articleId: article.id,
        optimizationTaskId: article.optimizationTaskId,
        publishChannel: input.publishPlatform,
        publishTitle: input.publishTitle,
        publishUrl: input.publishUrl.trim(),
        publishStatus: input.publishStatus,
        qualityScore: latestScore.totalScore,
        needRetest: input.publishStatus === "published" || input.publishStatus === "link_backfilled" ? 1 : 0,
        notes: [
          "V1.0 人工确认发布记录：本系统只记录人工发布结果和公开链接，不调用外部平台 API，不创建收录监测记录。",
          input.notes.trim(),
        ].filter(Boolean).join("\n"),
        publishedAt,
      }).$returningId();
      return { success: true, id: inserted[0]?.id ?? 0 } as const;
    }),
    updateManualPublishRecord: protectedProcedure.input(manualPublishRecordInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const recordRows = await db.select().from(geoPublishRecords).where(eq(geoPublishRecords.id, input.id)).limit(1);
      const record = recordRows[0];
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到发布记录" });
      }
      await requireProjectAccess(ctx, record.projectId);
      if (record.projectId !== input.projectId || record.articleId !== input.articleId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "发布记录与请求项目/内容不一致" });
      }
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到属于当前项目的内容" });
      }
      const publishedAt = new Date(input.publishedAt);
      if (Number.isNaN(publishedAt.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "发布时间格式不正确" });
      }
      await db.update(geoPublishRecords).set({
        publishChannel: input.publishPlatform,
        publishTitle: input.publishTitle,
        publishUrl: input.publishUrl.trim(),
        publishStatus: input.publishStatus,
        needRetest: input.publishStatus === "published" || input.publishStatus === "link_backfilled" ? 1 : 0,
        notes: [
          "V1.0 人工确认发布记录：本系统只记录人工发布结果和公开链接，不调用外部平台 API，不创建收录监测记录。",
          input.notes.trim(),
        ].filter(Boolean).join("\n"),
        publishedAt,
      }).where(eq(geoPublishRecords.id, input.id));
      return { success: true, id: input.id } as const;
    }),
    inclusionMonitoringRecords: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      await requireProjectAccess(ctx, input.projectId);
      const rows = await db
        .select()
        .from(geoInclusionMonitoringRecords)
        .where(eq(geoInclusionMonitoringRecords.projectId, input.projectId))
        .orderBy(desc(geoInclusionMonitoringRecords.createdAt));
      return rows.map(mapInclusionMonitoringRecordForApi);
    }),
    generate: protectedProcedure
      .input(
        z
          .object({
            topicId: z.number().int().positive(),
            targetPublishPlatform: z.enum(PUBLISH_PLATFORM_IDS).optional(),
            contentStrategyType: z.enum(CONTENT_ASSET_TYPES).optional(),
            publishIdentity: z.enum(PUBLISH_IDENTITIES).optional(),
            recommendedAccountGroup: z.enum(ACCOUNT_GROUP_TYPES).optional(),
            targetQuestion: z.string().trim().optional(),
            geoEnhancementGoal: z.enum(GEO_ENHANCEMENT_GOAL_OPTIONS).optional(),
            targetAiPlatforms: z.array(z.string().min(1)).optional(),
            contentTaskId: z.number().int().positive().optional(),
            diagnosisFinding: z.string().trim().max(4000).optional(),
            geoGap: z.string().trim().max(4000).optional(),
          })
          .superRefine((val, ctx) => {
            const hasPlatform = Boolean(val.targetPublishPlatform);
            if (!hasPlatform) return;
            if (!val.contentStrategyType) {
              ctx.addIssue({ code: "custom", message: "请选择内容类型", path: ["contentStrategyType"] });
            }
            if (!val.publishIdentity) {
              ctx.addIssue({ code: "custom", message: "请选择账号身份", path: ["publishIdentity"] });
            }
            if (!val.targetQuestion?.trim()) {
              ctx.addIssue({ code: "custom", message: "请填写目标问题", path: ["targetQuestion"] });
            }
            if (!val.geoEnhancementGoal) {
              ctx.addIssue({ code: "custom", message: "请选择 GEO 增强目标", path: ["geoEnhancementGoal"] });
            }
            if (!val.targetAiPlatforms?.length) {
              ctx.addIssue({ code: "custom", message: "请选择目标 AI 平台", path: ["targetAiPlatforms"] });
            }
          }),
      )
      .mutation(async ({ ctx, input }) => {
      const startedAtMs = Date.now();
      let stepStartMs = startedAtMs;
      const stepTimings: GeoArticlesGenerateStepTimings = {};
      const durationBase = () => buildGeoTaskDurationLogBase(startedAtMs);
      const logDuration = (projectId: number, success: boolean, errorCode: string | null) => {
        logGeoArticlesGenerateDuration({
          ...durationBase(),
          projectId,
          platform: input.targetPublishPlatform ?? null,
          success,
          errorCode,
          stepTimings,
        });
      };
      const db = await requireDb();
      const topicRows = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.id, input.topicId)).limit(1);
      const topic = topicRows[0];
      if (!topic) throw new TRPCError({ code: "NOT_FOUND", message: "文章选题不存在" });
      const projectRow = await requireProjectAccess(ctx, topic.projectId);
      const taskRows = topic.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, topic.optimizationTaskId)).limit(1) : [];
      const task = taskRows[0];
      if (!task || task.projectId !== topic.projectId) {
        logDuration(topic.projectId, false, "TOPIC_UNBOUND");
        throw new TRPCError({ code: "BAD_REQUEST", message: PLATFORM_CONTENT_TOPIC_UNBOUND_MESSAGE });
      }
      const [projectQuestions, analyses, responses, assetLibrary] = await Promise.all([
        db.select().from(questions).where(eq(questions.projectId, topic.projectId)),
        db.select().from(analysisResults).where(eq(analysisResults.projectId, topic.projectId)),
        db.select().from(aiResponses).where(eq(aiResponses.projectId, topic.projectId)),
        getAssetLibraryContext(topic.projectId),
      ]);
      stepTimings.dbPrefetchMs = Date.now() - stepStartMs;
      stepStartMs = Date.now();
      const sourceQuestionIds = Array.isArray(topic.sourceQuestionIds) ? topic.sourceQuestionIds : [];
      const sourceAnalysisIds = Array.isArray(topic.sourceAnalysisIds) ? topic.sourceAnalysisIds : [];
      const questionScope = projectQuestions.filter(question => sourceQuestionIds.includes(question.id));
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const analysisScope = analysesWithQuestions.filter(analysis => sourceAnalysisIds.includes(analysis.id));
      const project = mergeProjectWithEnterpriseProfile(projectRow, assetLibrary.profile ?? null);
      if (process.env.GEO_ARTICLE_BODY !== "test-template") {
        const llmEnv = diagnoseLlmProviderEnv();
        if (!llmEnv.configured) {
          console.error(
            "[geo.articles.generate]",
            formatMissingLlmEnvServerLog(llmEnv.missingEnvVars),
            {
              topicId: input.topicId,
              projectId: topic.projectId,
              llmProvider: llmEnv.provider,
              llmModel: llmEnv.model,
            },
          );
          logDuration(topic.projectId, false, "not_configured");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: PLATFORM_CONTENT_AI_NOT_CONFIGURED_MESSAGE,
          });
        }
      }
      let draft;
      try {
        const platformStrategy =
          input.targetPublishPlatform &&
          input.contentStrategyType &&
          input.publishIdentity &&
          input.targetQuestion?.trim() &&
          input.geoEnhancementGoal &&
          input.targetAiPlatforms?.length
            ? {
                targetPublishPlatform: input.targetPublishPlatform,
                contentStrategyType: input.contentStrategyType,
                publishIdentity: input.publishIdentity,
                recommendedAccountGroup: input.recommendedAccountGroup ?? "official_group",
                targetQuestion: input.targetQuestion.trim(),
                geoEnhancementGoal: input.geoEnhancementGoal,
                targetAiPlatforms: normalizeTargetAiPlatforms(input.targetAiPlatforms),
              }
            : undefined;
        assertPlatformContentStrategyParams(platformStrategy);
        assertEnterpriseProfileForPlatformGeneration(projectRow, assetLibrary, platformStrategy);
        let geoContentTaskTrace: GeoContentTaskGenerationTrace | undefined;
        if (platformStrategy) {
          const hasTrace =
            input.contentTaskId != null ||
            Boolean(input.diagnosisFinding?.trim()) ||
            Boolean(input.geoGap?.trim());
          if (hasTrace) {
            geoContentTaskTrace = {
              contentTaskId: input.contentTaskId ?? task.id,
              diagnosisFinding: input.diagnosisFinding?.trim(),
              geoGap: input.geoGap?.trim(),
              platformRuleSummary: formatPlatformRuleSummaryForGeneration(
                platformStrategy.targetPublishPlatform,
              ),
            };
          }
        }
        draft = await generateGeoArticleDraft({
          project,
          topic: { ...topic, id: topic.id, articleType: topic.articleType as typeof articleTypes[number], optimizationTaskId: task.id },
          task,
          questions: questionScope.length > 0 ? questionScope : projectQuestions,
          analyses: analysisScope.length > 0 ? analysisScope : analysesWithQuestions,
          assetLibrary,
          platformStrategy,
          geoContentTaskTrace,
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : "GEO 文章生成失败";
        const llmEnv = diagnoseLlmProviderEnv();
        const llmClassified = classifyPlatformContentLlmError(raw, llmEnv);
        if (llmClassified.serverLog) {
          console.error(
            "[geo.articles.generate]",
            llmClassified.serverLog,
            {
              topicId: input.topicId,
              projectId: topic.projectId,
              targetPublishPlatform: input.targetPublishPlatform ?? null,
              contentStrategyType: input.contentStrategyType ?? null,
              targetQuestion: input.targetQuestion?.trim() ? "[set]" : null,
              errorCode: llmClassified.code,
              llmProvider: llmEnv.provider,
              llmModel: llmEnv.model,
              missingEnvVars: llmEnv.missingEnvVars,
            },
            raw ? { rawError: raw.slice(0, 2000) } : {},
          );
        }
        const message = toPlatformContentGenerationError(raw);
        const isClientError =
          /企业资料不足|企业资料还缺少|生成依据还缺少|内容正在优化中|生成的内容未通过 GEO 结构校验|请选择目标|不存在或无访问权限|文章选题不存在|未绑定优化任务|内容选题|请先完成 AI 实测诊断|还没有生成内容优化任务|当前平台暂无/.test(
            message,
          );
        logDuration(topic.projectId, false, llmClassified.code !== "not_llm_error" ? llmClassified.code : "GENERATION_FAILED");
        throw new TRPCError({ code: isClientError ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR", message });
      }
      stepTimings.draftGenerationMs = Date.now() - stepStartMs;
      stepStartMs = Date.now();
      const inserted = await db.insert(geoArticles).values(draft).$returningId();
      const articleId = inserted[0]?.id ?? 0;
      if (!articleId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "文章写入失败" });
      await appendArticleLifecycleEvent(db, articleId, {
        status: "generated",
        source: "article_generate",
        message: "内容资产生成完成",
      });
      await db.update(geoArticleTopics).set({ status: "已生成" }).where(eq(geoArticleTopics.id, topic.id));
      stepTimings.dbPersistMs = Date.now() - stepStartMs;
      stepStartMs = Date.now();
      const qcResult = await runGeoArticleQualityCheckFlow(db, articleId);
      stepTimings.qualityCheckMs = Date.now() - stepStartMs;
      stepTimings.autoRewriteCount = qcResult.autoRewriteCount;
      logDuration(topic.projectId, true, null);
      const qualityCheckPassed = qcResult.finalStatus === "质检通过";
      return {
        success: true,
        articleId,
        quality: qcResult.quality,
        autoRewriteCount: qcResult.autoRewriteCount,
        finalStatus: qcResult.finalStatus,
        qualityCheckPassed,
        userNotice: qualityCheckPassed ? null : PLATFORM_CONTENT_QC_MANUAL_REVIEW_MESSAGE,
      } as const;
    }),
    updateGeneratedArticle: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          articleId: z.number().int().positive(),
          title: z.string().trim().min(1, "标题不能为空").max(255),
          content: z.string().trim().min(1, "正文不能为空"),
          coverTemplate: z.enum(ARTICLE_COVER_TEMPLATE_IDS).optional(),
          coverBase64: z.string().max(2_800_000).optional().nullable(),
          coverImageUrl: z.string().max(2000).optional().nullable(),
          contentStrategyType: z.enum(CONTENT_ASSET_TYPES).optional().nullable(),
          publishIdentity: z.enum(PUBLISH_IDENTITIES).optional().nullable(),
          recommendedAccountGroup: z.enum(ACCOUNT_GROUP_TYPES).optional().nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const rows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
        const article = rows[0];
        if (!article || article.projectId !== input.projectId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "未找到属于当前项目的内容" });
        }
        const coverTemplate = input.coverTemplate
          ? normalizeArticleCoverTemplateId(input.coverTemplate)
          : normalizeArticleCoverTemplateId(article.coverTemplate);
        const nextCoverBase64 =
          input.coverBase64 === undefined
            ? article.coverBase64
            : input.coverBase64?.trim()
              ? input.coverBase64.trim()
              : null;
        const nextCoverImageUrl = input.coverImageUrl === undefined ? article.coverImageUrl : input.coverImageUrl;
        const prevCoverTemplate = normalizeArticleCoverTemplateId(article.coverTemplate);
        const contentChanged =
          input.title !== article.title ||
          input.content !== article.markdownContent ||
          coverTemplate !== prevCoverTemplate ||
          (input.coverBase64 !== undefined && nextCoverBase64 !== article.coverBase64) ||
          (input.coverImageUrl !== undefined && nextCoverImageUrl !== article.coverImageUrl);
        const strategyChanged =
          (input.contentStrategyType !== undefined &&
            input.contentStrategyType !== article.contentStrategyType) ||
          (input.publishIdentity !== undefined && input.publishIdentity !== article.publishIdentity) ||
          (input.recommendedAccountGroup !== undefined &&
            input.recommendedAccountGroup !== article.recommendedAccountGroup);
        const markQualityStale =
          (contentChanged || strategyChanged) && article.geoQualityReviewedAt != null;
        await db
          .update(geoArticles)
          .set({
            title: input.title,
            markdownContent: input.content,
            coverTemplate,
            coverBase64: nextCoverBase64,
            coverImageUrl: nextCoverImageUrl,
            ...(input.contentStrategyType !== undefined
              ? { contentStrategyType: input.contentStrategyType }
              : {}),
            ...(input.publishIdentity !== undefined ? { publishIdentity: input.publishIdentity } : {}),
            ...(input.recommendedAccountGroup !== undefined
              ? { recommendedAccountGroup: input.recommendedAccountGroup }
              : {}),
            ...(markQualityStale ? { geoQualityStale: 1 } : {}),
          })
          .where(eq(geoArticles.id, input.articleId));
        await appendArticleLifecycleEvent(db, input.articleId, {
          status: "confirmed",
          source: "article_save",
          message: "用户已保存编辑内容",
        });
        const updated = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
        return { success: true, article: updated[0] ?? null } as const;
      }),
    contentQualityReview: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          articleId: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const { result, modelName, reviewedAt } = await runContentQualityReview(db, input);
        const updated = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
        return {
          success: true,
          result,
          modelName,
          reviewedAt: reviewedAt.toISOString(),
          article: updated[0] ?? null,
        } as const;
      }),
    qualityCheck: protectedProcedure.input(z.object({ articleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { article } = await requireArticleAccess(ctx, input.articleId);
      if (!(article.status === "已生成" || article.status === "待质检" || article.status === "需人工审核" || article.status === "质检未通过")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前状态的文章不能重新执行质量评分" });
      }
      const qcResult = await runGeoArticleQualityCheckFlow(db, input.articleId);
      return {
        success: qcResult.success,
        quality: qcResult.quality,
        autoRewriteCount: qcResult.autoRewriteCount,
        finalStatus: qcResult.finalStatus,
      } as const;
    }),
    optimizeVersion: protectedProcedure.input(z.object({ articleId: z.number().int().positive(), mode: z.enum(["增强版", "FAQ", "竞品对比", "AI 可引用片段", "移除无来源数据", "资料待补充表述", "案例采集模板"]), reason: z.string().optional().default("") })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { article, projectId } = await requireArticleAccess(ctx, input.articleId);
      const project = await requireProjectAccess(ctx, projectId);
      const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, article.projectId));
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, article.projectId));
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, article.projectId));
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const taskRows = article.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, article.optimizationTaskId)).limit(1) : [];
      const assetLibrary = await getAssetLibraryContext(article.projectId);
      const currentQuality = scoreGeoArticleQuality({
        article: article as unknown as Parameters<typeof scoreGeoArticleQuality>[0]["article"],
        project,
        questions: projectQuestions,
        analyses: analysesWithQuestions,
        task: taskRows[0] ?? null,
        assetLibrary,
      });
      const optimized = buildOptimizedArticleVersion({ article: article as unknown as Parameters<typeof buildOptimizedArticleVersion>[0]["article"], quality: currentQuality, mode: input.mode, reason: input.reason });
      const nextQuality = scoreGeoArticleQuality({
        article: { ...(article as unknown as Parameters<typeof scoreGeoArticleQuality>[0]["article"]), markdownContent: optimized.markdownContent },
        project,
        questions: projectQuestions,
        analyses: analysesWithQuestions,
        task: taskRows[0] ?? null,
        assetLibrary,
      });
      await db.update(geoArticles).set({
        markdownContent: optimized.markdownContent,
        optimizationVersions: optimized.versions,
        factTraceability: nextQuality.factTraceability,
        consistencyCheck: nextQuality.consistencyCheck,
        status: "待质检",
      }).where(eq(geoArticles.id, article.id));
      return { success: true, versionCount: optimized.versions.length, quality: nextQuality } as const;
    }),
    audit: protectedProcedure.input(z.object({ articleId: z.number().int().positive(), approved: z.boolean(), note: z.string().optional().default("") })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { article } = await requireArticleAccess(ctx, input.articleId);
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      const consistency = article.consistencyCheck as { publishAllowed?: boolean; score?: number; riskLevel?: string; blockReasons?: string[] } | null;
      const canAudit = canAuditArticle(article.status as ArticleStatus, latestScore ? { totalScore: latestScore.totalScore, blocked: Boolean(latestScore.blocked) } : null);
      if (!canAudit || consistency?.publishAllowed === false || (consistency?.score ?? 100) < GEO_ARTICLE_MIN_PASS_SCORE || consistency?.riskLevel === "高") throw new TRPCError({ code: "BAD_REQUEST", message: `未质检通过、低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分或一致性检查未通过的文章不能审核` });
      await db.update(geoArticles).set({ status: input.approved ? "审核通过" : "审核未通过" }).where(eq(geoArticles.id, article.id));
      if (!input.approved) {
        await appendArticleLifecycleEvent(db, article.id, {
          status: "needs_revision",
          source: "audit_reject",
          message: input.note?.trim() || "审核未通过，需修订",
        });
      }
      return { success: true } as const;
    }),
    publish: protectedProcedure.input(z.object({ articleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { article } = await requireArticleAccess(ctx, input.articleId);
      if (!canPublishArticle(article.status as ArticleStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "未审核通过的文章不能发布" });
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      if (!latestScore || latestScore.blocked || latestScore.totalScore < GEO_ARTICLE_MIN_PASS_SCORE) throw new TRPCError({ code: "BAD_REQUEST", message: `文章质量分低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 或存在禁止发布风险，不能发布` });
      const assetLibrary = await getAssetLibraryContext(article.projectId);
      const prePublishCheck = evaluateAssetLibraryPrePublishCheck({
        content: `${article.title}
${article.markdownContent}`,
        project: await requireProjectAccess(ctx, article.projectId),
        basis: article.generationBasis as Parameters<typeof evaluateAssetLibraryPrePublishCheck>[0]["basis"],
        assetLibrary,
      });
      if (prePublishCheck.blocked) throw new TRPCError({ code: "BAD_REQUEST", message: prePublishCheck.summary });
      const publicPath = `/geo/content/${article.projectId}/${article.id}`;
      await db.update(geoArticles).set({ status: "已发布", publicPath }).where(eq(geoArticles.id, article.id));
      if (article.optimizationTaskId) {
        await db.update(optimizationTasks).set({ status: "retest", publishedUrl: publicPath, needRetest: 1 }).where(eq(optimizationTasks.id, article.optimizationTaskId));
      }
      const insertResult = await db.insert(geoPublishRecords).values({
        projectId: article.projectId,
        articleId: article.id,
        optimizationTaskId: article.optimizationTaskId,
        publishChannel: "系统内置 GEO 内容页",
        publishUrl: publicPath,
        publishStatus: "已发布",
        qualityScore: latestScore.totalScore,
        needRetest: 1,
        notes: "人工审核通过后发布到系统内置 GEO 内容页，等待复测。",
      });
      const publishRecordId = Number((insertResult as { insertId?: number[] | number }).insertId ?? 0);
      const latestPublishRows = publishRecordId > 0 ? [] : await db.select().from(geoPublishRecords).where(eq(geoPublishRecords.articleId, article.id)).orderBy(desc(geoPublishRecords.createdAt)).limit(1);
      const resolvedPublishRecordId = publishRecordId > 0 ? publishRecordId : latestPublishRows[0]?.id;
      if (!resolvedPublishRecordId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "发布记录创建失败，无法进入收录监测" });
      await db.insert(geoInclusionMonitoringRecords).values(buildInitialInclusionMonitoringRecord({
        projectId: article.projectId,
        articleId: article.id,
        publishRecordId: resolvedPublishRecordId,
        publicUrl: publicPath,
        qualityScore: latestScore.totalScore,
      }));
      return { success: true, publicPath } as const;
    }),
    retestQueue: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const items = await listPostPublishRetestQueue(db, input.projectId);
        return { items, count: items.length } as const;
      }),
    rewritePool: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const items = await listRewritePool(db, input.projectId);
        return { items, count: items.length } as const;
      }),
    triggerReview: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), queueId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        try {
          return await triggerManualReview(db, input);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "触发复测失败",
          });
        }
      }),
    generateRewriteSuggestion: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), articleId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        try {
          const out = await generateNextContentSuggestion(db, input);
          return { success: true, ...out } as const;
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "生成建议失败",
          });
        }
      }),
    publicContent: publicProcedure.input(z.object({ projectId: z.number().int().positive(), articleId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId || !(article.status === "已发布" || article.status === "待复测")) {
        throw new TRPCError({ code: "NOT_FOUND", message: "内容不存在或尚未发布" });
      }
      const project = await getProjectRowConn(db, article.projectId);
      const profileRows = await db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, article.projectId)).limit(1);
      const prof = profileRows[0];
      const projectForPublic = prof
        ? {
            ...project,
            brandName: prof.brandName ?? undefined,
            targetCustomer: prof.targetCustomer ?? undefined,
            productDesc: prof.productDesc ?? undefined,
            productServiceIntro: prof.productServiceIntro ?? undefined,
            oneLiner: prof.oneLiner ?? undefined,
          }
        : project;
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      return { article, project: projectForPublic, qualityScore: scoreRows[0] ?? null } as const;
    }),
  }),
  inclusionMonitoring: router({
    backfill: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);

        const publishRecords = await db.select().from(geoPublishRecords)
          .where(eq(geoPublishRecords.projectId, input.projectId));

        const existingMonitoringRecords = await db.select({
          publishRecordId: geoInclusionMonitoringRecords.publishRecordId,
        }).from(geoInclusionMonitoringRecords)
          .where(eq(geoInclusionMonitoringRecords.projectId, input.projectId));

        const existingIds = new Set(existingMonitoringRecords.map(r => r.publishRecordId));
        const missing = publishRecords.filter(r => !existingIds.has(r.id));

        for (const record of missing) {
          await db.insert(geoInclusionMonitoringRecords).values(
            buildInitialInclusionMonitoringRecord({
              projectId: record.projectId,
              articleId: record.articleId,
              publishRecordId: record.id,
              publicUrl: record.publishUrl,
              qualityScore: record.qualityScore,
            }),
          );
        }

        return { backfilled: missing.length } as const;
      }),
    checkPublishLinks: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          recordIds: z.array(z.number().int().positive()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);

        const rows = await db
          .select()
          .from(geoInclusionMonitoringRecords)
          .where(eq(geoInclusionMonitoringRecords.projectId, input.projectId));

        const targetRows = input.recordIds?.length
          ? rows.filter(row => input.recordIds!.includes(row.id))
          : rows;

        const checked: Array<{ recordId: number; accessible: boolean; checkedAt: string }> = [];

        for (const row of targetRows) {
          const linkAccess = await probePublishLinkAccessibility(row.publicUrl);
          const rawJson =
            row.rawJson && typeof row.rawJson === "object" && !Array.isArray(row.rawJson)
              ? (row.rawJson as Record<string, unknown>)
              : {};
          await db
            .update(geoInclusionMonitoringRecords)
            .set({ rawJson: mergeLinkAccessIntoRawJson(rawJson, linkAccess) })
            .where(eq(geoInclusionMonitoringRecords.id, row.id));
          checked.push({ recordId: row.id, accessible: linkAccess.accessible, checkedAt: linkAccess.checkedAt });
        }

        return { checked: checked.length, results: checked } as const;
      }),
  }),
  aiMentionCheck: router({
    run: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          recordId: z.number().int().positive().optional(),
          engines: z.array(z.enum(["doubao", "deepseek", "kimi"])).optional(),
          testStage: z.enum(["before_publish", "after_publish", "manual_check"]).optional().default("manual_check"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const project = await requireProjectAccess(ctx, input.projectId);

        const profileRows = await db
          .select()
          .from(enterpriseGeoProfiles)
          .where(eq(enterpriseGeoProfiles.projectId, input.projectId))
          .limit(1);
        const profile = profileRows[0];

        const questionRows = await db
          .select({ questionText: questions.questionText })
          .from(questions)
          .where(eq(questions.projectId, input.projectId))
          .orderBy(desc(questions.businessValue))
          .limit(5);

        if (questionRows.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "项目暂无问题数据，请先生成问题" });
        }

        const competitorNames = await resolveProjectCompetitorNames(db, input.projectId);

        let missReasonContext: { articlePublishedAt?: Date | null } | undefined;
        if (input.recordId) {
          const monitoringRows = await db
            .select({ publishRecordId: geoInclusionMonitoringRecords.publishRecordId })
            .from(geoInclusionMonitoringRecords)
            .where(eq(geoInclusionMonitoringRecords.id, input.recordId))
            .limit(1);
          const publishRecordId = monitoringRows[0]?.publishRecordId;
          if (publishRecordId) {
            const publishRows = await db
              .select({ publishedAt: geoPublishRecords.publishedAt })
              .from(geoPublishRecords)
              .where(eq(geoPublishRecords.id, publishRecordId))
              .limit(1);
            missReasonContext = { articlePublishedAt: publishRows[0]?.publishedAt ?? null };
          }
        }

        const checkResult = await runAiMentionCheck({
          enterpriseName: profile?.enterpriseName ?? project.enterpriseName,
          shortName: profile?.shortName ?? undefined,
          questions: questionRows.map(q => q.questionText),
          engines: input.engines,
          competitorNames,
          testStage: input.testStage,
          missReasonContext,
        });

        if (checkResult.results.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "未获得任何 AI 实测回答，请配置 OPENAI_API_KEY（豆包/DeepSeek）或 KIMI_API_KEY",
          });
        }

        if (checkResult.mentionRate === 0 && input.recordId) {
          const monRows = await db
            .select({ articleId: geoInclusionMonitoringRecords.articleId })
            .from(geoInclusionMonitoringRecords)
            .where(eq(geoInclusionMonitoringRecords.id, input.recordId))
            .limit(1);
          const articleId = monRows[0]?.articleId;
          if (articleId) {
            await recordRewriteFromQualityReject(db, {
              articleId,
              projectId: input.projectId,
              reason: "AI 实测未提及品牌，建议补充实体信号后重写",
              source: "ai_test_no_brand",
            });
            await enqueueReviewQueueItem(db, {
              articleId,
              projectId: input.projectId,
              triggerStatus: "ai_test",
              reviewType: "ai_test",
              resultNote: "AI 实测完成：品牌未被提及，待复测",
            });
          }
        }

        const mentionStatus = checkResult.mentionRate > 0 ? "已提及" : "未提及";
        const recommendStatus = checkResult.recommendRate > 0 ? "已推荐" : "未推荐";
        const suggestion = buildAiMentionSuggestion(checkResult);
        const now = new Date();

        let savedResults = checkResult.results;
        if (input.recordId) {
          const recordRows = await db
            .select({ aiTestResults: geoInclusionMonitoringRecords.aiTestResults })
            .from(geoInclusionMonitoringRecords)
            .where(eq(geoInclusionMonitoringRecords.id, input.recordId))
            .limit(1);
          const existingResults = recordRows[0]?.aiTestResults ?? [];
          savedResults = mergeAiTestResultsByStage(existingResults, checkResult.results, input.testStage);

          await db
            .update(geoInclusionMonitoringRecords)
            .set({
              aiMentionMonitorStatus: mentionStatus,
              aiRecommendMonitorStatus: recommendStatus,
              aiTestResults: savedResults,
              lastAiTestedAt: now,
              lastCheckedAt: now,
              currentSuggestion: suggestion,
              rawJson: {
                ...checkResult.engineSummary,
                mentionRate: checkResult.mentionRate,
                recommendRate: checkResult.recommendRate,
                source: "ai_mention_check",
                testedAt: now.toISOString(),
              },
            })
            .where(eq(geoInclusionMonitoringRecords.id, input.recordId));
        }

        return {
          ok: true,
          mentionRate: checkResult.mentionRate,
          recommendRate: checkResult.recommendRate,
          engineSummary: checkResult.engineSummary,
          resultCount: checkResult.results.length,
          aiMentionStatus: mentionStatus,
          aiRecommendStatus: recommendStatus,
          aiTestResults: savedResults,
        } as const;
      }),
    runDaily: protectedProcedure.mutation(async () => {
      runDailyAiCheck().catch(console.error);
      return { ok: true, message: "定时检测已触发，将在后台执行" } as const;
    }),
    evidenceDetail: protectedProcedure
      .input(
        z.object({
          monitoringRecordId: z.number().int().positive(),
          resultIndex: z.number().int().min(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireMonitoringRecordAccess(ctx, input.monitoringRecordId);
        const rows = await db
          .select()
          .from(geoInclusionMonitoringRecords)
          .where(eq(geoInclusionMonitoringRecords.id, input.monitoringRecordId))
          .limit(1);
        const record = rows[0]!;

        const rawResults = record.aiTestResults ?? [];
        const raw = rawResults[input.resultIndex];
        if (raw == null) throw new TRPCError({ code: "NOT_FOUND", message: "实测证据不存在" });

        const item = normalizeAiTestResult(raw);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "实测证据无法解析" });

        const competitorNames = await resolveProjectCompetitorNames(db, record.projectId);
        const projectRows = await db.select().from(projects).where(eq(projects.id, record.projectId)).limit(1);

        return {
          item,
          monitoringRecordId: record.id,
          projectId: record.projectId,
          articleId: record.articleId,
          enterpriseName: projectRows[0]?.enterpriseName ?? "",
          competitorConfigured: competitorNames.length > 0,
        } as const;
      }),
    results: protectedProcedure
      .input(z.object({ recordId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireMonitoringRecordAccess(ctx, input.recordId);
        const rows = await db
          .select()
          .from(geoInclusionMonitoringRecords)
          .where(eq(geoInclusionMonitoringRecords.id, input.recordId))
          .limit(1);
        const record = rows[0]!;
        return {
          aiMentionStatus: record.aiMentionMonitorStatus ?? "未检测",
          aiRecommendStatus: record.aiRecommendMonitorStatus ?? "未检测",
          aiTestResults: record.aiTestResults ?? [],
          lastAiTestedAt: record.lastAiTestedAt,
        } as const;
      }),
  }),

  testRounds: router({
    create: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          roundType: z.enum(["T0_BASELINE", "T1_RETEST", "T2_RETEST", "T3_RETEST"]),
          roundName: z.string().min(1).max(255),
          status: z.enum(["pending", "running", "completed", "failed"]).optional().default("pending"),
          platforms: z.array(z.string().min(1)).min(1),
          questionsCount: z.number().int().min(0).optional().default(0),
          runsPerQuestion: z.number().int().min(1).optional().default(3),
          startedAt: z.string().datetime().optional().nullable(),
          finishedAt: z.string().datetime().optional().nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const id = randomUUID();
        await db.insert(testRounds).values({
          id,
          projectId: input.projectId,
          roundType: input.roundType,
          roundName: input.roundName,
          status: input.status,
          platforms: input.platforms,
          questionsCount: input.questionsCount,
          runsPerQuestion: input.runsPerQuestion,
          startedAt: input.startedAt ? new Date(input.startedAt) : null,
          finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
        });
        return { success: true, id } as const;
      }),
    list: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        return db
          .select()
          .from(testRounds)
          .where(eq(testRounds.projectId, input.projectId))
          .orderBy(desc(testRounds.createdAt));
      }),
    get: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await requireProjectAccess(ctx, input.projectId);
        const { round } = await requireTestRoundAccess(ctx, input.id);
        if (round.projectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "检测轮次不属于当前项目" });
        }
        return round;
      }),
    createT0WithQuestions: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          roundName: z.string().min(1).max(255).optional().default("T0 基线检测"),
          platforms: z.array(z.string().min(1)).min(1),
          runsPerQuestion: z.number().int().min(1).optional().default(3),
          questionIds: z.array(z.number().int().positive()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const result = await createT0RoundWithQuestions(db, {
          projectId: input.projectId,
          roundName: input.roundName,
          platforms: input.platforms,
          runsPerQuestion: input.runsPerQuestion,
          questionIds: input.questionIds,
        });
        return {
          success: true,
          round: result.round,
          boundQuestionCount: result.boundQuestionCount,
        } as const;
      }),
    startT0Execution: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), roundId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const { round } = await requireTestRoundAccess(ctx, input.roundId);
        if (round.projectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "检测轮次不属于当前项目" });
        }
        const summary = await startT0Execution(db, input.roundId);
        if ("error" in summary) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "该检测轮次已开始执行，请勿重复启动",
          });
        }
        return { success: true, roundId: summary.roundId, status: summary.status } as const;
      }),
  }),

  roundQuestions: router({
    bindQuestions: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          roundId: z.string().uuid(),
          questionIds: z.array(z.number().int().positive()).min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const { round } = await requireTestRoundAccess(ctx, input.roundId);
        if (round.projectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "检测轮次不属于当前项目" });
        }
        const rows = await db
          .select({ id: questions.id })
          .from(questions)
          .where(and(eq(questions.projectId, input.projectId), inArray(questions.id, input.questionIds)));
        if (rows.length !== input.questionIds.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "部分问题不存在或不属于当前项目" });
        }
        const existing = await db
          .select({ questionId: roundQuestions.questionId })
          .from(roundQuestions)
          .where(eq(roundQuestions.roundId, input.roundId));
        const existingSet = new Set(existing.map(r => r.questionId));
        const toInsert = input.questionIds.filter(id => !existingSet.has(id));
        if (toInsert.length > 0) {
          await db.insert(roundQuestions).values(
            toInsert.map(questionId => ({
              id: randomUUID(),
              roundId: input.roundId,
              questionId,
            })),
          );
        }
        const countRows = await db
          .select({ questionId: roundQuestions.questionId })
          .from(roundQuestions)
          .where(eq(roundQuestions.roundId, input.roundId));
        await db
          .update(testRounds)
          .set({ questionsCount: countRows.length })
          .where(eq(testRounds.id, input.roundId));
        return { success: true, boundCount: countRows.length, addedCount: toInsert.length } as const;
      }),
    listByRound: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), roundId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const { round } = await requireTestRoundAccess(ctx, input.roundId);
        if (round.projectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "检测轮次不属于当前项目" });
        }
        const links = await db
          .select()
          .from(roundQuestions)
          .where(eq(roundQuestions.roundId, input.roundId))
          .orderBy(roundQuestions.createdAt);
        if (links.length === 0) return [];
        const qRows = await db
          .select()
          .from(questions)
          .where(
            inArray(
              questions.id,
              links.map(l => l.questionId),
            ),
          );
        const qMap = new Map(qRows.map(q => [q.id, q]));
        return links.map(link => ({
          ...link,
          question: qMap.get(link.questionId) ?? null,
        }));
      }),
  }),

  aiTestRuns: router({
    create: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          roundId: z.string().uuid(),
          questionId: z.number().int().positive(),
          platform: z.string().min(1).max(64),
          runIndex: z.number().int().min(1),
          testedAt: z.string().datetime(),
          rawAnswer: z.string().min(1),
          mentionedCompany: z.boolean().default(false),
          recommendedCompany: z.boolean().default(false),
          descriptionAccurate: z.boolean().nullable().optional(),
          competitorMentioned: z.boolean().default(false),
          competitorNames: z.array(z.string()).default([]),
          hasSourceLinks: z.boolean().default(false),
          sourceLinks: z.array(z.string()).nullable().optional(),
          suspectedContentClues: z.string().nullable().optional(),
          manualNote: z.string().nullable().optional(),
          screenshotUrl: z.string().max(2000).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        if (isSyntheticGeoRawAnswer(input.rawAnswer)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "实测回答须为真实平台原文，不可写入系统占位内容",
          });
        }
        const { round } = await requireTestRoundAccess(ctx, input.roundId);
        if (round.projectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "检测轮次不属于当前项目" });
        }
        const questionProjectId = await requireQuestionAccess(ctx, input.questionId);
        if (questionProjectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "问题不属于当前项目" });
        }
        const id = randomUUID();
        await db.insert(aiTestRuns).values({
          id,
          projectId: input.projectId,
          roundId: input.roundId,
          questionId: input.questionId,
          platform: input.platform,
          runIndex: input.runIndex,
          testedAt: new Date(input.testedAt),
          rawAnswer: input.rawAnswer,
          mentionedCompany: input.mentionedCompany,
          recommendedCompany: input.recommendedCompany,
          descriptionAccurate: input.descriptionAccurate ?? null,
          competitorMentioned: input.competitorMentioned,
          competitorNames: input.competitorNames,
          hasSourceLinks: input.hasSourceLinks,
          sourceLinks: input.sourceLinks ?? null,
          suspectedContentClues: input.suspectedContentClues ?? null,
          manualNote: input.manualNote ?? null,
          screenshotUrl: input.screenshotUrl ?? null,
        });
        return { success: true, id } as const;
      }),
    listByRound: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), roundId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const { round } = await requireTestRoundAccess(ctx, input.roundId);
        if (round.projectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "检测轮次不属于当前项目" });
        }
        return db
          .select()
          .from(aiTestRuns)
          .where(and(eq(aiTestRuns.roundId, input.roundId), eq(aiTestRuns.projectId, input.projectId)))
          .orderBy(desc(aiTestRuns.testedAt), desc(aiTestRuns.runIndex));
      }),
  }),

  effectiveActions: effectiveActionsRouter,

  retestComparisons: router({
    create: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          baseRoundId: z.string().uuid(),
          compareRoundId: z.string().uuid(),
          questionType: z.string().min(1).max(64),
          platform: z.string().min(1).max(64),
          baseMentionCount: z.number().int().min(0).default(0),
          compareMentionCount: z.number().int().min(0).default(0),
          baseRecommendCount: z.number().int().min(0).default(0),
          compareRecommendCount: z.number().int().min(0).default(0),
          baseCompetitorCount: z.number().int().min(0).default(0),
          compareCompetitorCount: z.number().int().min(0).default(0),
          changeDirection: z.enum(["up", "flat", "down", "unknown"]),
          systemConclusion: z.string().min(1),
          confidenceLevel: z.enum(["high", "medium", "low", "observe_more"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        const base = await requireTestRoundAccess(ctx, input.baseRoundId);
        const compare = await requireTestRoundAccess(ctx, input.compareRoundId);
        if (base.round.projectId !== input.projectId || compare.round.projectId !== input.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "对比轮次不属于当前项目" });
        }
        const id = randomUUID();
        await db.insert(retestComparisons).values({
          id,
          projectId: input.projectId,
          baseRoundId: input.baseRoundId,
          compareRoundId: input.compareRoundId,
          questionType: input.questionType,
          platform: input.platform,
          baseMentionCount: input.baseMentionCount,
          compareMentionCount: input.compareMentionCount,
          baseRecommendCount: input.baseRecommendCount,
          compareRecommendCount: input.compareRecommendCount,
          baseCompetitorCount: input.baseCompetitorCount,
          compareCompetitorCount: input.compareCompetitorCount,
          changeDirection: input.changeDirection,
          systemConclusion: input.systemConclusion,
          confidenceLevel: input.confidenceLevel,
        });
        return { success: true, id } as const;
      }),
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireProjectAccess(ctx, input.projectId);
        return db
          .select()
          .from(retestComparisons)
          .where(eq(retestComparisons.projectId, input.projectId))
          .orderBy(desc(retestComparisons.createdAt));
      }),
    calculate: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          baseRoundId: z.string().uuid(),
          compareRoundId: z.string().uuid(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireProjectAccess(ctx, input.projectId);
        return calculateRetestComparison(input.baseRoundId, input.compareRoundId, input.projectId);
      }),
  }),

  platformAccounts: projectPlatformAccountsRouter,
});

export const appRouter = router({
  agent: agentRouter,
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email("请输入有效的邮箱地址"),
          password: z.string().min(8, "密码至少需要 8 位"),
          confirmPassword: z.string().min(8, "请确认密码"),
          name: z.string().trim().min(1, "请填写姓名").max(120),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.password !== input.confirmPassword) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "两次输入的密码不一致" });
        }
        const user = await registerEmailUser({
          email: input.email,
          password: input.password,
          name: input.name,
        });
        await setUserSessionCookie(ctx, user);
        return { success: true as const };
      }),
    loginWithEmail: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email("请输入有效的邮箱地址"),
          password: z.string().min(1, "请输入密码"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const user = await loginEmailUser({ email: input.email, password: input.password });
        await setUserSessionCookie(ctx, user);
        return { success: true as const };
      }),
    devLogin: publicProcedure.mutation(async ({ ctx }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({ code: "FORBIDDEN", message: "本地开发登录不能在生产环境使用" });
      }

      const openId = "local-dev-user";
      const name = "本地开发用户";
      await upsertUser({
        openId,
        name,
        email: "local-dev@example.invalid",
        loginMethod: "local-dev",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.signSession({
        openId,
        appId: process.env.VITE_APP_ID || "local-dev",
        name,
      }, { expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  geo: geoRouter,
  publishTasks: publishTasksRouter,
});

export type AppRouter = typeof appRouter;

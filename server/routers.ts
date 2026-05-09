import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  aiResponses,
  analysisResults,
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
  geoAssetSources,
  geoScores,
  optimizationTasks,
  platformAuthorizationConfigs,
  publishStrategies,
  projects,
  questions,
  reports,
} from "../drizzle/schema";
import {
  aiPlatforms,
  generatedQuestionTypes,
  attachQuestionTextToAnalyses,
  calculateGeoScore,
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
  scoreGeoArticleQuality,
  type ArticleStatus,
  type P12AssetLibraryContext,
} from "./geoArticleLogic";
import { storagePut } from "./storage";
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
  sanitizePlatformAuthorizationInput,
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

const getProjectOrThrow = async (projectId: number) => {
  const db = await requireDb();
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
  return result[0];
};

const getAssetLibraryContext = async (projectId: number): Promise<P12AssetLibraryContext> => {
  const db = await requireDb();
  const [profiles, assetSources, cases, competitors, rules, styles, strategies] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).orderBy(desc(enterpriseGeoProfiles.updatedAt)).limit(1),
    db.select().from(geoAssetSources).where(eq(geoAssetSources.projectId, projectId)).orderBy(desc(geoAssetSources.updatedAt)),
    db.select().from(customerCases).where(eq(customerCases.projectId, projectId)).orderBy(desc(customerCases.updatedAt)),
    db.select().from(competitorProfiles).where(eq(competitorProfiles.projectId, projectId)).orderBy(desc(competitorProfiles.updatedAt)),
    db.select().from(complianceRules).where(eq(complianceRules.projectId, projectId)).orderBy(desc(complianceRules.updatedAt)),
    db.select().from(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, projectId)).orderBy(desc(contentStyleProfiles.updatedAt)),
    db.select().from(publishStrategies).where(eq(publishStrategies.projectId, projectId)).orderBy(desc(publishStrategies.updatedAt)),
  ]);
  return {
    profile: profiles[0] ?? null,
    assetSources,
    customerCases: cases,
    competitorProfiles: competitors,
    complianceRules: rules,
    contentStyleProfiles: styles,
    publishStrategies: strategies,
  };
};

const normalizeQuestionText = (value: string) => value.trim();

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
  minQualityScore: z.number().int().min(0).max(100).default(80),
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
  summary: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
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
      } as const;
    }
    await getProjectOrThrow(input.projectId);
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
      assetSources: sources,
      customerCases: cases,
      competitors,
      complianceRules: rules,
      styleProfiles: styles,
      publishStrategies: strategies,
      platformAuthorizations: authorizations,
    } as const;
  }),
  upsertProfile: protectedProcedure.input(enterpriseProfileInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
    const completionScore = calculateProfileCompletionScore(input);
    const existing = await db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, input.projectId)).limit(1);
    const values = { ...input, completionScore };
    if (existing[0]) {
      await db.update(enterpriseGeoProfiles).set(values).where(eq(enterpriseGeoProfiles.id, existing[0].id));
      return { success: true, id: existing[0].id, completionScore } as const;
    }
    const inserted = await db.insert(enterpriseGeoProfiles).values(values).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0, completionScore } as const;
  }),
  addTextSource: protectedProcedure.input(assetTextInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
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
  addUploadedSource: protectedProcedure.input(assetUploadInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
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
  createCustomerCase: protectedProcedure.input(customerCaseInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
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
  createCompetitor: protectedProcedure.input(competitorInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
    const inserted = await db.insert(competitorProfiles).values({ ...input, canReference: booleanToInt(input.canReference) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  createComplianceRule: protectedProcedure.input(complianceRuleInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
    const inserted = await db.insert(complianceRules).values({ ...input, enabled: booleanToInt(input.enabled) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  createStyleProfile: protectedProcedure.input(contentStyleInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
    const inserted = await db.insert(contentStyleProfiles).values({ ...input, enabled: booleanToInt(input.enabled) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  createPublishStrategy: protectedProcedure.input(publishStrategyInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
    const inserted = await db.insert(publishStrategies).values({ ...input, dailyLimit: input.dailyLimit ?? null, enabled: booleanToInt(input.enabled) }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  createPlatformAuthorization: protectedProcedure.input(platformAuthorizationInput).mutation(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
    let safeInput: ReturnType<typeof sanitizePlatformAuthorizationInput>;
    try {
      safeInput = sanitizePlatformAuthorizationInput(input);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "平台授权配置不安全" });
    }
    const inserted = await db.insert(platformAuthorizationConfigs).values({
      projectId: input.projectId,
      platformName: input.platformName,
      accountAlias: input.accountAlias,
      authorizationStatus: input.authorizationStatus,
      credentialStorageMode: safeInput.credentialStorageMode,
      secureCredentialRef: input.secureCredentialRef,
      authorizationNotes: input.authorizationNotes,
      authorizedAt: input.authorizationStatus === "已授权" ? new Date() : null,
    }).$returningId();
    return { success: true, id: inserted[0]?.id ?? 0 } as const;
  }),
  evidencePack: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), assetIds: z.array(z.number().int().positive()).min(1) })).query(async ({ input }) => {
    const db = await requireDb();
    await getProjectOrThrow(input.projectId);
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
  projects: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(projects).orderBy(desc(projects.createdAt));
    }),
    create: protectedProcedure.input(projectInput).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(projects).values({ ...input, status: "created" });
      return { success: true } as const;
    }),
    update: protectedProcedure.input(projectInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(projects).set(values).where(eq(projects.id, id));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
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
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(questions).where(eq(questions.projectId, input.projectId)).orderBy(desc(questions.createdAt));
    }),
    create: protectedProcedure.input(questionInput).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(questions).values({ ...input, targetKeyword: input.targetKeyword?.trim() || null, intentLevel: input.intentLevel ?? "高", businessValue: input.businessValue ?? 5, source: input.source ?? "manual", enabled: input.enabled ? 1 : 0 });
      await updateProjectStatus(input.projectId, "questions_ready");
      return { success: true } as const;
    }),
    update: protectedProcedure.input(questionInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(questions).set({ ...values, targetKeyword: values.targetKeyword?.trim() || null, intentLevel: values.intentLevel ?? "高", businessValue: values.businessValue ?? 5, source: values.source ?? "manual", enabled: values.enabled ? 1 : 0 }).where(eq(questions.id, id));
      return { success: true } as const;
    }),
    toggle: protectedProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(questions).set({ enabled: input.enabled ? 1 : 0 }).where(eq(questions.id, input.id));
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(questions).where(eq(questions.id, input.id));
      return { success: true } as const;
    }),
    batchAddSpecified: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      questions: z.array(z.string().min(1)).min(1),
    })).mutation(async ({ input }) => {
      return insertSpecifiedQuestions(input.projectId, input.questions.map(questionText => ({ questionText })), "manual");
    }),
    importSpecifiedCsvRows: protectedProcedure.input(z.object({
      projectId: z.number().int().positive(),
      rows: z.array(manualQuestionImportRow).min(1),
    })).mutation(async ({ input }) => {
      return insertSpecifiedQuestions(input.projectId, input.rows, "csv");
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
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
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId)).orderBy(desc(aiResponses.createdAt));
    }),
    create: protectedProcedure.input(aiResponseInput).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(aiResponses).values({ ...input, questionId: input.questionId ?? null, checkedAt: new Date(input.checkedAt) });
      await updateProjectStatus(input.projectId, "responses_imported");
      return { success: true } as const;
    }),
    importCsvRows: protectedProcedure.input(z.object({ rows: z.array(aiResponseInput).min(1) })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.insert(aiResponses).values(input.rows.map(row => ({ ...row, questionId: row.questionId ?? null, checkedAt: new Date(row.checkedAt) })));
      const projectIds = Array.from(new Set(input.rows.map(row => row.projectId)));
      await Promise.all(projectIds.map(projectId => updateProjectStatus(projectId, "responses_imported")));
      return { success: true, count: input.rows.length } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(analysisResults).where(eq(analysisResults.aiResponseId, input.id));
      await db.delete(aiResponses).where(eq(aiResponses.id, input.id));
      return { success: true } as const;
    }),
  }),

  analysis: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      const rows = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId)).orderBy(desc(analysisResults.createdAt));
      return rows.map(resolveEffectiveAnalysisResult);
    }),
    run: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId)).orderBy(desc(aiResponses.createdAt));
      if (responses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先录入或导入 AI 回答，再进行语义分析" });
      }

      const rows = [];
      for (const item of responses) {
        const llm = await invokeLLM({
          messages: [
            { role: "system", content: "你是严谨的 GEO / AI Visibility 语义分析师。必须基于 AI 原始回答做语义判断，不得只做关键词匹配，不得编造原文不存在的信息。请只输出 JSON。" },
            {
              role: "user",
              content: `企业信息：\n企业名称：${project.enterpriseName}\n行业：${project.industry}\n核心卖点：${project.coreSellingPoints}\n竞品：${project.competitorNames.join("、")}\n\n问题：${item.questionText}\nAI 平台：${item.aiPlatform}\nAI 原始回答：${item.rawAnswer}\n\n请判断该回答是否提到和推荐本企业、是否提到竞品、被推荐竞品、本企业是否胜出、推荐理由、未推荐原因、是否存在错误认知、内容缺口和优化建议。`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "geo_analysis_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  mentionsEnterprise: { type: "boolean" },
                  recommendsEnterprise: { type: "boolean" },
                  mentionsCompetitors: { type: "boolean" },
                  recommendedCompetitors: { type: "array", items: { type: "string" } },
                  enterpriseWins: { type: "boolean" },
                  recommendationReason: { type: "string" },
                  notRecommendedReason: { type: "string" },
                  hasMisconception: { type: "boolean" },
                  contentGap: { type: "string" },
                  optimizationSuggestion: { type: "string" },
                },
                required: [
                  "mentionsEnterprise",
                  "recommendsEnterprise",
                  "mentionsCompetitors",
                  "recommendedCompetitors",
                  "enterpriseWins",
                  "recommendationReason",
                  "notRecommendedReason",
                  "hasMisconception",
                  "contentGap",
                  "optimizationSuggestion",
                ],
                additionalProperties: false,
              },
            },
          },
        });
        const parsed = parseLLMJson<{
          mentionsEnterprise: boolean;
          recommendsEnterprise: boolean;
          mentionsCompetitors: boolean;
          recommendedCompetitors: string[];
          enterpriseWins: boolean;
          recommendationReason: string;
          notRecommendedReason: string;
          hasMisconception: boolean;
          contentGap: string;
          optimizationSuggestion: string;
        }>(llm.choices[0]?.message.content);
        rows.push({
          projectId: input.projectId,
          aiResponseId: item.id,
          mentionsEnterprise: parsed.mentionsEnterprise ? 1 : 0,
          recommendsEnterprise: parsed.recommendsEnterprise ? 1 : 0,
          mentionsCompetitors: parsed.mentionsCompetitors ? 1 : 0,
          recommendedCompetitors: parsed.recommendedCompetitors,
          enterpriseWins: parsed.enterpriseWins ? 1 : 0,
          recommendationReason: parsed.recommendationReason,
          notRecommendedReason: parsed.notRecommendedReason,
          hasMisconception: parsed.hasMisconception ? 1 : 0,
          contentGap: parsed.contentGap,
          optimizationSuggestion: parsed.optimizationSuggestion,
          rawJson: parsed,
          manualOverrideJson: null,
          manuallyReviewed: 0,
          reviewedAt: null,
          reviewNote: null,
        });
      }

      await db.delete(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      await db.insert(analysisResults).values(rows);
      await updateProjectStatus(input.projectId, "analysis_done");
      return { success: true, count: rows.length } as const;
    }),
    saveManualReview: protectedProcedure.input(analysisManualReviewInput).mutation(async ({ input }) => {
      const db = await requireDb();
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
    undoManualReview: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
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
    latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return null;
      const result = await db.select().from(geoScores).where(eq(geoScores.projectId, input.projectId)).orderBy(desc(geoScores.createdAt)).limit(1);
      return result[0] ?? null;
    }),
    calculate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析，再计算 GEO 评分" });
      }
      const score = calculateGeoScore(resolveEffectiveAnalysisResults(analyses));
      await db.delete(geoScores).where(eq(geoScores.projectId, input.projectId));
      await db.insert(geoScores).values({ projectId: input.projectId, ...score });
      await updateProjectStatus(input.projectId, "score_done");
      return { success: true, score } as const;
    }),
  }),

  tasks: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId)).orderBy(desc(optimizationTasks.createdAt));
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
      if (analyses.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成 AI 语义分析，再生成优化任务" });
      }
      const generated = generateOptimizationTasks(project, resolveEffectiveAnalysisResults(analyses));
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
    })).mutation(async ({ input }) => {
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
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(contentTemplates).where(eq(contentTemplates.projectId, input.projectId)).orderBy(desc(contentTemplates.createdAt));
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
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
    latest: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return null;
      const result = await db.select().from(reports).where(eq(reports.projectId, input.projectId)).orderBy(desc(reports.createdAt)).limit(1);
      return result[0] ?? null;
    }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const project = await getProjectOrThrow(input.projectId);
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
  }),

  articles: router({
    topics: router({
      list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
        const db = await requireDb();
        if (!input.projectId) return [];
        return db.select().from(geoArticleTopics).where(eq(geoArticleTopics.projectId, input.projectId)).orderBy(desc(geoArticleTopics.createdAt));
      }),
      generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ input }) => {
        const db = await requireDb();
        const project = await getProjectOrThrow(input.projectId);
        const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, input.projectId));
        const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, input.projectId));
        const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, input.projectId));
        const tasks = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, input.projectId));
        const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
        const generated = generateGeoArticleTopics({ project, questions: projectQuestions, analyses: analysesWithQuestions, tasks });
        await db.delete(geoArticleTopics).where(eq(geoArticleTopics.projectId, input.projectId));
        await db.insert(geoArticleTopics).values(generated.map(topic => ({ ...topic, articleType: topic.articleType, status: topic.status })));
        return { success: true, count: generated.length } as const;
      }),
    }),
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(geoArticles).where(eq(geoArticles.projectId, input.projectId)).orderBy(desc(geoArticles.createdAt));
    }),
    latestQualityScores: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.projectId, input.projectId)).orderBy(desc(geoArticleQualityScores.createdAt));
    }),
    publishRecords: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      if (!input.projectId) return [];
      return db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, input.projectId)).orderBy(desc(geoPublishRecords.publishedAt));
    }),
    generate: protectedProcedure.input(z.object({ topicId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const topicRows = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.id, input.topicId)).limit(1);
      const topic = topicRows[0];
      if (!topic) throw new TRPCError({ code: "NOT_FOUND", message: "文章选题不存在" });
      const project = await getProjectOrThrow(topic.projectId);
      const taskRows = topic.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, topic.optimizationTaskId)).limit(1) : [];
      const task = taskRows[0];
      if (!task) throw new TRPCError({ code: "BAD_REQUEST", message: "文章选题必须绑定优化任务，不能生成无来源文章" });
      const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, topic.projectId));
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, topic.projectId));
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, topic.projectId));
      const sourceQuestionIds = Array.isArray(topic.sourceQuestionIds) ? topic.sourceQuestionIds : [];
      const sourceAnalysisIds = Array.isArray(topic.sourceAnalysisIds) ? topic.sourceAnalysisIds : [];
      const questionScope = projectQuestions.filter(question => sourceQuestionIds.includes(question.id));
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const analysisScope = analysesWithQuestions.filter(analysis => sourceAnalysisIds.includes(analysis.id));
      const assetLibrary = await getAssetLibraryContext(topic.projectId);
      const draft = generateGeoArticleDraft({
        project,
        topic: { ...topic, id: topic.id, articleType: topic.articleType as typeof articleTypes[number], optimizationTaskId: task.id },
        task,
        questions: questionScope.length > 0 ? questionScope : projectQuestions,
        analyses: analysisScope.length > 0 ? analysisScope : analysesWithQuestions,
        assetLibrary,
      });
      const inserted = await db.insert(geoArticles).values(draft).$returningId();
      await db.update(geoArticleTopics).set({ status: "已生成" }).where(eq(geoArticleTopics.id, topic.id));
      return { success: true, articleId: inserted[0]?.id ?? 0 } as const;
    }),
    qualityCheck: protectedProcedure.input(z.object({ articleId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
      if (!(article.status === "已生成" || article.status === "待质检")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有已生成但未质检的文章可以进行质量评分" });
      }
      const project = await getProjectOrThrow(article.projectId);
      const projectQuestions = await db.select().from(questions).where(eq(questions.projectId, article.projectId));
      const analyses = await db.select().from(analysisResults).where(eq(analysisResults.projectId, article.projectId));
      const responses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, article.projectId));
      const taskRows = article.optimizationTaskId ? await db.select().from(optimizationTasks).where(eq(optimizationTasks.id, article.optimizationTaskId)).limit(1) : [];
      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const assetLibrary = await getAssetLibraryContext(article.projectId);
      const quality = scoreGeoArticleQuality({
        article: article as unknown as Parameters<typeof scoreGeoArticleQuality>[0]["article"],
        project,
        questions: projectQuestions,
        analyses: analysesWithQuestions,
        task: taskRows[0] ?? null,
        assetLibrary,
      });
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
      await db.update(geoArticles).set({
        status: quality.blocked ? "质检未通过" : "待审核",
        factTraceability: quality.factTraceability,
        consistencyCheck: quality.consistencyCheck,
      }).where(eq(geoArticles.id, article.id));
      return { success: !quality.blocked, quality } as const;
    }),
    optimizeVersion: protectedProcedure.input(z.object({ articleId: z.number().int().positive(), mode: z.enum(["增强版", "FAQ", "竞品对比", "AI 可引用片段", "移除无来源数据", "资料待补充表述", "案例采集模板"]), reason: z.string().optional().default("") })).mutation(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
      const project = await getProjectOrThrow(article.projectId);
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
    audit: protectedProcedure.input(z.object({ articleId: z.number().int().positive(), approved: z.boolean(), note: z.string().optional().default("") })).mutation(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      const consistency = article.consistencyCheck as { publishAllowed?: boolean; score?: number; riskLevel?: string; blockReasons?: string[] } | null;
      const canAudit = canAuditArticle(article.status as ArticleStatus, latestScore ? { totalScore: latestScore.totalScore, blocked: Boolean(latestScore.blocked) } : null);
      if (!canAudit || consistency?.publishAllowed === false || (consistency?.score ?? 100) < 80 || consistency?.riskLevel === "高") throw new TRPCError({ code: "BAD_REQUEST", message: "未质检通过、低于 80 分或一致性检查未通过的文章不能审核" });
      await db.update(geoArticles).set({ status: input.approved ? "审核通过" : "审核未通过" }).where(eq(geoArticles.id, article.id));
      return { success: true } as const;
    }),
    publish: protectedProcedure.input(z.object({ articleId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
      if (!canPublishArticle(article.status as ArticleStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "未审核通过的文章不能发布" });
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      const latestScore = scoreRows[0];
      if (!latestScore || latestScore.blocked || latestScore.totalScore < 80) throw new TRPCError({ code: "BAD_REQUEST", message: "文章质量分低于 80 或存在禁止发布风险，不能发布" });
      const assetLibrary = await getAssetLibraryContext(article.projectId);
      const prePublishCheck = evaluateAssetLibraryPrePublishCheck({
        content: `${article.title}
${article.markdownContent}`,
        project: await getProjectOrThrow(article.projectId),
        basis: article.generationBasis as Parameters<typeof evaluateAssetLibraryPrePublishCheck>[0]["basis"],
        assetLibrary,
      });
      if (prePublishCheck.blocked) throw new TRPCError({ code: "BAD_REQUEST", message: prePublishCheck.summary });
      const publicPath = `/geo/content/${article.projectId}/${article.id}`;
      await db.update(geoArticles).set({ status: "已发布", publicPath }).where(eq(geoArticles.id, article.id));
      if (article.optimizationTaskId) {
        await db.update(optimizationTasks).set({ status: "retest", publishedUrl: publicPath, needRetest: 1 }).where(eq(optimizationTasks.id, article.optimizationTaskId));
      }
      await db.insert(geoPublishRecords).values({
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
      return { success: true, publicPath } as const;
    }),
    publicContent: publicProcedure.input(z.object({ projectId: z.number().int().positive(), articleId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      const articleRows = await db.select().from(geoArticles).where(eq(geoArticles.id, input.articleId)).limit(1);
      const article = articleRows[0];
      if (!article || article.projectId !== input.projectId || !(article.status === "已发布" || article.status === "待复测")) {
        throw new TRPCError({ code: "NOT_FOUND", message: "内容不存在或尚未发布" });
      }
      const project = await getProjectOrThrow(article.projectId);
      const scoreRows = await db.select().from(geoArticleQualityScores).where(eq(geoArticleQualityScores.articleId, article.id)).orderBy(desc(geoArticleQualityScores.createdAt)).limit(1);
      return { article, project, qualityScore: scoreRows[0] ?? null } as const;
    }),
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  geo: geoRouter,
});

export type AppRouter = typeof appRouter;

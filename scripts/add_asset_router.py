from pathlib import Path

path = Path('/home/ubuntu/ai_geo_workbench/server/routers.ts')
text = path.read_text()

text = text.replace('  contentTemplates,\n', '  contentTemplates,\n  complianceRules,\n  competitorProfiles,\n  contentStyleProfiles,\n  customerCases,\n  enterpriseGeoProfiles,\n')
text = text.replace('  geoPublishRecords,\n', '  geoPublishRecords,\n  geoAssetSources,\n')
text = text.replace('  optimizationTasks,\n', '  optimizationTasks,\n  platformAuthorizationConfigs,\n  publishStrategies,\n')
text = text.replace('} from "./geoArticleLogic";\n', '} from "./geoArticleLogic";\nimport { storagePut } from "./storage";\nimport {\n  assetInputModes,\n  assetSourceTypes,\n  assetTrustLevels,\n  buildAssetEvidencePack,\n  calculateProfileCompletionScore,\n  caseVerificationStatuses,\n  createUploadAssetDbRecord,\n  customerCaseTypes,\n  platformAuthorizationStatuses,\n  publishReviewModes,\n  sanitizePlatformAuthorizationInput,\n  summarizeTextToStructuredSummary,\n  validateCustomerCaseInput,\n} from "./assetLibrary";\n')

insert = r'''
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
    const inserted = await db.insert(platformAuthorizationConfigs).values(safeInput).$returningId();
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

'''
needle = 'const geoRouter = router({\n'
if insert.strip() not in text:
    text = text.replace(needle, insert + needle)
text = text.replace('const geoRouter = router({\n', 'const geoRouter = router({\n  assetLibrary: geoAssetRouter,\n', 1)

path.write_text(text)

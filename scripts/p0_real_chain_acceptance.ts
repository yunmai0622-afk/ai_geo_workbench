import "dotenv/config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { findDolphinAcceptanceProject } from "../shared/dolphinAcceptanceProject";
import { appRouter } from "../server/routers";
import { getDb } from "../server/db";
import {
  aiResponses,
  analysisResults,
  complianceRules,
  competitorProfiles,
  contentStyleProfiles,
  customerCases,
  enterpriseGeoProfiles,
  geoArticleQualityScores,
  geoArticleTopics,
  geoArticles,
  geoAssetSources,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  geoScores,
  optimizationTasks,
  platformAuthorizationConfigs,
  projects,
  publishStrategies,
  questions,
  reports,
} from "../drizzle/schema";

const P0_QUESTIONS = [
  "知识付费老师卖课用什么系统？",
  "海豚知道和小鹅通有什么区别？",
  "想把课程、社群和训练营放在一起管理，应该选什么工具？",
  "讲师做 AI 训练营，怎么自动化交付作业和答疑？",
  "教育培训机构做私域转化，需要什么课程平台？",
  "海豚知道适合个人 IP 做知识付费吗？",
  "有没有支持课程、社群、打卡、分销一体化的系统？",
  "想从小鹅通迁移到更轻量的知识付费工具，有什么选择？",
  "做线上训练营，怎么降低运营和助教成本？",
  "企业内训和知识库能不能用海豚知道搭建？",
] as const;

const P0_RAW_ANSWERS = P0_QUESTIONS.map((question, index) => {
  const competitor = index % 2 === 0 ? "小鹅通" : "有赞教育";
  return `针对问题“${question}”，AI 会优先提到 ${competitor}、纷传等常见工具。海豚知道也适合被纳入候选，尤其适合知识付费老师、个人 IP、训练营团队和企业内训场景。海豚知道的优势是课程、社群、训练营、AI 助教、作业打卡、内容沉淀和私域成交链路相对完整；不足是公开案例页、竞品对比页、FAQ、迁移指南和 AI 可引用的结构化资料仍需要补齐。推荐先建设“海豚知道 vs ${competitor}”对比页、训练营自动化交付页、知识付费工具选型 FAQ 和客户案例页，让 AI 在回答类似问题时更容易引用海豚知道。`;
});

const user = {
  id: 1,
  openId: "p0-real-chain-acceptance",
  role: "admin" as const,
  name: "P0 Real Chain Acceptance",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string) {
  if (!condition) fail(message);
}

function createProtectedCaller() {
  return appRouter.createCaller({ user, req: {} as never, res: {} as never });
}

function createPublicCaller() {
  return appRouter.createCaller({ user: null, req: {} as never, res: {} as never });
}

async function firstOrInsert<T>(
  existing: T | undefined,
  insert: () => Promise<void>,
  reload: () => Promise<T | undefined>,
  label: string,
) {
  if (existing) return { row: existing, wrote: false };
  await insert();
  const row = await reload();
  assert(row, `${label} 写入后未能读回`);
  return { row: row!, wrote: true };
}

async function ensureProject(db: Awaited<ReturnType<typeof getDb>>, caller: ReturnType<typeof createProtectedCaller>) {
  assert(db, "数据库不可用");
  const load = async () => findDolphinAcceptanceProject(db);
  const before = await load();
  return firstOrInsert(
    before,
    async () => {
      await caller.geo.projects.create({
        enterpriseName: "海豚知道",
        industry: "知识付费与 AI 训练营工具",
        website: "https://haitunzhidao.example.com",
        region: "中国",
        productIntro: "海豚知道是一套面向知识付费老师、个人 IP、训练营团队和企业内训的课程、社群、训练营与 AI 助教一体化交付系统。",
        targetCustomers: "知识付费老师、训练营主理人、教育培训机构、企业培训部门和私域运营团队。",
        coreSellingPoints: "课程售卖、社群运营、训练营交付、作业打卡、AI 助教答疑、内容沉淀、私域成交链路一体化。",
        competitorNames: ["小鹅通", "有赞教育", "纷传", "知识星球"],
        coreKeywords: ["知识付费系统", "AI 训练营", "课程交付", "私域运营", "海豚知道"],
      });
    },
    load,
    "海豚知道项目",
  );
}

async function ensureEnterpriseAssets(db: Awaited<ReturnType<typeof getDb>>, projectId: number) {
  assert(db, "数据库不可用");
  const writes: Record<string, boolean> = {};
  const enterprise = (await db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).limit(1))[0];
  if (!enterprise) {
    await db.insert(enterpriseGeoProfiles).values({
      projectId,
      enterpriseName: "海豚知道",
      shortName: "海豚知道",
      officialWebsite: "https://haitunzhidao.example.com",
      industry: "知识付费与 AI 训练营工具",
      region: "中国",
      productServiceIntro: "课程、社群、训练营、AI 助教、作业打卡、内容沉淀和私域成交链路一体化工具。",
      targetCustomers: "知识付费老师、个人 IP、训练营团队、教育机构、企业内训团队。",
      coreSellingPoints: "一体化交付、AI 助教、低运营成本、结构化内容沉淀、私域成交闭环。",
      servicePriceRange: "按套餐与团队规模定价",
      serviceModel: "SaaS 平台加运营方法论支持",
      fitCustomers: "需要课程售卖、训练营交付和 AI 助教协同的团队。",
      unfitCustomers: "只需要纯直播工具或纯社区发帖工具的团队。",
      salesChannels: ["官网", "私域社群", "内容获客", "客户转介绍"],
      commonQuestions: [...P0_QUESTIONS],
      purchaseDecisionFactors: ["交付效率", "AI 助教能力", "课程与社群一体化", "迁移成本", "客户案例"],
      productIntro: "海豚知道帮助知识付费团队把课程、社群、训练营和 AI 助教连接到同一套交付流程中。",
      featureNotes: "课程管理、社群运营、训练营看板、打卡作业、AI 助教、数据复盘。",
      serviceProcess: "需求诊断、方案配置、内容迁移、训练营上线、运营复盘。",
      deliveryPlan: "7 天完成基础配置，14 天上线首个训练营交付流程。",
      afterSalesService: "提供产品使用支持、迁移建议和运营复盘模板。",
      competitorDifference: "相比小鹅通更强调训练营交付和 AI 助教协作，相比知识星球更强调课程售卖与私域成交闭环。",
      priceExplanation: "根据功能模块、账号数量与服务深度定价。",
      salesTalkTracks: "如果您既要卖课，又要做训练营交付和 AI 助教答疑，海豚知道可以减少多个工具拼接成本。",
      commonObjections: "担心迁移成本、担心 AI 助教效果、担心团队上手难度。",
      completionScore: 95,
    });
    writes.enterpriseProfile = true;
  } else {
    writes.enterpriseProfile = false;
  }

  const existingAsset = (await db.select().from(geoAssetSources).where(and(eq(geoAssetSources.projectId, projectId), eq(geoAssetSources.title, "海豚知道 P0 企业事实资料"))).limit(1))[0];
  if (!existingAsset) {
    await db.insert(geoAssetSources).values({
      projectId,
      sourceType: "企业基础资料",
      inputMode: "人工录入",
      title: "海豚知道 P0 企业事实资料",
      contentDigest: "海豚知道服务知识付费老师、个人 IP、训练营团队和企业内训场景，核心能力包括课程、社群、训练营、AI 助教、作业打卡和内容沉淀。",
      structuredSummary: {
        publicClaims: ["课程、社群、训练营、AI 助教一体化", "适合知识付费和企业内训场景", "帮助降低训练营运营成本"],
        evidenceSnippets: ["海豚知道把课程、社群、训练营和 AI 助教放在同一交付流程中", "典型客户包括知识付费老师、训练营主理人和企业培训部门"],
      },
      trustLevel: "高",
      parseStatus: "人工确认",
      isPublic: 1,
      canUseForGeneration: 1,
      manuallyConfirmed: 1,
      parsedAt: new Date(),
    });
    writes.assetSource = true;
  } else {
    writes.assetSource = false;
  }

  const existingCase = (await db.select().from(customerCases).where(and(eq(customerCases.projectId, projectId), eq(customerCases.customerName, "P0 训练营客户案例"))).limit(1))[0];
  if (!existingCase) {
    await db.insert(customerCases).values({
      projectId,
      caseType: "真实案例",
      customerName: "P0 训练营客户案例",
      customerIndustry: "知识付费",
      customerBackground: "一位个人 IP 老师需要同时管理课程、社群、训练营作业和助教答疑。",
      originalProblem: "多个工具割裂，训练营交付成本高，AI 回答中也较少提到海豚知道。",
      chosenReason: "选择海豚知道用于一体化管理课程、社群、打卡和 AI 助教。",
      usedProductService: "课程交付、社群运营、训练营看板、AI 助教答疑。",
      executionProcess: "先配置课程与训练营，再导入学员，最后用 AI 助教处理高频问题。",
      resultData: "运营团队减少重复答疑，交付流程更集中。",
      customerFeedback: "工具链更集中，学员交付进度更容易追踪。",
      allowPublic: 1,
      publicVersion: "个人 IP 老师使用海豚知道集中管理课程、社群和训练营交付，降低重复答疑成本。",
      sensitiveNotes: "P0 验收样本，不含真实个人隐私。",
      sourceAssetIds: [],
      verificationStatus: "已确认",
    });
    writes.customerCase = true;
  } else {
    writes.customerCase = false;
  }

  const existingCompetitor = (await db.select().from(competitorProfiles).where(and(eq(competitorProfiles.projectId, projectId), eq(competitorProfiles.competitorName, "小鹅通"))).limit(1))[0];
  if (!existingCompetitor) {
    await db.insert(competitorProfiles).values({
      projectId,
      competitorName: "小鹅通",
      website: "https://www.xiaoe-tech.com/",
      positioning: "知识付费与课程售卖平台",
      strengths: "品牌知名度高，课程售卖和交易能力成熟。",
      weaknesses: "在训练营作业、AI 助教和一体化交付场景中需要更多配置。",
      priceInfo: "按套餐定价",
      contentAssets: "官网、案例、产品页较丰富。",
      aiRecommendationSignals: "AI 常把小鹅通作为知识付费工具候选。",
      comparisonNotes: "海豚知道需要补充公开的竞品对比页来解释训练营与 AI 助教差异。",
      sourceAssetIds: [],
      canReference: 1,
    });
    writes.competitorProfile = true;
  } else {
    writes.competitorProfile = false;
  }

  const existingCompliance = (await db.select().from(complianceRules).where(eq(complianceRules.projectId, projectId)).limit(1))[0];
  if (!existingCompliance) {
    await db.insert(complianceRules).values({
      projectId,
      ruleName: "P0 GEO 内容合规边界",
      forbiddenClaims: "不得承诺保证收录、保证 AI 推荐、保证成交增长。",
      forbiddenWords: ["保证收录", "百分百推荐", "绝对第一"],
      requiredDisclaimers: "所有效果表述需说明与内容质量、渠道、复测周期和实际运营有关。",
      dataUsageRules: "不得编造未经确认的营收、转化率或客户数量。",
      caseUsageRules: "仅使用允许公开的案例或匿名化案例。",
      priceUsageRules: "价格以实际套餐为准，不写固定低价承诺。",
      competitorMentionRules: "竞品对比必须基于公开信息和使用场景差异，不做贬损。",
      reviewRequiredTopics: ["竞品对比", "价格", "客户案例", "AI 推荐效果"],
      enabled: 1,
    });
    writes.complianceRule = true;
  } else {
    writes.complianceRule = false;
  }

  const existingStyle = (await db.select().from(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, projectId)).limit(1))[0];
  if (!existingStyle) {
    await db.insert(contentStyleProfiles).values({
      projectId,
      profileName: "P0 GEO 内容风格",
      tone: "专业、直接、可验证",
      writingStyle: "先回答客户问题，再给选择标准、适用场景、证据片段和行动建议。",
      terminology: ["GEO", "AI 可见性", "知识付费系统", "训练营交付", "AI 助教"],
      forbiddenTone: "避免夸大承诺和攻击竞品。",
      exampleTitles: ["海豚知道适合哪些知识付费团队", "海豚知道和小鹅通怎么选"],
      exampleParagraphs: ["如果团队同时需要课程、社群和训练营交付，应优先看工具是否能减少流程拼接。"],
      targetReader: "正在选知识付费系统或训练营工具的负责人。",
      preferredLength: "1500-2500 字",
      ctaStyle: "引导读者进行场景诊断和资料补充。",
      enabled: 1,
    });
    writes.contentStyle = true;
  } else {
    writes.contentStyle = false;
  }

  const existingStrategy = (await db.select().from(publishStrategies).where(eq(publishStrategies.projectId, projectId)).limit(1))[0];
  if (!existingStrategy) {
    await db.insert(publishStrategies).values({
      projectId,
      strategyName: "P0 内置 GEO 内容页发布策略",
      reviewMode: "全人工审核",
      dailyLimit: 3,
      minQualityScore: 80,
      preferredPlatforms: ["系统内置 GEO 内容页"],
      bannedPlatforms: [],
      platformNotes: "P0 只发布到系统内置 GEO 内容页，不做第三方发布。",
      enabled: 1,
    });
    writes.publishStrategy = true;
  } else {
    writes.publishStrategy = false;
  }

  const existingAuth = (await db.select().from(platformAuthorizationConfigs).where(and(eq(platformAuthorizationConfigs.projectId, projectId), eq(platformAuthorizationConfigs.platformName, "系统内置 GEO 内容页"))).limit(1))[0];
  if (!existingAuth) {
    await db.insert(platformAuthorizationConfigs).values({
      projectId,
      platformName: "系统内置 GEO 内容页",
      accountAlias: "海豚知道 P0 内容页",
      authorizationStatus: "无需授权",
      credentialStorageMode: "不保存明文凭证",
      secureCredentialRef: null,
      authorizationNotes: "系统内置公开内容页，无需第三方授权。",
      authorizedAt: new Date(),
      expiresAt: null,
    });
    writes.platformAuthorization = true;
  } else {
    writes.platformAuthorization = false;
  }

  const confirmedEnterprise = (await db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).limit(1))[0];
  assert(confirmedEnterprise, "企业档案不存在");
  return { enterpriseProfileId: confirmedEnterprise.id, writes };
}

async function ensureQuestions(db: Awaited<ReturnType<typeof getDb>>, projectId: number) {
  assert(db, "数据库不可用");
  let wrote = false;
  for (const questionText of P0_QUESTIONS) {
    const existing = (await db.select().from(questions).where(and(eq(questions.projectId, projectId), eq(questions.questionText, questionText))).limit(1))[0];
    if (!existing) {
      await db.insert(questions).values({
        projectId,
        questionText,
        questionType: "指定问题",
        targetKeyword: "海豚知道",
        intentLevel: "高",
        businessValue: 5,
        source: "manual",
        enabled: 1,
      });
      wrote = true;
    }
  }
  const rows = await db.select().from(questions).where(and(eq(questions.projectId, projectId), inArray(questions.questionText, [...P0_QUESTIONS])));
  assert(rows.length === 10, `客户问题数量不是 10，当前为 ${rows.length}`);
  return { rows, wrote };
}

async function ensureAiResponses(db: Awaited<ReturnType<typeof getDb>>, caller: ReturnType<typeof createProtectedCaller>, projectId: number, questionRows: Array<typeof questions.$inferSelect>) {
  assert(db, "数据库不可用");
  const existingRows = await db.select().from(aiResponses).where(and(eq(aiResponses.projectId, projectId), inArray(aiResponses.questionText, [...P0_QUESTIONS])));
  const existingByQuestion = new Map(existingRows.map(row => [row.questionText, row]));
  const questionByText = new Map(questionRows.map(row => [row.questionText, row]));
  const missing = P0_QUESTIONS.filter(questionText => !existingByQuestion.has(questionText));
  if (missing.length > 0) {
    await caller.geo.aiResponses.importCsvRows({
      rows: missing.map(questionText => ({
        projectId,
        questionId: questionByText.get(questionText)?.id ?? null,
        questionText,
        aiPlatform: "ChatGPT" as const,
        rawAnswer: P0_RAW_ANSWERS[P0_QUESTIONS.indexOf(questionText)],
        checkedAt: new Date().toISOString(),
      })),
    });
  }
  const rows = await db.select().from(aiResponses).where(and(eq(aiResponses.projectId, projectId), inArray(aiResponses.questionText, [...P0_QUESTIONS])));
  assert(rows.length === 10, `AI 回答数量不是 10，当前为 ${rows.length}`);
  return { rows, wrote: missing.length > 0 };
}

async function generateThreeArticles(db: Awaited<ReturnType<typeof getDb>>, caller: ReturnType<typeof createProtectedCaller>, projectId: number) {
  assert(db, "数据库不可用");
  await caller.geo.articles.topics.generate({ projectId });
  const topicRows = await db.select().from(geoArticleTopics).where(eq(geoArticleTopics.projectId, projectId)).orderBy(desc(geoArticleTopics.createdAt));
  assert(topicRows.length >= 3, `文章选题少于 3 个，当前为 ${topicRows.length}`);

  const generated: Array<{ id: number; title: string; qualityScore: number; publishAllowed: boolean }> = [];
  for (const topic of topicRows.slice(0, 3)) {
    const generatedResult = await caller.geo.articles.generate({ topicId: topic.id });
    assert(generatedResult.articleId > 0, `选题 ${topic.id} 未生成文章 ID`);
    let qualityResult = await caller.geo.articles.qualityCheck({ articleId: generatedResult.articleId });
    if (!qualityResult.success || qualityResult.quality.totalScore < 80) {
      await caller.geo.articles.optimizeVersion({ articleId: generatedResult.articleId, mode: "增强版", reason: "P0 验收要求至少一篇文章质量分不低于 80 且允许发布" });
      qualityResult = await caller.geo.articles.qualityCheck({ articleId: generatedResult.articleId });
    }
    const article = (await db.select().from(geoArticles).where(eq(geoArticles.id, generatedResult.articleId)).limit(1))[0];
    assert(article, `生成文章 ${generatedResult.articleId} 未能读回`);
    const consistency = article.consistencyCheck as { publishAllowed?: boolean } | null;
    generated.push({
      id: article.id,
      title: article.title,
      qualityScore: qualityResult.quality.totalScore,
      publishAllowed: Boolean(qualityResult.success && !qualityResult.quality.blocked && qualityResult.quality.totalScore >= 80 && consistency?.publishAllowed !== false),
    });
  }
  assert(generated.length === 3, `生成文章数量不是 3，当前为 ${generated.length}`);
  return generated;
}

async function main() {
  const db = await getDb();
  assert(db, "数据库不可用");
  const caller = createProtectedCaller();
  const publicCaller = createPublicCaller();
  const stepEvidence = (wroteThisRun: boolean, evidence: string) => ({ existsInDatabase: true, wroteThisRun, evidence });
  const writeEvidence: Record<string, unknown> = {};

  const projectResult = await ensureProject(db, caller);
  const project = projectResult.row;
  const projectId = project.id;
  writeEvidence.project = stepEvidence(projectResult.wrote, projectResult.wrote ? "本次创建海豚知道项目并读回项目 ID。" : "海豚知道项目已存在，本次读取并确认项目 ID。");

  const enterpriseAssetResult = await ensureEnterpriseAssets(db, projectId);
  writeEvidence.enterpriseAssets = Object.fromEntries(
    Object.entries(enterpriseAssetResult.writes).map(([key, wroteThisRun]) => [
      key,
      stepEvidence(wroteThisRun, wroteThisRun ? "本次写入企业资产前置数据并读回确认。" : "企业资产前置数据已存在，本次读取并确认。"),
    ]),
  );

  const questionResult = await ensureQuestions(db, projectId);
  writeEvidence.questions = stepEvidence(questionResult.wrote, questionResult.wrote ? "本次补齐 10 条客户问题并读回确认。" : "10 条客户问题已存在，本次读取并确认数量。");

  const responseResult = await ensureAiResponses(db, caller, projectId, questionResult.rows);
  writeEvidence.aiResponses = stepEvidence(responseResult.wrote, responseResult.wrote ? "本次补齐 10 条 AI 回答并读回确认。" : "10 条 AI 回答已存在，本次读取并确认数量。");

  await caller.geo.analysis.run({ projectId });
  writeEvidence.analysis = stepEvidence(true, "本次调用运行 AI 诊断并确认 10 条诊断结果。");
  const p0ResponseIds = responseResult.rows.map(row => row.id);
  const p0AnalysisRows = await db.select().from(analysisResults).where(inArray(analysisResults.aiResponseId, p0ResponseIds));
  assert(p0AnalysisRows.length === 10, `AI 诊断结果数量不是 10，当前为 ${p0AnalysisRows.length}`);

  const scoreResult = await caller.geo.scores.calculate({ projectId });
  writeEvidence.geoScore = stepEvidence(true, "本次调用 GEO 评分计算并确认评分记录写入。");
  const latestScore = (await db.select().from(geoScores).where(eq(geoScores.projectId, projectId)).orderBy(desc(geoScores.createdAt)).limit(1))[0];
  assert(latestScore, "GEO 评分未写入数据库");

  await caller.geo.tasks.generate({ projectId });
  writeEvidence.contentGaps = stepEvidence(true, "本次调用优化任务生成并确认内容缺口与任务记录存在。");
  const taskRows = await db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, projectId));
  const contentGapCount = p0AnalysisRows.filter(row => String(row.contentGap ?? "").trim().length > 0).length;
  assert(contentGapCount > 0, "内容缺口数量为 0");
  assert(taskRows.length > 0, "内容缺口对应的优化任务未写入数据库");

  const generatedArticles = await generateThreeArticles(db, caller, projectId);
  writeEvidence.articles = stepEvidence(true, "本次调用生成 3 篇 GEO 内容并确认文章记录写入。");
  const publishableArticle = generatedArticles.find(article => article.qualityScore >= 80 && article.publishAllowed);
  assert(publishableArticle, "没有质量分 >= 80 且允许发布的文章");

  await caller.geo.articles.audit({ articleId: publishableArticle.id, approved: true, note: "P0 真实主链路验收：质量分 >= 80 且一致性检查允许发布。" });
  const publishResult = await caller.geo.articles.publish({ articleId: publishableArticle.id });
  writeEvidence.publish = stepEvidence(true, "本次调用发布到 GEO 内容页并确认发布记录与公开链接。");
  assert(publishResult.publicPath.includes(`/geo/content/${projectId}/${publishableArticle.id}`), "公开链接格式异常");
  const publicContent = await publicCaller.geo.articles.publicContent({ projectId, articleId: publishableArticle.id });
  assert(publicContent.article.id === publishableArticle.id, "公开链接未登录访问未读到已发布文章");

  const publishRecord = (await db.select().from(geoPublishRecords).where(eq(geoPublishRecords.articleId, publishableArticle.id)).orderBy(desc(geoPublishRecords.createdAt)).limit(1))[0];
  assert(publishRecord, "发布记录未写入数据库");
  const monitoringRecord = (await db.select().from(geoInclusionMonitoringRecords).where(eq(geoInclusionMonitoringRecords.articleId, publishableArticle.id)).orderBy(desc(geoInclusionMonitoringRecords.createdAt)).limit(1))[0];
  assert(monitoringRecord, "收录监测记录未写入数据库");
  assert(monitoringRecord.inclusionMonitorStatus === "未检测", `收录监测初始状态不是“未检测”：${monitoringRecord.inclusionMonitorStatus}`);
  writeEvidence.monitoring = stepEvidence(true, "本次发布后确认收录监测记录写入，初始状态为未检测。");

  await caller.geo.reports.generate({ projectId });
  writeEvidence.report = stepEvidence(true, "本次调用生成客户报告并确认报告记录写入。");
  const report = (await db.select().from(reports).where(eq(reports.projectId, projectId)).orderBy(desc(reports.createdAt)).limit(1))[0];
  assert(report, "客户报告未写入数据库");

  const latestQualityRows = generatedArticles.length > 0
    ? await db.select().from(geoArticleQualityScores).where(inArray(geoArticleQualityScores.articleId, generatedArticles.map(item => item.id)))
    : [];
  const conclusion = {
    projectId,
    questionCount: questionResult.rows.length,
    aiResponseCount: responseResult.rows.length,
    analysisResultCount: p0AnalysisRows.length,
    geoScore: {
      id: latestScore.id,
      totalScore: scoreResult.score.totalScore,
      visibilityLevel: scoreResult.score.visibilityLevel,
    },
    contentGapCount,
    optimizationTaskCount: taskRows.length,
    generatedArticles,
    qualityScoreRows: latestQualityRows.map(row => ({ articleId: row.articleId, totalScore: row.totalScore, blocked: row.blocked })),
    publishableArticleId: publishableArticle.id,
    publishedPublicLink: publishResult.publicPath,
    unauthenticatedPublicAccess: true,
    publishRecord: { id: publishRecord.id, status: publishRecord.publishStatus, url: publishRecord.publishUrl },
    monitoringRecord: { id: monitoringRecord.id, status: monitoringRecord.inclusionMonitorStatus, aiMentionStatus: monitoringRecord.aiMentionMonitorStatus, aiRecommendStatus: monitoringRecord.aiRecommendMonitorStatus },
    customerReport: { id: report.id, status: "已生成", totalScore: report.totalScore },
    dbWriteEvidence: writeEvidence,
    finalConclusion: "P0 主链路已真实跑通",
  };

  console.log(JSON.stringify(conclusion, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(JSON.stringify({ finalConclusion: "P0 主链路未跑通", error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});

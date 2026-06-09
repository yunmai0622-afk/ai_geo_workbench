import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import {
  aiResponses,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  projects,
} from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const databaseUrl = process.env.DATABASE_URL;
const provider = process.env.LLM_PROVIDER ?? "openai";
const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiBaseUrl = process.env.OPENAI_BASE_URL;
const openAiModel = process.env.OPENAI_MODEL;

if (!databaseUrl) {
  console.error("[P0-3] DATABASE_URL is required for content generation acceptance.");
  process.exit(1);
}

if (!provider) {
  console.error("[P0-3] LLM_PROVIDER is required for content generation acceptance.");
  process.exit(2);
}

if (provider === "openai" && (!openAiApiKey || !openAiBaseUrl || !openAiModel)) {
  console.error("[P0-3] P0-3 needs a real OpenAI-compatible LLM environment.");
  console.error("[P0-3] OPENAI_API_KEY, OPENAI_BASE_URL and OPENAI_MODEL are required when LLM_PROVIDER=openai.");
  console.error("[P0-3] Current run did not execute real AI diagnosis.");
  process.exit(2);
}

if (provider !== "openai" && (!forgeApiUrl || !forgeApiKey)) {
  console.error("[P0-3] P0-3 needs a real Manus Forge LLM environment.");
  console.error("[P0-3] BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY are required when LLM_PROVIDER is not openai.");
  console.error("[P0-3] Current run did not execute real AI diagnosis.");
  process.exit(2);
}

const user = {
  id: 1,
  openId: "p0-content-generation-min-acceptance",
  role: "admin" as const,
  name: "P0 Content Generation Min Acceptance",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

type AcceptanceDb = Awaited<ReturnType<typeof getDb>>;

let acceptanceDb: AcceptanceDb = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createProtectedCaller() {
  return appRouter.createCaller({ user, req: {} as never, res: {} as never });
}

async function closeDatabase() {
  const client = (acceptanceDb as { $client?: { end?: () => Promise<unknown> | unknown } } | null)?.$client;
  if (client && typeof client.end === "function") {
    await client.end();
  }
}

async function countPublishRows(projectId: number) {
  const db = acceptanceDb;
  assert(db, "Database connection is not available.");
  const [publishRows, monitoringRows] = await Promise.all([
    db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId)),
    db.select().from(geoInclusionMonitoringRecords).where(eq(geoInclusionMonitoringRecords.projectId, projectId)),
  ]);
  return {
    publishRecordCount: publishRows.length,
    monitoringRecordCount: monitoringRows.length,
  };
}

async function seedAssetLibrary(caller: ReturnType<typeof createProtectedCaller>, projectId: number, enterpriseName: string) {
  await caller.geo.assetLibrary.upsertProfile({
    projectId,
    enterpriseName,
    shortName: "P0 内容生成",
    officialWebsite: "https://p0-content-generation.local",
    industry: "企业 AI 自动化与 GEO 优化",
    region: "中国",
    productServiceIntro: "面向中小企业提供 AI 自动化系统、客户运营工作台和 GEO 内容结构化服务。",
    targetCustomers: "需要从业务场景切入建设 AI 自动化和 AI 搜索可见度的中小企业。",
    coreSellingPoints: "业务场景理解、自动化流程设计、GEO 内容结构化、真实诊断到内容生成闭环。",
    servicePriceRange: "以客户需求和合同确认为准",
    serviceModel: "诊断、方案设计、系统实施、内容结构化和复测建议。",
    fitCustomers: "已有明确业务场景、愿意提供真实资料和人工审核内容的企业。",
    unfitCustomers: "希望承诺保证排名、保证收录或无需人工确认事实的企业。",
    salesChannels: ["官网", "人工顾问", "内容页"],
    commonQuestions: ["企业做 GEO 优化应该从哪里开始？", "AI 自动化服务如何选择供应商？"],
    purchaseDecisionFactors: ["业务场景理解", "交付经验", "资料真实可引用", "复测闭环"],
    productIntro: "AI 自动化系统和企业 AI 品牌经营系统。",
    featureNotes: "品牌说明/特征备注：强调真实资料、人工审核和不承诺绝对排名。",
    serviceProcess: "企业资料整理、AI 诊断、优化任务、内容生成、质检和人工审核。",
    deliveryPlan: "按项目阶段交付诊断结果、文章草稿和质检记录。",
    afterSalesService: "提供复测建议和内容优化建议。",
    competitorDifference: "核心优势/差异化：从真实业务诊断和资料库出发生成可追溯内容。",
    priceExplanation: "价格需结合客户范围和合同确认。",
    salesTalkTracks: "先确认真实场景和资料，再判断是否适合进入 GEO 内容生成。",
    commonObjections: "不能承诺保证收录、保证推荐或替代人工审核。",
  });

  const enterpriseAsset = await caller.geo.assetLibrary.addTextSource({
    projectId,
    sourceType: "企业基础资料",
    inputMode: "文本粘贴",
    title: `${enterpriseName} 企业基础资料`,
    contentDigest: `${enterpriseName} 服务中小企业，提供 AI 自动化系统、客户运营工作台和 GEO 优化服务。资料允许用于公开内容生成。`,
    trustLevel: "高",
    isPublic: true,
    canUseForGeneration: true,
    manuallyConfirmed: true,
  });

  await caller.geo.assetLibrary.addTextSource({
    projectId,
    sourceType: "产品服务资料",
    inputMode: "文本粘贴",
    title: `${enterpriseName} 产品服务资料`,
    contentDigest: "产品覆盖业务流程梳理、AI 助手配置、知识库沉淀、GEO 内容结构化和复测建议。资料已人工确认，可公开引用。",
    trustLevel: "高",
    isPublic: true,
    canUseForGeneration: true,
    manuallyConfirmed: true,
  });

  await caller.geo.assetLibrary.createCustomerCase({
    projectId,
    caseType: "真实案例",
    customerName: "P0 内容生成验收客户",
    customerIndustry: "知识服务与企业培训",
    customerBackground: "客户需要把课程资料、客户问答和运营流程整理为可复用知识库。",
    originalProblem: "客户问答重复、资料分散，AI 难以稳定理解企业服务边界。",
    chosenReason: "选择该服务是因为其能从业务流程、知识库和 GEO 内容结构化同时切入。",
    usedProductService: "AI 自动化系统和 GEO 内容结构化服务。",
    executionProcess: "先整理资料，再生成诊断和内容草稿，最后由人工审核。",
    resultData: "验收样本仅确认链路可用，不作为业务效果承诺。",
    customerFeedback: "内容结构更清晰，便于后续人工复核和复测。",
    allowPublic: true,
    publicVersion: "P0 内容生成验收客户允许以匿名方式说明资料整理和人工审核流程。",
    sensitiveNotes: "不包含敏感信息。",
    sourceAssetIds: [enterpriseAsset.id],
    verificationStatus: "已确认",
  });

  await caller.geo.assetLibrary.createCompetitor({
    projectId,
    competitorName: "通用自动化工具",
    website: "https://competitor.example.invalid",
    positioning: "提供通用流程自动化能力。",
    strengths: "工具生态成熟，上手门槛低。",
    weaknesses: "对企业 GEO 诊断和内容生成依据追溯支持不足。",
    priceInfo: "以公开报价或合同确认为准。",
    contentAssets: "官网产品页和帮助中心资料较多。",
    aiRecommendationSignals: "AI 可能因为通用自动化关键词和公开文档更容易提到该类工具。",
    comparisonNotes: "对比时只做客观差异说明，不攻击竞品。",
    sourceAssetIds: [],
    canReference: true,
  });

  await caller.geo.assetLibrary.createComplianceRule({
    projectId,
    ruleName: "P0 内容生成合规规则",
    forbiddenClaims: "不得承诺保证收录、保证排名、一定推荐、百分百效果。",
    forbiddenWords: ["保证排名", "保证收录", "一定推荐", "百分百"],
    requiredDisclaimers: "所有诊断和内容建议都需保留人工审核和真实复测口径。",
    dataUsageRules: "不得编造数据，价格和结果需以客户确认资料为准。",
    caseUsageRules: "客户案例必须来自已确认资料，未确认时应标注资料待补充。",
    priceUsageRules: "价格仅能描述为以合同或客户确认为准。",
    competitorMentionRules: "竞品描述必须客观，不得攻击竞品。",
    reviewRequiredTopics: ["价格", "客户案例", "竞品对比"],
    enabled: true,
  });

  await caller.geo.assetLibrary.createStyleProfile({
    projectId,
    profileName: "P0 内容生成风格",
    tone: "专业、克制、可验证",
    writingStyle: "先回答真实问题，再说明依据、边界、风险和后续复测建议。",
    terminology: ["GEO", "AI 搜索可见度", "诊断依据", "人工审核"],
    forbiddenTone: "避免夸大承诺、攻击竞品或替代人工审核。",
    exampleTitles: [`${enterpriseName}如何补齐 AI 可引用内容`],
    exampleParagraphs: ["本文基于真实诊断和企业资料整理，不承诺任何平台的绝对排名结果。"],
    targetReader: "企业负责人、市场负责人和内容运营负责人。",
    preferredLength: "2000-4000 字",
    ctaStyle: "建议补充真实资料并进行人工复核。",
    enabled: true,
  });

  await caller.geo.assetLibrary.createPublishStrategy({
    projectId,
    strategyName: "P0 内容生成发布策略",
    reviewMode: "全人工审核",
    dailyLimit: 1,
    minQualityScore: 80,
    preferredPlatforms: ["系统内置 GEO 内容页"],
    bannedPlatforms: [],
    platformNotes: "本脚本只验证内容生成和质检，不调用 audit/publish。",
    enabled: true,
  });
}

async function main() {
  const db = await getDb();
  acceptanceDb = db;
  assert(db, "Database connection is not available.");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const enterpriseName = `P0 内容生成最小验收 ${timestamp}`;
  const caller = createProtectedCaller();

  await caller.geo.projects.create({
    enterpriseName,
    industry: "企业 AI 自动化与 GEO 优化",
    website: "https://p0-content-generation.local",
    region: "中国",
    productIntro: "面向中小企业的 AI 自动化系统、客户运营和 GEO 优化服务。",
    targetCustomers: "需要从业务场景切入建设 AI 自动化和 AI 搜索可见度的中小企业。",
    coreSellingPoints: "业务场景理解、自动化流程设计、GEO 内容结构化、真实诊断到内容生成闭环。",
    competitorNames: ["通用自动化工具", "传统 SEO 服务商"],
    coreKeywords: ["企业 AI 自动化", "GEO 优化", "AI 搜索可见度"],
  });

  const project = (
    await db
      .select()
      .from(projects)
      .where(eq(projects.enterpriseName, enterpriseName))
      .orderBy(desc(projects.createdAt))
      .limit(1)
  )[0];
  assert(project, "Created project was not found in database.");
  assert(project.id > 0, "projectId is missing.");

  await seedAssetLibrary(caller, project.id, enterpriseName);

  const questionTexts = [
    "做企业 AI 自动化系统，哪家公司适合服务中小企业？",
    "企业做 GEO 优化应该从哪里开始？",
  ];
  const questionResult = await caller.geo.questions.batchAddSpecified({
    projectId: project.id,
    questions: questionTexts,
  });
  assert(questionResult.success, "Specified questions were not created.");

  const responseInputs = [
    {
      projectId: project.id,
      questionId: null,
      questionText: questionTexts[0],
      aiPlatform: "ChatGPT" as const,
      rawAnswer: `中小企业可以选择具备业务场景理解、自动化流程设计和系统交付能力的服务商。${enterpriseName}在客户运营、知识库沉淀和 GEO 内容结构化方面有积累，但公开资料还需要补充更多案例和竞品对比。通用自动化工具也可作为基础方案参考。`,
      checkedAt: new Date().toISOString(),
    },
    {
      projectId: project.id,
      questionId: null,
      questionText: questionTexts[1],
      aiPlatform: "Kimi" as const,
      rawAnswer: "企业应先梳理品牌实体、核心产品、客户案例、竞品差异和高频用户问题，再围绕 AI 搜索可能引用的内容进行结构化建设。传统 SEO 服务商通常更关注搜索引擎页面优化，GEO 还需要补充 AI 可引用的问答、证据和复测路径。",
      checkedAt: new Date().toISOString(),
    },
  ];

  const importResult = await caller.geo.aiResponses.importCsvRows({ rows: responseInputs });
  assert(importResult.success, "AI responses import did not report success.");

  const writtenResponses = await db.select().from(aiResponses).where(eq(aiResponses.projectId, project.id));
  assert(writtenResponses.length >= responseInputs.length, "AI responses were not written to database.");

  const beforePublishCounts = await countPublishRows(project.id);

  const analysisRunResult = await caller.geo.analysis.run({ projectId: project.id });
  assert(analysisRunResult.success, "analysis.run did not report success.");
  const analyses = await caller.geo.analysis.list({ projectId: project.id });
  assert(analyses.length >= 2, `analysis_results count should be >= 2, actual=${analyses.length}`);

  const taskResult = await caller.geo.tasks.generate({ projectId: project.id });
  assert(taskResult.success, "tasks.generate did not report success.");
  const tasks = await caller.geo.tasks.list({ projectId: project.id });
  assert(tasks.length >= 1, `optimization_tasks count should be >= 1, actual=${tasks.length}`);

  const topicResult = await caller.geo.articles.topics.generate({ projectId: project.id });
  assert(topicResult.success, "articles.topics.generate did not report success.");
  const topics = await caller.geo.articles.topics.list({ projectId: project.id });
  assert(topics.length >= 1, `geo_article_topics count should be >= 1, actual=${topics.length}`);

  const selectedTopic = topics[0];
  assert(selectedTopic, "No topic was available for article generation.");
  const articleResult = await caller.geo.articles.generate({ topicId: selectedTopic.id });
  assert(articleResult.success, "articles.generate did not report success.");
  assert(articleResult.articleId > 0, "articles.generate did not return articleId.");

  const articles = await caller.geo.articles.list({ projectId: project.id });
  assert(articles.length >= 1, `geo_articles count should be >= 1, actual=${articles.length}`);
  const article = articles.find(item => item.id === articleResult.articleId);
  assert(article, `Generated article ${articleResult.articleId} was not found in articles.list.`);
  assert(typeof article.title === "string" && article.title.trim().length > 0, "Generated article title is empty.");
  assert(typeof article.markdownContent === "string" && article.markdownContent.trim().length > 0, "Generated article content is empty.");
  assert(article.topicId === selectedTopic.id, `Generated article topicId mismatch. expected=${selectedTopic.id} actual=${article.topicId}`);

  const generationBasis = (article.generationBasis ?? {}) as {
    contentGap?: unknown;
    optimizationTask?: unknown;
    optimizationTaskId?: unknown;
    assetLibraryUsage?: { enterpriseMaterials?: unknown[] };
  };
  assert(typeof generationBasis.contentGap === "string" && generationBasis.contentGap.trim().length > 0, "Article generation basis is missing diagnostic content gap.");
  assert(
    typeof generationBasis.optimizationTask === "string" && generationBasis.optimizationTask.trim().length > 0 ||
      typeof generationBasis.optimizationTaskId === "number",
    "Article generation basis is missing optimization task trace.",
  );
  assert(
    Array.isArray(generationBasis.assetLibraryUsage?.enterpriseMaterials) &&
      generationBasis.assetLibraryUsage.enterpriseMaterials.length > 0,
    "Article generation basis is missing enterprise asset trace.",
  );

  const qualityResult = await caller.geo.articles.qualityCheck({ articleId: article.id });
  assert("quality" in qualityResult, "qualityCheck did not return quality.");
  assert(typeof qualityResult.quality.totalScore === "number", "qualityCheck did not return totalScore.");

  const qualityScores = await caller.geo.articles.latestQualityScores({ projectId: project.id });
  const qualityScore = qualityScores.find(item => item.articleId === article.id);
  assert(qualityScore, "latestQualityScores did not return score for generated article.");
  assert(typeof qualityScore.totalScore === "number", "Persisted quality score is missing totalScore.");

  const afterPublishCounts = await countPublishRows(project.id);
  assert(afterPublishCounts.publishRecordCount === beforePublishCounts.publishRecordCount, "P0-3 must not write geo_publish_records.");
  assert(afterPublishCounts.monitoringRecordCount === beforePublishCounts.monitoringRecordCount, "P0-3 must not write geo_inclusion_monitoring_records.");

  console.log(JSON.stringify({
    success: true,
    projectId: project.id,
    aiResponseCount: writtenResponses.length,
    analysisCount: analyses.length,
    taskCount: tasks.length,
    topicCount: topics.length,
    articleCount: articles.length,
    selectedTopicId: selectedTopic.id,
    articleId: article.id,
    articleTitle: article.title,
    articleMarkdownLength: article.markdownContent.length,
    qualityScore: {
      articleId: qualityScore.articleId,
      totalScore: qualityScore.totalScore,
      problemMatchScore: qualityScore.problemMatchScore,
      evidenceScore: qualityScore.evidenceScore,
      structureScore: qualityScore.structureScore,
      geoCitableScore: qualityScore.geoCitableScore,
      complianceScore: qualityScore.complianceScore,
      blocked: Boolean(qualityScore.blocked),
    },
    generationBasisTrace: {
      hasEnterpriseMaterials: generationBasis.assetLibraryUsage.enterpriseMaterials.length > 0,
      hasDiagnosticContentGap: true,
      hasOptimizationTask: true,
    },
    auditOrPublishTriggered: false,
    publishRecordCount: afterPublishCounts.publishRecordCount,
    monitoringRecordCount: afterPublishCounts.monitoringRecordCount,
  }, null, 2));
}

main().catch(error => {
  console.error("[P0-3] Content generation min acceptance failed:");
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await closeDatabase();
  } catch (error) {
    console.error("[P0-3] Failed to close database connection:");
    console.error(error);
    process.exitCode = process.exitCode || 1;
  }
});

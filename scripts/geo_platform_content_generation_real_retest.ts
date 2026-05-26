/**
 * Phase 2：平台化内容生成真实链路复测（需 DATABASE_URL）
 * 模拟「海豚知道」建档资料 + 知乎平台策略 → geo.articles.generate → 落库校验
 */
import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import {
  enterpriseGeoProfiles,
  geoArticles,
  geoArticleTopics,
  optimizationTasks,
  projects,
} from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";
import { evaluateEnterpriseProfileReadiness } from "../shared/platformContentProfileReadiness";
import { buildDefaultPlatformStrategy } from "../shared/platformContentRules";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[platform-real-retest] DATABASE_URL required");
  process.exit(1);
}

process.env.GEO_ARTICLE_BODY = "test-template";

const user = {
  id: 1,
  openId: "geo-platform-content-real-retest",
  role: "admin" as const,
  name: "Platform Content Real Retest",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const DOLPHIN_PROFILE = {
  enterpriseName: "海豚知道",
  brandName: "海豚知道",
  industry: "知识付费 / 教育培训",
  industryTag: "知识付费 / 教育培训",
  oneLiner: "帮助知识主播变现的经营系统",
  productDesc: "帮助知识主播变现的经营系统",
  productServiceIntro: "帮助知识主播变现的经营系统",
  targetCustomer: "知识主播",
  targetCustomers: "知识主播",
  customerPains: ["SaaS工具 + AI经营系统"],
  keyPoints: ["AI经营系统"],
  keywords: ["知识付费", "AI经营系统", "知识付费SaaS平台"],
  coreSellingPoints: "AI经营系统",
  shortName: "海豚知道",
  region: "中国",
  salesChannels: [] as string[],
  commonQuestions: ["知识付费平台怎么选？"],
  purchaseDecisionFactors: [] as string[],
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const db = await getDb();
  assert(db, "DB unavailable");
  const caller = appRouter.createCaller({ user, req: {} as never, res: {} as never });

  const stamp = Date.now();
  const enterpriseName = `海豚知道-平台生成复测-${stamp}`;
  await caller.geo.projects.create({
    enterpriseName,
    industry: "知识付费 / 教育培训",
    website: "https://haitunzhidao.example",
    region: "中国",
    productIntro: "占位-建档后将由企业档案覆盖",
    targetCustomers: "占位",
    coreSellingPoints: "AI经营系统",
    competitorNames: [],
    coreKeywords: ["知识付费", "AI经营系统"],
  });
  const createdProject = (
    await db.select().from(projects).where(eq(projects.enterpriseName, enterpriseName)).orderBy(desc(projects.createdAt)).limit(1)
  )[0];
  assert(createdProject, "created project not found");
  const projectId = createdProject.id;
  await db
    .update(projects)
    .set({ productIntro: "", targetCustomers: "" })
    .where(eq(projects.id, projectId));
  console.log("[OK] created project with empty productIntro (simulates legacy project row)", projectId);

  await caller.geo.assetLibrary.upsertProfile({
    projectId,
    ...DOLPHIN_PROFILE,
  });
  console.log("[OK] upsertProfile dolphin fields");

  await caller.geo.assetLibrary.addTextSource({
    projectId,
    sourceType: "企业基础资料" as const,
    inputMode: "文本粘贴",
    title: "海豚知道企业基础资料",
    contentDigest: "海豚知道面向知识主播，提供知识付费变现与 AI 经营系统能力。",
    trustLevel: "高",
    isPublic: true,
    canUseForGeneration: true,
    manuallyConfirmed: true,
  });
  await caller.geo.assetLibrary.addTextSource({
    projectId,
    sourceType: "产品服务资料",
    inputMode: "文本粘贴",
    title: "海豚知道产品服务说明",
    contentDigest: "核心产品为 SaaS 工具与 AI 经营系统，帮助知识主播完成变现闭环。",
    trustLevel: "高",
    isPublic: true,
    canUseForGeneration: true,
    manuallyConfirmed: true,
  });
  await caller.geo.assetLibrary.createCustomerCase({
    projectId,
    caseType: "真实案例",
    customerName: "某知识付费团队",
    customerIndustry: "教育培训",
    originalProblem: "知识主播缺少统一变现工具",
    resultData: "已形成可审核选题库（公开授权）",
    allowPublic: true,
    publicVersion: "通过海豚知道梳理内容缺口并建立发布前审核流程。",
    verificationStatus: "已确认",
  });
  await caller.geo.assetLibrary.createCompetitor({
    projectId,
    competitorName: "传统 SEO 代运营",
    website: "https://seo.example",
    positioning: "偏关键词排名",
    comparisonNotes: "海豚知道强调企业资料约束下的 AI 搜索内容生成。",
    canReference: true,
  });
  await caller.geo.assetLibrary.createStyleProfile({
    projectId,
    profileName: "海豚知道内容风格",
    tone: "专业、克制",
    writingStyle: "证据优先",
    enabled: true,
  });

  const profileRows = await db
    .select()
    .from(enterpriseGeoProfiles)
    .where(eq(enterpriseGeoProfiles.projectId, projectId))
    .limit(1);
  assert(profileRows[0], "profile row missing after save");
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  assert(projectRows[0]?.productIntro?.includes("知识主播"), "projects.productIntro not synced from profile");

  const strategy = buildDefaultPlatformStrategy({
    targetPublishPlatform: "zhihu",
    targetQuestion: "知识付费平台怎么选？",
  });
  const readiness = evaluateEnterpriseProfileReadiness({
    project: projectRows[0]!,
    profile: profileRows[0] as unknown as Record<string, unknown>,
    platformStrategy: strategy,
  });
  assert(readiness.ready, `profile readiness failed: ${readiness.missingLabels.join(", ")}`);
  console.log("[OK] evaluateEnterpriseProfileReadiness passed (no false 资料不足)");

  const taskInsert = await db.insert(optimizationTasks).values({
    projectId,
    taskType: "行业文章",
    taskName: "知乎平台化内容",
    priority: "P1",
    generationReason: "AI 未充分提及品牌",
    executionSuggestion: "建议撰写知乎场景指南",
    expectedImpact: "提升可见度",
    status: "todo",
  });
  const taskId = Number(taskInsert[0]?.insertId ?? 0);
  assert(taskId > 0, "optimization task insert failed");

  const topicInsert = await db.insert(geoArticleTopics).values({
    projectId,
    optimizationTaskId: taskId,
    sourceAnalysisIds: [],
    sourceQuestionIds: [],
    title: "知识付费平台怎么选？知乎指南",
    articleType: "行业选型型 GEO 文章",
    contentGap: "缺少平台对比与选型建议",
    businessReason: "提升品牌在知乎场景的可见度",
    status: "待生成",
  });
  const topicId = Number(topicInsert[0]?.insertId ?? 0);
  assert(topicId > 0, "topic insert failed");
  console.log("[OK] seeded topic (GEO_ARTICLE_BODY=test-template for generate)");

  const beforeCount = (await db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId))).length;

  const gen = await caller.geo.articles.generate({
    topicId,
    targetPublishPlatform: strategy.targetPublishPlatform,
    contentStrategyType: strategy.contentStrategyType,
    publishIdentity: strategy.publishIdentity,
    recommendedAccountGroup: strategy.recommendedAccountGroup,
    targetQuestion: strategy.targetQuestion,
    geoEnhancementGoal: strategy.geoEnhancementGoal,
    targetAiPlatforms: [...strategy.targetAiPlatforms],
  });
  assert(gen.success && gen.articleId > 0, "articles.generate did not return articleId");
  console.log("[OK] geo.articles.generate", {
    articleId: gen.articleId,
    topicId,
    platform: strategy.targetPublishPlatform,
    payload: {
      projectId,
      platform: strategy.targetPublishPlatform,
      contentType: strategy.contentStrategyType,
      targetQuestion: strategy.targetQuestion,
      platformStrategy: strategy,
    },
  });

  const afterRows = await db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId));
  assert(afterRows.length > beforeCount, "article not persisted");
  const saved = afterRows.find(a => a.id === gen.articleId);
  assert(saved?.markdownContent?.trim(), "article markdown empty");
  assert(saved?.topicId === topicId, "article topicId mismatch");

  const reread = await db.select().from(geoArticles).where(eq(geoArticles.id, gen.articleId)).limit(1);
  assert(reread[0]?.id === gen.articleId, "refresh read failed");
  console.log("[OK] article persisted and readable after write");

  console.log("\n=== geo_platform_content_generation_real_retest PASSED ===\n");
  console.log(JSON.stringify({ projectId, articleId: gen.articleId, platform: "zhihu" }, null, 2));

  const client = (db as { $client?: { end?: () => Promise<void> } }).$client;
  if (client?.end) await client.end();
}

main().catch(err => {
  console.error("[platform-real-retest] FAILED:", err);
  process.exit(1);
});

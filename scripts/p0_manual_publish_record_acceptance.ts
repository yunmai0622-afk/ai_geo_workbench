import "dotenv/config";
import { eq } from "drizzle-orm";
import {
  geoArticleQualityScores,
  geoArticles,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  geoArticleTopics,
  optimizationTasks,
  projects,
} from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[P0-manual-publish-record] DATABASE_URL is required.");
  process.exit(1);
}

const user = {
  id: 1,
  openId: "p0-manual-publish-record-acceptance",
  role: "admin" as const,
  name: "P0 Manual Publish Record Acceptance",
  email: null,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

type AcceptanceDb = Awaited<ReturnType<typeof getDb>>;

let acceptanceDb: AcceptanceDb = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

async function countMonitoringRows(projectId: number) {
  const db = acceptanceDb;
  assert(db, "Database connection is not available.");
  const rows = await db.select().from(geoInclusionMonitoringRecords).where(eq(geoInclusionMonitoringRecords.projectId, projectId));
  return rows.length;
}

async function main() {
  const db = await getDb();
  acceptanceDb = db;
  assert(db, "Database connection is not available.");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const enterpriseName = `P0 人工发布记录验收 ${timestamp}`;
  const caller = createProtectedCaller();

  const insertedProject = await db.insert(projects).values({
    enterpriseName,
    industry: "企业 AI 自动化与 GEO 优化",
    website: "https://p0-manual-publish.local",
    region: "中国",
    productIntro: "面向企业的 AI 搜索可见度诊断和 GEO 内容增长服务。",
    targetCustomers: "需要持续建设 AI 可引用内容资产的企业。",
    coreSellingPoints: "真实诊断、内容计划、生成依据、质检和人工发布边界。",
    competitorNames: ["传统 SEO 服务商"],
    coreKeywords: ["GEO 人工发布记录", "AI 搜索可见度"],
  }).$returningId();
  const projectId = insertedProject[0]?.id;
  assert(projectId && projectId > 0, "Project fixture was not created.");

  const insertedTask = await db.insert(optimizationTasks).values({
    projectId,
    taskType: "FAQ",
    taskName: "补齐 AI 搜索常见问题内容",
    priority: "P0",
    generationReason: "AI 回答样本显示企业缺少可引用的问答内容。",
    executionSuggestion: "围绕高频客户问题生成 FAQ 问答页，并补充企业资料依据。",
    expectedImpact: "提升 AI 对企业服务边界和适配客户的理解。",
    status: "todo",
  }).$returningId();
  const taskId = insertedTask[0]?.id;
  assert(taskId && taskId > 0, "Optimization task fixture was not created.");

  const insertedTopic = await db.insert(geoArticleTopics).values({
    projectId,
    optimizationTaskId: taskId,
    sourceAnalysisIds: [],
    sourceQuestionIds: [],
    title: "企业 GEO 人工发布记录如何交付",
    articleType: "问答型 GEO 文章",
    targetKeyword: "GEO 人工发布记录",
    contentGap: "缺少人工发布后的证据沉淀。",
    businessReason: "需要把外部平台发布结果纳入客户交付报告。",
    outline: ["人工发布边界", "发布结果记录", "交付证据"],
    status: "已生成",
  }).$returningId();
  const topicId = insertedTopic[0]?.id;
  assert(topicId && topicId > 0, "Article topic fixture was not created.");

  const insertedArticle = await db.insert(geoArticles).values({
    projectId,
    topicId,
    optimizationTaskId: taskId,
    title: "企业 GEO 人工发布记录如何交付",
    articleType: "问答型 GEO 文章",
    markdownContent: "# 企业 GEO 人工发布记录如何交付\n\n本文用于验证人工发布记录闭环。内容已经完成 GEO 质检，等待人工发布记录回填。",
    generationBasis: { targetPlatform: "知乎", customerQuestion: "企业 GEO 内容发布后如何沉淀证据？" },
    citableSnippets: [{ quote: "人工发布记录用于沉淀公开链接和交付证据。", source: "验收夹具" }],
    thirdPartyMaterials: {},
    factTraceability: [],
    consistencyCheck: { publishAllowed: true, summary: "验收夹具允许发布记录。" },
    status: "待审核",
  }).$returningId();
  const articleId = insertedArticle[0]?.id;
  assert(articleId && articleId > 0, "Article fixture was not created.");

  await db.insert(geoArticleQualityScores).values({
    projectId,
    articleId,
    problemMatchScore: 90,
    evidenceScore: 88,
    structureScore: 90,
    originalityScore: 86,
    geoCitableScore: 90,
    complianceScore: 92,
    totalScore: 89,
    blocked: 0,
    blockReasons: [],
    reviewSummary: "内容通过 GEO 质检，可进入人工确认发布记录。",
  });

  const beforeMonitoringCount = await countMonitoringRows(projectId);

  const createInput = {
    projectId,
    articleId,
    publishPlatform: "知乎" as const,
    publishTitle: "企业 GEO 人工发布记录如何交付",
    publishUrl: "https://example.com/manual-publish-record",
    publishedAt: new Date().toISOString(),
    publishStatus: "published" as const,
    notes: "人工发布已完成，回填公开链接。",
  };
  const created = await caller.geo.articles.createManualPublishRecord(createInput);
  assert(created.success, "createManualPublishRecord did not report success.");
  assert(created.id > 0, "createManualPublishRecord did not return id.");

  const updateInput = {
    ...createInput,
    id: created.id,
    publishPlatform: "自有内容站 / 企业官网 GEO 页面" as const,
    publishTitle: "企业官网 GEO 人工发布记录交付说明",
    publishUrl: "https://example.com/geo/manual-publish-record-updated",
    publishStatus: "link_backfilled" as const,
    notes: "已回填官网公开链接，等待交付报告引用。",
  };
  const updated = await caller.geo.articles.updateManualPublishRecord(updateInput);
  assert(updated.success, "updateManualPublishRecord did not report success.");
  assert(updated.id === created.id, "updateManualPublishRecord returned unexpected id.");

  const records = await caller.geo.articles.publishRecords({ projectId });
  const record = records.find(item => item.id === created.id);
  assert(record, "publishRecords did not return saved manual publish record.");
  assert(record.articleId === articleId, "record articleId mismatch.");
  assert(record.projectId === projectId, "record projectId mismatch.");
  assert(record.publishChannel === updateInput.publishPlatform, "record publishChannel mismatch.");
  assert(record.publishTitle === updateInput.publishTitle, "record publishTitle mismatch.");
  assert(record.publishUrl === updateInput.publishUrl, "record publishUrl mismatch.");
  assert(record.publishStatus === updateInput.publishStatus, "record publishStatus mismatch.");
  assert(record.needRetest === 1, "record needRetest should be 1 for link_backfilled.");
  assert((record.notes ?? "").includes("不调用外部平台 API"), "record notes must preserve no external API boundary.");

  const dbRecordRows = await db.select().from(geoPublishRecords).where(eq(geoPublishRecords.id, created.id)).limit(1);
  assert(dbRecordRows[0], "Saved publish record was not found in database.");

  const afterMonitoringCount = await countMonitoringRows(projectId);
  assert(afterMonitoringCount === beforeMonitoringCount, "Manual publish record must not create inclusion monitoring rows.");

  console.log(JSON.stringify({
    success: true,
    projectId,
    articleId,
    publishRecordId: created.id,
    createMatched: true,
    updateMatched: true,
    readBackMatched: true,
    monitoringRowsBefore: beforeMonitoringCount,
    monitoringRowsAfter: afterMonitoringCount,
    didNotCreateMonitoringRecord: true,
    didNotCallExternalPublish: true,
  }, null, 2));
}

main().catch(error => {
  console.error("[P0-manual-publish-record] Manual publish record acceptance failed:");
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await closeDatabase();
  } catch (error) {
    console.error("[P0-manual-publish-record] Failed to close database connection:");
    console.error(error);
    process.exitCode = process.exitCode || 1;
  }
});

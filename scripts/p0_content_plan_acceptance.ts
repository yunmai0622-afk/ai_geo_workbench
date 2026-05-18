import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { contentPlanItems, contentPlans, optimizationTasks, projects } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[P0-content-plan] DATABASE_URL is required for content plan acceptance.");
  process.exit(1);
}

const user = {
  id: 1,
  openId: "p0-content-plan-acceptance",
  role: "admin" as const,
  name: "P0 Content Plan Acceptance",
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

async function main() {
  const db = await getDb();
  acceptanceDb = db;
  assert(db, "Database connection is not available.");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const enterpriseName = `P0 内容计划验收 ${timestamp}`;
  const caller = createProtectedCaller();

  await caller.geo.projects.create({
    enterpriseName,
    industry: "企业 AI 自动化与 GEO 优化",
    website: "https://p0-content-plan.local",
    region: "中国",
    productIntro: "面向企业的 AI 搜索可见度诊断和 GEO 内容增长服务。",
    targetCustomers: "需要持续建设 AI 可引用内容资产的企业。",
    coreSellingPoints: "真实诊断、内容计划、生成依据、质检和人工发布边界。",
    competitorNames: ["传统 SEO 服务商"],
    coreKeywords: ["GEO 内容计划", "AI 搜索可见度"],
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

  const insertedTask = await db.insert(optimizationTasks).values({
    projectId: project.id,
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

  const input = {
    projectId: project.id,
    planName: `P0 内容计划 ${timestamp}`,
    weekStartDate: "2026-05-11",
    weeklyArticleCount: 3,
    targetPlatforms: ["自有内容站 / 企业官网 GEO 页面", "微信公众号", "知乎"],
    contentTypes: ["FAQ 问答页", "竞品对比页"],
    linkedOptimizationTaskIds: [taskId],
    status: "已配置",
  };

  const upsertResult = await caller.geo.contentPlans.upsert(input);
  assert(upsertResult.success, "contentPlans.upsert did not report success.");
  assert(upsertResult.planId > 0, "contentPlans.upsert did not return planId.");

  const latest = await caller.geo.contentPlans.latest({ projectId: project.id });
  assert(latest.plan, "contentPlans.latest did not return a plan.");
  assert(latest.plan.id === upsertResult.planId, "latest planId does not match upsert result.");
  assert(latest.plan.projectId === project.id, "latest plan projectId mismatch.");
  assert(latest.plan.planName === input.planName, "planName mismatch.");
  assert(latest.plan.weekStartDate === input.weekStartDate, "weekStartDate mismatch.");
  assert(latest.plan.weeklyArticleCount === input.weeklyArticleCount, "weeklyArticleCount mismatch.");
  assert(JSON.stringify(latest.plan.targetPlatforms) === JSON.stringify(input.targetPlatforms), "targetPlatforms mismatch.");
  assert(JSON.stringify(latest.plan.contentTypes) === JSON.stringify(input.contentTypes), "contentTypes mismatch.");
  assert(JSON.stringify(latest.plan.linkedOptimizationTaskIds) === JSON.stringify(input.linkedOptimizationTaskIds), "linkedOptimizationTaskIds mismatch.");

  const itemResult = await caller.geo.contentPlans.addItem({
    projectId: project.id,
    planId: upsertResult.planId,
    topicId: null,
    articleId: null,
    targetPlatform: input.targetPlatforms[0],
    contentType: input.contentTypes[0],
    status: "待生成",
    differentiationAngle: "围绕 FAQ 问答页补齐 AI 可引用证据。",
    duplicateRisk: "低",
  });
  assert(itemResult.success, "contentPlans.addItem did not report success.");
  assert(itemResult.itemId > 0, "contentPlans.addItem did not return itemId.");

  const latestAfterItem = await caller.geo.contentPlans.latest({ projectId: project.id });
  assert(latestAfterItem.items.some(item => item.id === itemResult.itemId), "contentPlans.latest did not return saved item.");

  const listed = await caller.geo.contentPlans.list({ projectId: project.id });
  assert(listed.some(plan => plan.id === upsertResult.planId), "contentPlans.list did not include saved plan.");

  const [dbPlan] = await db.select().from(contentPlans).where(eq(contentPlans.id, upsertResult.planId)).limit(1);
  const [dbItem] = await db.select().from(contentPlanItems).where(eq(contentPlanItems.id, itemResult.itemId)).limit(1);
  assert(dbPlan, "Saved content plan was not found in database.");
  assert(dbItem, "Saved content plan item was not found in database.");
  assert(dbItem.planId === dbPlan.id, "Saved content plan item planId mismatch.");

  console.log(JSON.stringify({
    success: true,
    projectId: project.id,
    taskId,
    planId: upsertResult.planId,
    itemId: itemResult.itemId,
    persistedInDatabase: true,
    allFieldsMatched: true,
    writtenFields: input,
    readBackFields: {
      planName: latest.plan.planName,
      weekStartDate: latest.plan.weekStartDate,
      weeklyArticleCount: latest.plan.weeklyArticleCount,
      targetPlatforms: latest.plan.targetPlatforms,
      contentTypes: latest.plan.contentTypes,
      linkedOptimizationTaskIds: latest.plan.linkedOptimizationTaskIds,
      status: latest.plan.status,
      itemCount: latestAfterItem.items.length,
    },
  }, null, 2));
}

main().catch(error => {
  console.error("[P0-content-plan] Content plan acceptance failed:");
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await closeDatabase();
  } catch (error) {
    console.error("[P0-content-plan] Failed to close database connection:");
    console.error(error);
    process.exitCode = process.exitCode || 1;
  }
});

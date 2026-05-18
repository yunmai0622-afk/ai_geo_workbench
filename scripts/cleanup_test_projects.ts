/**
 * 清理测试项目，仅保留「河南海豚知道文化传媒有限公司」。
 *
 * 预览（不删除）：
 *   pnpm exec tsx scripts/cleanup_test_projects.ts
 *
 * 真正执行删除：
 *   pnpm exec tsx scripts/cleanup_test_projects.ts --execute
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import {
  aiResponses,
  analysisResults,
  competitorProfiles,
  complianceRules,
  contentPlanItems,
  contentPlans,
  contentStyleProfiles,
  contentTemplates,
  customerCases,
  enterpriseGeoProfiles,
  geoArticleQualityScores,
  geoArticles,
  geoArticleTopics,
  geoAssetSources,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  geoScores,
  optimizationTasks,
  platformAuthorizationConfigs,
  projects,
  publishStrategies,
  publishTasks,
  questions,
  reports,
} from "../drizzle/schema";
import { getDb } from "../server/db";

const KEEP_NAME = "河南海豚知道文化传媒有限公司";

type CleanupDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function deleteProjectCascade(db: CleanupDb, projectId: number) {
  await db.delete(geoInclusionMonitoringRecords).where(eq(geoInclusionMonitoringRecords.projectId, projectId));
  await db.delete(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId));
  await db.delete(geoArticleQualityScores).where(eq(geoArticleQualityScores.projectId, projectId));
  await db.delete(geoArticles).where(eq(geoArticles.projectId, projectId));
  await db.delete(geoArticleTopics).where(eq(geoArticleTopics.projectId, projectId));

  const plans = await db
    .select({ id: contentPlans.id })
    .from(contentPlans)
    .where(eq(contentPlans.projectId, projectId));
  const planIds = plans.map(row => row.id);
  if (planIds.length > 0) {
    await db.delete(contentPlanItems).where(inArray(contentPlanItems.planId, planIds));
  }
  await db.delete(contentPlans).where(eq(contentPlans.projectId, projectId));

  await db.delete(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId));
  await db.delete(geoAssetSources).where(eq(geoAssetSources.projectId, projectId));
  await db.delete(customerCases).where(eq(customerCases.projectId, projectId));
  await db.delete(competitorProfiles).where(eq(competitorProfiles.projectId, projectId));
  await db.delete(complianceRules).where(eq(complianceRules.projectId, projectId));
  await db.delete(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, projectId));
  await db.delete(publishStrategies).where(eq(publishStrategies.projectId, projectId));
  await db.delete(platformAuthorizationConfigs).where(eq(platformAuthorizationConfigs.projectId, projectId));
  await db.delete(publishTasks).where(eq(publishTasks.projectId, projectId));
  await db.delete(contentTemplates).where(eq(contentTemplates.projectId, projectId));
  await db.delete(reports).where(eq(reports.projectId, projectId));
  await db.delete(optimizationTasks).where(eq(optimizationTasks.projectId, projectId));
  await db.delete(geoScores).where(eq(geoScores.projectId, projectId));
  await db.delete(analysisResults).where(eq(analysisResults.projectId, projectId));
  await db.delete(aiResponses).where(eq(aiResponses.projectId, projectId));
  await db.delete(questions).where(eq(questions.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
}

async function closeDatabase(db: CleanupDb | null) {
  const client = (db as { $client?: { end?: () => Promise<unknown> | unknown } } | null)?.$client;
  if (client && typeof client.end === "function") {
    await client.end();
  }
}

async function main() {
  const execute = process.argv.includes("--execute");

  if (!process.env.DATABASE_URL) {
    console.error("[cleanup] 需要设置 DATABASE_URL");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("[cleanup] 无法连接数据库");
    process.exit(1);
  }

  try {
    const allProjects = await db
      .select({ id: projects.id, enterpriseName: projects.enterpriseName, createdAt: projects.createdAt })
      .from(projects)
      .orderBy(projects.id);

    const keepMatches = allProjects.filter(p => p.enterpriseName === KEEP_NAME);
    const keepId = keepMatches[0]?.id ?? null;
    const deleteProjects = keepId === null ? allProjects : allProjects.filter(p => p.id !== keepId);
    const deleteIds = deleteProjects.map(p => p.id);

    console.log(`[cleanup] 模式: ${execute ? "执行删除" : "预览（加 --execute 才真正删除）"}`);
    console.log(`[cleanup] 数据库项目总数: ${allProjects.length}`);

    if (keepId === null) {
      console.warn(`[cleanup] 警告: 未找到保留项目「${KEEP_NAME}」，预览/执行将删除全部 ${deleteIds.length} 个项目`);
    } else {
      console.log(`[cleanup] 保留: ${KEEP_NAME}（id: ${keepId}）`);
      if (keepMatches.length > 1) {
        console.warn(`[cleanup] 警告: 存在 ${keepMatches.length} 个同名项目，仅保留 id=${keepId}，其余同名将删除`);
      }
    }

    if (deleteProjects.length === 0) {
      console.log("[cleanup] 无需删除的测试项目");
      return;
    }

    console.log(`\n[cleanup] 将删除 ${deleteProjects.length} 个项目:\n`);
    for (const p of deleteProjects) {
      console.log(`  - id=${p.id}  ${p.enterpriseName}`);
    }

    if (!execute) {
      console.log("\n[cleanup] 以上为预览。确认后运行:");
      console.log("  pnpm exec tsx scripts/cleanup_test_projects.ts --execute");
      return;
    }

    for (const projectId of deleteIds) {
      const name = deleteProjects.find(p => p.id === projectId)?.enterpriseName ?? String(projectId);
      console.log(`[cleanup] 正在删除 id=${projectId} (${name})...`);
      await deleteProjectCascade(db, projectId);
    }

    if (keepId === null) {
      console.log(`已删除${deleteIds.length}个测试项目，未找到保留项目「${KEEP_NAME}」`);
    } else {
      console.log(`已删除${deleteIds.length}个测试项目，保留：${KEEP_NAME}（id: ${keepId}）`);
    }
  } finally {
    await closeDatabase(db);
  }
}

main().catch(err => {
  console.error("[cleanup] 失败:", err);
  process.exit(1);
});

/**
 * 将海豚知道项目下「已发布」文章改回未发布（status=质检通过），与本周内容页展示一致。
 *
 * 预览：pnpm exec tsx scripts/reset_weekly_articles_unpublished.ts
 * 执行：pnpm exec tsx scripts/reset_weekly_articles_unpublished.ts --execute
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { geoArticles, geoArticleTopics, geoPublishRecords, projects } from "../drizzle/schema";
import { getDb } from "../server/db";

const KEEP_NAME = "河南海豚知道文化传媒有限公司";
const RESET_TO_STATUS = "质检通过" as const;

async function main() {
  const execute = process.argv.includes("--execute");
  const db = await getDb();
  if (!db) {
    console.error("[reset] 数据库不可用");
    process.exit(1);
  }

  const projectRows = await db.select().from(projects).where(eq(projects.enterpriseName, KEEP_NAME)).limit(1);
  const project = projectRows[0];
  if (!project) {
    console.error(`[reset] 未找到项目：${KEEP_NAME}`);
    process.exit(1);
  }

  const topicRows = await db
    .select({ id: geoArticleTopics.id, title: geoArticleTopics.title })
    .from(geoArticleTopics)
    .where(eq(geoArticleTopics.projectId, project.id));
  const topicIds = topicRows.map(t => t.id);

  const projectArticles = await db
    .select({ id: geoArticles.id, title: geoArticles.title, topicId: geoArticles.topicId, status: geoArticles.status })
    .from(geoArticles)
    .where(eq(geoArticles.projectId, project.id));

  const topicIdSet = new Set(topicIds);
  const targets = projectArticles.filter(
    row => typeof row.topicId === "number" && topicIdSet.has(row.topicId),
  );
  const publishedInTargets = targets.filter(row => row.status === "已发布");

  console.log(`[reset] 项目：${KEEP_NAME}（id=${project.id}）`);
  console.log(
    `[reset] 当前选题 ${topicRows.length} 个 · 对应文章 ${targets.length} 篇（其中已发布 ${publishedInTargets.length} 篇）\n`,
  );

  for (const row of targets) {
    console.log(`  - id=${row.id} topic=${row.topicId ?? "-"}  ${row.title ?? "(无标题)"}`);
  }

  if (!execute) {
    console.log("\n[reset] 预览模式。确认后执行：pnpm exec tsx scripts/reset_weekly_articles_unpublished.ts --execute");
    return;
  }

  const ids = targets.map(row => row.id);
  if (ids.length === 0) {
    console.log("[reset] 无需更新");
    return;
  }

  await db.update(geoArticles).set({ status: RESET_TO_STATUS }).where(inArray(geoArticles.id, ids));
  for (const id of ids) {
    await db.delete(geoPublishRecords).where(eq(geoPublishRecords.articleId, id));
  }

  console.log(`\n[reset] 已将 ${ids.length} 篇改为「${RESET_TO_STATUS}」，并清除对应发布记录`);
}

main().catch(err => {
  console.error("[reset] 失败:", err);
  process.exit(1);
});

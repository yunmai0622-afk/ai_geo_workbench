/**
 * 删除 projects.id=30001 及其全部 projectId 关联数据（生产库一次性执行）。
 * 用法: npx tsx scripts/delete_project_30001.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { LEGACY_ORPHAN_PROJECT_ID } from "../shared/const";

loadEnv({ path: resolve(process.cwd(), ".env") });

const PROJECT_ID = LEGACY_ORPHAN_PROJECT_ID;

/** 直接含 projectId 列的表（与 drizzle schema 一致，camelCase） */
const PROJECT_TABLES = [
  "questions",
  "ai_responses",
  "analysis_results",
  "geo_scores",
  "optimization_tasks",
  "content_templates",
  "delivery_report_share_tokens",
  "reports",
  "geo_article_topics",
  "geo_article_quality_scores",
  "geo_publish_records",
  "geo_inclusion_monitoring_records",
  "geo_articles",
  "enterprise_geo_profiles",
  "geo_asset_sources",
  "customer_cases",
  "competitor_profiles",
  "compliance_rules",
  "content_style_profiles",
  "publish_strategies",
  "publish_tasks",
  "geo_review_queue",
  "geo_rewrite_pool",
  "project_platform_accounts",
  "platform_authorization_configs",
  "test_rounds",
  "ai_test_runs",
  "retest_comparisons",
  "effective_actions",
  "content_plans",
];

const JOIN_DELETES: Array<{ key: string; countSql: string; deleteSql: string }> = [
  {
    key: "content_plan_items",
    countSql: `SELECT COUNT(*) AS cnt FROM content_plan_items cpi INNER JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId = ${PROJECT_ID}`,
    deleteSql: `DELETE cpi FROM content_plan_items cpi INNER JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId = ${PROJECT_ID}`,
  },
  {
    key: "round_questions",
    countSql: `SELECT COUNT(*) AS cnt FROM round_questions rq INNER JOIN test_rounds tr ON tr.id = rq.roundId WHERE tr.projectId = ${PROJECT_ID}`,
    deleteSql: `DELETE rq FROM round_questions rq INNER JOIN test_rounds tr ON tr.id = rq.roundId WHERE tr.projectId = ${PROJECT_ID}`,
  },
];

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function countRows(db: Db, query: string): Promise<number> {
  const r = await db.execute(sql.raw(query));
  const row = ((r as { 0?: Array<{ cnt: number }> })[0] ?? r)[0];
  return Number((row as { cnt?: number; c?: number })?.cnt ?? (row as { c?: number })?.c ?? 0);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error("数据库不可用");
    process.exit(1);
  }

  const deleted: Record<string, number> = {};
  const skipped: Record<string, string> = {};

  for (const { key, countSql, deleteSql } of JOIN_DELETES) {
    const n = await countRows(db, countSql);
    if (n > 0) await db.execute(sql.raw(deleteSql));
    deleted[key] = n;
  }

  for (const table of PROJECT_TABLES) {
    try {
      const n = await countRows(db, `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE projectId = ${PROJECT_ID}`);
      if (n > 0) {
        await db.execute(sql.raw(`DELETE FROM \`${table}\` WHERE projectId = ${PROJECT_ID}`));
      }
      deleted[table] = n;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped[table] = msg;
      deleted[table] = 0;
    }
  }

  const projectsCount = await countRows(db, `SELECT COUNT(*) AS cnt FROM projects WHERE id = ${PROJECT_ID}`);
  if (projectsCount > 0) {
    await db.execute(sql.raw(`DELETE FROM projects WHERE id = ${PROJECT_ID}`));
  }
  deleted.projects = projectsCount;

  const projectsAfter = await db.execute(sql.raw(`SELECT id, enterpriseName FROM projects ORDER BY id`));
  const rows = (projectsAfter as { 0?: Array<{ id: number; enterpriseName: string }> })[0] ?? projectsAfter;

  console.log(
    JSON.stringify(
      {
        projectId: PROJECT_ID,
        deletedRowsByTable: deleted,
        skippedTables: skipped,
        totalDeleted: Object.values(deleted).reduce((a, b) => a + b, 0),
        projectsAfter: rows,
      },
      null,
      2,
    ),
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

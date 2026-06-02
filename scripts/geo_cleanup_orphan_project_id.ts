/**
 * 删除已不存在 projects 行上的孤儿 projectId 引用（默认 30001）。
 * 用法: ORPHAN_PROJECT_ID=30001 npx tsx scripts/geo_cleanup_orphan_project_id.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

loadEnv({ path: resolve(process.cwd(), ".env") });

const ORPHAN_PROJECT_ID = Number(process.env.ORPHAN_PROJECT_ID ?? "30001");

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
  "geo_articles",
  "content_plans",
  "geo_article_quality_scores",
  "geo_publish_records",
  "geo_inclusion_monitoring_records",
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
];

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function count(db: Db, query: string) {
  const r = await db.execute(sql.raw(query));
  const row = ((r as { 0?: Array<{ cnt: number }> })[0] ?? r)[0];
  return Number(row?.cnt ?? 0);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }
  if (!Number.isFinite(ORPHAN_PROJECT_ID) || ORPHAN_PROJECT_ID <= 0) {
    console.error("ORPHAN_PROJECT_ID 无效");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error("数据库不可用");
    process.exit(1);
  }

  const projectExists = await count(
    db,
    `SELECT COUNT(*) AS cnt FROM projects WHERE id = ${ORPHAN_PROJECT_ID}`,
  );
  if (projectExists > 0) {
    console.log(JSON.stringify({ orphanProjectId: ORPHAN_PROJECT_ID, skipped: true, reason: "projects 行仍存在" }));
    return;
  }

  const summary: Record<string, number> = {};
  for (const table of PROJECT_TABLES) {
    const n = await count(
      db,
      `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE projectId = ${ORPHAN_PROJECT_ID}`,
    );
    summary[table] = n;
    if (n > 0) {
      await db.execute(sql.raw(`DELETE FROM \`${table}\` WHERE projectId = ${ORPHAN_PROJECT_ID}`));
    }
  }

  const planItems = await count(
    db,
    `SELECT COUNT(*) AS cnt FROM content_plan_items cpi INNER JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId = ${ORPHAN_PROJECT_ID}`,
  );
  if (planItems > 0) {
    await db.execute(
      sql.raw(
        `DELETE cpi FROM content_plan_items cpi INNER JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId = ${ORPHAN_PROJECT_ID}`,
      ),
    );
  }
  summary.content_plan_items = planItems;

  const roundQuestions = await count(
    db,
    `SELECT COUNT(*) AS cnt FROM round_questions rq INNER JOIN test_rounds tr ON tr.id = rq.roundId WHERE tr.projectId = ${ORPHAN_PROJECT_ID}`,
  );
  if (roundQuestions > 0) {
    await db.execute(
      sql.raw(
        `DELETE rq FROM round_questions rq INNER JOIN test_rounds tr ON tr.id = rq.roundId WHERE tr.projectId = ${ORPHAN_PROJECT_ID}`,
      ),
    );
  }
  summary.round_questions = roundQuestions;

  const remaining = Object.values(summary).reduce((a, b) => a + b, 0);
  console.log(
    JSON.stringify({
      orphanProjectId: ORPHAN_PROJECT_ID,
      deletedRowsByTable: summary,
      totalDeleted: remaining,
    }),
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

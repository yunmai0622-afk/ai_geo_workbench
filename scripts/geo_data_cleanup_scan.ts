/**
 * GEO-V1.1-DataCleanup — dry-run scan only (no DELETE).
 * 用法: npx tsx scripts/geo_data_cleanup_scan.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

loadEnv({ path: resolve(process.cwd(), ".env") });

const KEEP_PROJECT_IDS = [72];
const DELETE_PROJECT_IDS = [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];

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

async function count(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, query: string) {
  const r = await db.execute(sql.raw(query));
  const row = ((r as { 0?: Array<{ cnt: number }> })[0] ?? r)[0];
  return Number(row?.cnt ?? 0);
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

  const projects = await db.execute(
    sql`SELECT id, ownerUserId, enterpriseName, industry, status, createdAt FROM projects ORDER BY id`,
  );
  const projectRows = (projects as { 0?: unknown[] })[0] ?? projects;

  const tableSummary: Record<string, { total: number; keep: number; toDelete: number }> = {};
  for (const t of PROJECT_TABLES) {
    tableSummary[t] = {
      total: await count(db, `SELECT COUNT(*) AS cnt FROM \`${t}\``),
      keep: await count(
        db,
        `SELECT COUNT(*) AS cnt FROM \`${t}\` WHERE projectId IN (${KEEP_PROJECT_IDS.join(",")})`,
      ),
      toDelete: await count(
        db,
        `SELECT COUNT(*) AS cnt FROM \`${t}\` WHERE projectId IN (${DELETE_PROJECT_IDS.join(",")})`,
      ),
    };
  }

  const contentPlanItems = {
    total: await count(db, "SELECT COUNT(*) AS cnt FROM content_plan_items"),
    deleteWithNonKeepPlans: await count(
      db,
      `SELECT COUNT(*) AS cnt FROM content_plan_items cpi JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId IN (${DELETE_PROJECT_IDS.join(",")})`,
    ),
    keepProjectOrphanTopicId: await count(
      db,
      `SELECT COUNT(*) AS cnt FROM content_plan_items cpi JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId = 72 AND cpi.topicId IS NOT NULL AND cpi.topicId NOT IN (SELECT id FROM geo_article_topics)`,
    ),
    keepProjectOrphanArticleId: await count(
      db,
      `SELECT COUNT(*) AS cnt FROM content_plan_items cpi JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId = 72 AND cpi.articleId IS NOT NULL AND cpi.articleId NOT IN (SELECT id FROM geo_articles)`,
    ),
  };

  const roundQuestions = {
    total: await count(db, "SELECT COUNT(*) AS cnt FROM round_questions"),
    orphanRound: await count(
      db,
      "SELECT COUNT(*) AS cnt FROM round_questions rq LEFT JOIN test_rounds tr ON tr.id = rq.roundId WHERE tr.id IS NULL",
    ),
    orphanQuestion: await count(
      db,
      "SELECT COUNT(*) AS cnt FROM round_questions rq LEFT JOIN questions q ON q.id = rq.questionId WHERE q.id IS NULL",
    ),
  };

  const keepProjectOrphans = {
    aiResponsesNullQuestionId: await count(
      db,
      "SELECT COUNT(*) AS cnt FROM ai_responses WHERE projectId = 72 AND questionId IS NULL",
    ),
    geoArticlesNullTaskId: await count(
      db,
      "SELECT COUNT(*) AS cnt FROM geo_articles WHERE projectId = 72 AND optimizationTaskId IS NULL",
    ),
  };

  const project30001 = await db.execute(sql`SELECT id FROM projects WHERE id = 30001`);

  const deleteProjects = await db.execute(
    sql.raw(
      `SELECT id, enterpriseName, status, createdAt FROM projects WHERE id IN (${DELETE_PROJECT_IDS.join(",")}) ORDER BY id`,
    ),
  );

  const report = {
    scannedAt: new Date().toISOString(),
    note: "projectId=30001 在库中不存在；完整海豚知道主项目为 id=72",
    projects: { total: (projectRows as unknown[]).length, rows: projectRows },
    keepProjectIds: KEEP_PROJECT_IDS,
    deleteProjectIds: DELETE_PROJECT_IDS,
    deleteProjects: (deleteProjects as { 0?: unknown[] })[0] ?? deleteProjects,
    project30001Exists: ((project30001 as { 0?: unknown[] })[0] ?? project30001).length > 0,
    tableSummary,
    contentPlanItems,
    roundQuestions,
    keepProjectOrphans,
    keepProject72Counts: Object.fromEntries(PROJECT_TABLES.map(t => [t, tableSummary[t]?.keep ?? 0])),
    totalRowsToDeleteByProjectId: Object.values(tableSummary).reduce((sum, x) => sum + x.toDelete, 0),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

/**
 * GEO-V1.1-DataCleanup-Execute — backup + delete + verify.
 * 用法: npx tsx scripts/geo_data_cleanup_execute.ts
 */
import { config as loadEnv } from "dotenv";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

loadEnv({ path: resolve(process.cwd(), ".env") });

const KEEP_PROJECT_ID = 72;
const DELETE_PROJECT_IDS = [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];
const DELETE_IN = DELETE_PROJECT_IDS.join(",");

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

function parseMysqlUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "3306",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

function backupWithMysqldump(dbUrl: string, outDir: string) {
  const { host, port, user, password, database } = parseMysqlUrl(dbUrl);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fullBackup = resolve(outDir, `full-${stamp}.sql`);
  const deleteBackup = resolve(outDir, `delete-projects-${stamp}.sql`);

  const env = { ...process.env, MYSQL_PWD: password };
  execSync(
    `mysqldump -h ${host} -P ${port} -u ${user} --single-transaction --routines --triggers ${database} > "${fullBackup}"`,
    { env, stdio: "pipe" },
  );

  const whereClauses = [
    `projects WHERE id IN (${DELETE_IN})`,
    ...PROJECT_TABLES.map(t => `\`${t}\` WHERE projectId IN (${DELETE_IN})`),
    `content_plan_items cpi JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId IN (${DELETE_IN})`,
  ];

  const parts: string[] = [`-- GEO cleanup backup ${stamp}`, `-- delete project ids: ${DELETE_IN}`, ""];
  for (const clause of whereClauses) {
    parts.push(`-- ${clause}`);
  }
  writeFileSync(deleteBackup, parts.join("\n") + "\n", "utf-8");

  return { fullBackup, deleteBackup };
}

async function exportDeleteRows(db: Db, outDir: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = resolve(outDir, `delete-rows-${stamp}.json`);
  const payload: Record<string, unknown> = { deleteProjectIds: DELETE_PROJECT_IDS, tables: {} };

  payload.tables = {
    projects: await db.execute(
      sql.raw(`SELECT * FROM projects WHERE id IN (${DELETE_IN}) ORDER BY id`),
    ),
  };

  for (const t of PROJECT_TABLES) {
    payload.tables[t] = await db.execute(
      sql.raw(`SELECT * FROM \`${t}\` WHERE projectId IN (${DELETE_IN})`),
    );
  }

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf-8");
  return jsonPath;
}

async function runDeleteStep(db: Db, label: string, countSql: string, deleteSql: string) {
  const n = await count(db, countSql);
  if (n > 0) {
    await db.execute(sql.raw(deleteSql));
  }
  return { label, deleted: n };
}

async function deleteByProjectIds(db: Db) {
  const steps: Array<{ label: string; countSql: string; deleteSql: string }> = [
    {
      label: "content_plan_items (delete-project plans)",
      countSql: `SELECT COUNT(*) AS cnt FROM content_plan_items cpi INNER JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE cpi FROM content_plan_items cpi INNER JOIN content_plans cp ON cp.id = cpi.planId WHERE cp.projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_inclusion_monitoring_records",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_inclusion_monitoring_records WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_inclusion_monitoring_records WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_article_quality_scores",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_article_quality_scores WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_article_quality_scores WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_review_queue",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_review_queue WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_review_queue WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_rewrite_pool",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_rewrite_pool WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_rewrite_pool WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_publish_records",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_publish_records WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_publish_records WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "publish_tasks",
      countSql: `SELECT COUNT(*) AS cnt FROM publish_tasks WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM publish_tasks WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_articles",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_articles WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_articles WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_article_topics",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_article_topics WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_article_topics WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "content_plans",
      countSql: `SELECT COUNT(*) AS cnt FROM content_plans WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM content_plans WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "retest_comparisons",
      countSql: `SELECT COUNT(*) AS cnt FROM retest_comparisons WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM retest_comparisons WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "ai_test_runs",
      countSql: `SELECT COUNT(*) AS cnt FROM ai_test_runs WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM ai_test_runs WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "round_questions (delete-project rounds)",
      countSql: `SELECT COUNT(*) AS cnt FROM round_questions rq INNER JOIN test_rounds tr ON tr.id = rq.roundId WHERE tr.projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE rq FROM round_questions rq INNER JOIN test_rounds tr ON tr.id = rq.roundId WHERE tr.projectId IN (${DELETE_IN})`,
    },
    {
      label: "effective_actions",
      countSql: `SELECT COUNT(*) AS cnt FROM effective_actions WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM effective_actions WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "test_rounds",
      countSql: `SELECT COUNT(*) AS cnt FROM test_rounds WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM test_rounds WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "analysis_results",
      countSql: `SELECT COUNT(*) AS cnt FROM analysis_results WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM analysis_results WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "ai_responses",
      countSql: `SELECT COUNT(*) AS cnt FROM ai_responses WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM ai_responses WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "questions",
      countSql: `SELECT COUNT(*) AS cnt FROM questions WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM questions WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "optimization_tasks",
      countSql: `SELECT COUNT(*) AS cnt FROM optimization_tasks WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM optimization_tasks WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_scores",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_scores WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_scores WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "delivery_report_share_tokens",
      countSql: `SELECT COUNT(*) AS cnt FROM delivery_report_share_tokens WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM delivery_report_share_tokens WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "reports",
      countSql: `SELECT COUNT(*) AS cnt FROM reports WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM reports WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "enterprise_geo_profiles",
      countSql: `SELECT COUNT(*) AS cnt FROM enterprise_geo_profiles WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM enterprise_geo_profiles WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "geo_asset_sources",
      countSql: `SELECT COUNT(*) AS cnt FROM geo_asset_sources WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM geo_asset_sources WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "customer_cases",
      countSql: `SELECT COUNT(*) AS cnt FROM customer_cases WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM customer_cases WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "competitor_profiles",
      countSql: `SELECT COUNT(*) AS cnt FROM competitor_profiles WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM competitor_profiles WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "compliance_rules",
      countSql: `SELECT COUNT(*) AS cnt FROM compliance_rules WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM compliance_rules WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "content_style_profiles",
      countSql: `SELECT COUNT(*) AS cnt FROM content_style_profiles WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM content_style_profiles WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "publish_strategies",
      countSql: `SELECT COUNT(*) AS cnt FROM publish_strategies WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM publish_strategies WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "platform_authorization_configs",
      countSql: `SELECT COUNT(*) AS cnt FROM platform_authorization_configs WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM platform_authorization_configs WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "project_platform_accounts",
      countSql: `SELECT COUNT(*) AS cnt FROM project_platform_accounts WHERE projectId IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM project_platform_accounts WHERE projectId IN (${DELETE_IN})`,
    },
    {
      label: "projects",
      countSql: `SELECT COUNT(*) AS cnt FROM projects WHERE id IN (${DELETE_IN})`,
      deleteSql: `DELETE FROM projects WHERE id IN (${DELETE_IN})`,
    },
  ];

  const results = [];
  for (const step of steps) {
    results.push(await runDeleteStep(db, step.label, step.countSql, step.deleteSql));
  }
  return results;
}

async function deleteOrphans(db: Db) {
  const orphanCpiSql = `DELETE cpi FROM content_plan_items cpi
    INNER JOIN content_plans cp ON cp.id = cpi.planId
    WHERE cp.projectId = ${KEEP_PROJECT_ID}
      AND (
        (cpi.topicId IS NOT NULL AND cpi.topicId NOT IN (SELECT id FROM geo_article_topics))
        OR (cpi.articleId IS NOT NULL AND cpi.articleId NOT IN (SELECT id FROM geo_articles))
      )`;

  const orphanCpiCount = await count(
    db,
    `SELECT COUNT(*) AS cnt FROM content_plan_items cpi
      INNER JOIN content_plans cp ON cp.id = cpi.planId
      WHERE cp.projectId = ${KEEP_PROJECT_ID}
        AND (
          (cpi.topicId IS NOT NULL AND cpi.topicId NOT IN (SELECT id FROM geo_article_topics))
          OR (cpi.articleId IS NOT NULL AND cpi.articleId NOT IN (SELECT id FROM geo_articles))
        )`,
  );

  const orphanAiCount = await count(
    db,
    "SELECT COUNT(*) AS cnt FROM ai_responses WHERE questionId IS NULL",
  );

  const orphanRqCount = await count(
    db,
    `SELECT COUNT(*) AS cnt FROM round_questions rq
      LEFT JOIN questions q ON q.id = rq.questionId
      WHERE q.id IS NULL`,
  );

  await db.execute(sql.raw(orphanCpiSql));
  await db.execute(sql.raw("DELETE FROM ai_responses WHERE questionId IS NULL"));
  await db.execute(sql.raw(`DELETE rq FROM round_questions rq
    LEFT JOIN questions q ON q.id = rq.questionId
    WHERE q.id IS NULL`));

  return {
    contentPlanItems: orphanCpiCount,
    aiResponsesNullQuestionId: orphanAiCount,
    roundQuestionsOrphanQuestion: orphanRqCount,
  };
}

async function verifyCounts(db: Db) {
  const tableCounts: Record<string, number> = {};
  for (const t of [...PROJECT_TABLES, "projects", "content_plan_items", "round_questions", "users"]) {
    tableCounts[t] = await count(db, `SELECT COUNT(*) AS cnt FROM \`${t}\``);
  }
  const project72 = await db.execute(
    sql`SELECT id, enterpriseName, status FROM projects WHERE id = 72`,
  );
  return {
    tableCounts,
    projects: (project72 as { 0?: unknown[] })[0] ?? project72,
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error("数据库不可用");
    process.exit(1);
  }

  const outDir = resolve(process.cwd(), "artifacts/geo-data-cleanup-backup");
  mkdirSync(outDir, { recursive: true });

  let backup: Record<string, string> = {};
  try {
    backup = backupWithMysqldump(dbUrl, outDir);
  } catch (err) {
    backup.mysqldumpError = String(err);
  }
  const jsonBackup = await exportDeleteRows(db, outDir);
  backup.jsonExport = jsonBackup;

  const projectDeletes = await deleteByProjectIds(db);
  const orphanDeletes = await deleteOrphans(db);
  const verification = await verifyCounts(db);

  console.log(
    JSON.stringify(
      {
        ok: true,
        backup,
        projectDeletes,
        orphanDeletes,
        verification,
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

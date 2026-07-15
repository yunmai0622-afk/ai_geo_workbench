import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
const productionBaseUrl = process.env.RAILWAY_PRODUCTION_URL?.replace(/\/$/, "");
const reportPath = resolve(process.env.OBSERVATION_GATE_REPORT_PATH || "artifacts/observation-production-gate.json");
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!productionBaseUrl) throw new Error("RAILWAY_PRODUCTION_URL is required");

const projectId = 210001;
const ledgerTables = [
  "ai_observation_runs", "ai_observation_run_events", "ai_observation_answers",
  "ai_observation_extractions", "ai_extracted_brand_facts", "ai_recommendation_results", "ai_citation_results",
];
const changeTables = [
  ["brand_truth_profiles", "createdAt", "updatedAt"],
  ["brand_truth_facts", "createdAt", "updatedAt"],
  ["brand_truth_fact_versions", "changedAt", null],
  ["brand_truth_evidence", "createdAt", "updatedAt"],
  ["brand_truth_fact_evidence_links", "createdAt", null],
  ["brand_truth_conflicts", "createdAt", "updatedAt"],
  ["understanding_question_sets", "createdAt", "updatedAt"],
  ["understanding_questions", "createdAt", "updatedAt"],
  ["understanding_evaluations", "createdAt", "updatedAt"],
  ["understanding_dimension_results", "createdAt", null],
  ["understanding_correction_tasks", "createdAt", "updatedAt"],
  ["understanding_rule_configs", "createdAt", "updatedAt"],
];

const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
const migrationSpecs = ["0072_brand_truth_understand_acceptance_gate", "0073_ai_observation_ledger"].map(name => {
  const entry = journal.entries.find(item => item.tag === name);
  if (!entry) throw new Error(`journal entry missing: ${name}`);
  return { name, createdAt: entry.when };
});

const healthResponse = await fetch(`${productionBaseUrl}/health`, { headers: { "Cache-Control": "no-cache" } });
const health = await healthResponse.json().catch(() => null);
const deployedAt = health?.buildTime;
if (!healthResponse.ok || health?.ok !== true || !deployedAt || Number.isNaN(Date.parse(deployedAt))) {
  throw new Error("production /health did not provide an acceptable buildTime");
}

const db = await mysql.createConnection(databaseUrl);
let report;
try {
  const [migrationRows] = await db.execute(
    "SELECT `hash`, `created_at` AS createdAt FROM `__drizzle_migrations` WHERE `created_at` IN (?,?)",
    migrationSpecs.map(item => item.createdAt),
  );
  const migrationRecords = migrationSpecs.map(spec => {
    // Drizzle's MySQL migrator determines applied state from journal created_at; hash is stored but is not its status key.
    const row = migrationRows.find(item => Number(item.createdAt) === spec.createdAt);
    return { migration: spec.name.slice(0, 4), time: row ? new Date(spec.createdAt).toISOString() : null, status: row ? "recorded" : "missing" };
  });

  const [tableRows] = await db.execute(
    `SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN (${ledgerTables.map(() => "?").join(",")})`,
    ledgerTables,
  );
  const existingTables = new Set(tableRows.map(row => row.tableName));
  const [acceptanceColumns] = await db.execute(
    "SELECT column_name AS columnName, is_nullable AS isNullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='understanding_evaluations' AND column_name IN ('methodologyVersion','dimensionWeights','ruleVersion','assessmentStatus','plannedQuestionCount','runQuestionCount','verifiedFactCount','extractionCoverage','assessmentCoverage','severity')",
  );
  const acceptanceColumnMap = new Map(acceptanceColumns.map(row => [row.columnName, row.isNullable]));
  const schemaConsistent = ledgerTables.every(table => existingTables.has(table)) &&
    acceptanceColumnMap.size === 10 && acceptanceColumnMap.get("severity") === "YES";

  const ledger = [];
  for (const table of ledgerTables) {
    if (!existingTables.has(table)) {
      ledger.push({ table, count: null, latestCreatedAt: null, status: "missing" });
      continue;
    }
    const [rows] = await db.execute(`SELECT COUNT(*) AS rowCount, MAX(\`createdAt\`) AS latestCreatedAt FROM \`${table}\` WHERE \`projectId\`=?`, [projectId]);
    ledger.push({ table, count: Number(rows[0].rowCount), latestCreatedAt: rows[0].latestCreatedAt?.toISOString?.() ?? rows[0].latestCreatedAt ?? null, status: "present" });
  }

  const relatedChanges = [];
  for (const [table, createdColumn, updatedColumn] of changeTables) {
    const updateExpression = updatedColumn
      ? `SUM(CASE WHEN \`${createdColumn}\` < ? AND \`${updatedColumn}\` >= ? THEN 1 ELSE 0 END)`
      : "0";
    const params = updatedColumn
      ? [deployedAt, deployedAt, deployedAt, projectId, deployedAt, deployedAt]
      : [deployedAt, projectId, deployedAt];
    const [rows] = await db.execute(
      `SELECT SUM(CASE WHEN \`${createdColumn}\` >= ? THEN 1 ELSE 0 END) AS insertsAfterDeploy, ${updateExpression} AS updatesAfterDeploy FROM \`${table}\` WHERE \`projectId\`=? AND (\`${createdColumn}\` >= ?${updatedColumn ? ` OR \`${updatedColumn}\` >= ?` : ""})`,
      params,
    );
    relatedChanges.push({ table, insertsAfterDeploy: Number(rows[0].insertsAfterDeploy ?? 0), updatesAfterDeploy: Number(rows[0].updatesAfterDeploy ?? 0) });
  }
  const [auditRows] = await db.execute(
    "SELECT COUNT(*) AS eventCount, MAX(`createdAt`) AS latestAt FROM `audit_logs` WHERE `projectId`=? AND `createdAt`>=? AND LOWER(CONCAT(`action`,' ',COALESCE(`detail`,''))) REGEXP 'brand|truth|understand|observation|ledger'",
    [projectId, deployedAt],
  );

  const featureFlag = health?.features?.aiObservationLedgerV2 === true;
  const checks = {
    migrationsRecorded: migrationRecords.every(item => item.status === "recorded"),
    schemaConsistent,
    featureFlagDisabled: featureFlag === false,
    ledgerEmpty: ledger.every(item => item.count === 0),
    noRelatedWritesAfterDeploy: relatedChanges.every(item => item.insertsAfterDeploy === 0 && item.updatesAfterDeploy === 0) && Number(auditRows[0].eventCount) === 0,
    healthOk: healthResponse.ok && health?.ok === true,
  };
  report = {
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    deployedAt,
    migrations: migrationRecords,
    schema: { observationTableCount: existingTables.size, runEventsPresent: existingTables.has("ai_observation_run_events"), consistent: schemaConsistent },
    featureFlag: featureFlag ? "true" : "false",
    ledger,
    writesAfterDeploy: relatedChanges,
    audit: { relatedEventCount: Number(auditRows[0].eventCount), latestAt: auditRows[0].latestAt?.toISOString?.() ?? auditRows[0].latestAt ?? null, delete: "delete_audit_unavailable" },
    health: { ok: healthResponse.ok && health?.ok === true },
    checks,
  };
} finally {
  await db.end();
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.status !== "pass") process.exitCode = 1;

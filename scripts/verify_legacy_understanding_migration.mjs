import { mkdir, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const projectId = Number(process.argv[process.argv.indexOf("--project-id") + 1]);
if (!Number.isInteger(projectId) || projectId <= 0) throw new Error("--project-id is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[counts]] = await db.query(`SELECT COUNT(*) itemCount, SUM(migrationStatus='failed') failedCount,
    SUM(targetRunId IS NOT NULL AND targetAnswerId IS NULL) brokenObservationLinks,
    SUM(targetAssessmentId IS NOT NULL AND targetExtractionId IS NULL) brokenAssessmentLinks
    FROM legacy_understanding_migration_items WHERE projectId=?`, [projectId]);
  const [[legacy]] = await db.query("SELECT COUNT(*) legacyCount, MAX(updatedAt) latestLegacyUpdatedAt FROM understanding_evaluations WHERE projectId=?", [projectId]);
  const report = { projectId, itemCount: Number(counts.itemCount), failedCount: Number(counts.failedCount ?? 0), brokenObservationLinks: Number(counts.brokenObservationLinks ?? 0), brokenAssessmentLinks: Number(counts.brokenAssessmentLinks ?? 0), legacyCount: Number(legacy.legacyCount), latestLegacyUpdatedAt: legacy.latestLegacyUpdatedAt };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/legacy-understanding-consistency.json", `${JSON.stringify(report, null, 2)}\n`);
  if (report.failedCount || report.brokenObservationLinks || report.brokenAssessmentLinks) throw new Error("legacy migration consistency verification failed");
  console.log(JSON.stringify({ status: "passed", projectId, itemCount: report.itemCount }));
} finally { await db.end(); }

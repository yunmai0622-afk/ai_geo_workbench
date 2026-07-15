import { mkdir, writeFile } from "node:fs/promises";
import { getDb } from "../server/db";
import { LegacyUnderstandingMigrationService } from "../server/legacyUnderstandingMigrationService";

function option(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
const projectId = Number(option("--project-id"));
const execute = process.argv.includes("--execute");
const resumeAfter = option("--resume-after");
const reportPath = option("--report") ?? "artifacts/legacy-understanding-migration-report.json";
if (!Number.isInteger(projectId) || projectId <= 0) throw new Error("--project-id must be a positive integer");
if (projectId === 210001) throw new Error("project 210001 is explicitly blocked from this tool");
if (execute && process.env.ALLOW_LEGACY_UNDERSTANDING_MIGRATION !== "true") throw new Error("execute requires ALLOW_LEGACY_UNDERSTANDING_MIGRATION=true");
const db = await getDb();
if (!db) throw new Error("Database connection is unavailable");
const service = new LegacyUnderstandingMigrationService(db);
const report = execute ? await service.migrateProject(projectId, undefined, resumeAfter) : await service.dryRun(projectId, resumeAfter);
await mkdir(reportPath.includes("/") ? reportPath.slice(0, reportPath.lastIndexOf("/")) : ".", { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: "passed", mode: execute ? "execute" : "dry_run", projectId, reportPath }));

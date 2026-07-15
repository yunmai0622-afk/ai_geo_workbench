import { mkdir, readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { bootstrapTidbV0075, splitBaselineSql } from "./bootstrap_tidb_v0075.mjs";

if (process.env.ALLOW_LEGACY_UNDERSTANDING_TIDB_TEST !== "true") throw new Error("Explicit TiDB integration opt-in is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const suffix = Math.random().toString(16).slice(2, 7);
const prefixes = { upgrade: `ga_${suffix}_`, baseline: `gb_${suffix}_` };
const fixtureSql = await readFile("drizzle/baselines/tidb_v0074.sql", "utf8");
const baselineSql = await readFile("drizzle/baselines/tidb_v0075.sql", "utf8");
const migration0075 = await readFile("drizzle/0075_legacy_understanding_cutover.sql", "utf8");
const tableNames = [...new Set([...baselineSql.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1]))];
const foreignKeyNames = [...new Set([...baselineSql.matchAll(/CONSTRAINT `([^`]+)` FOREIGN KEY/g)].map(match => match[1]))];
const report = { version: null, upgrade0074To0075: "pending", freshBaseline: "pending", migratorPending: null, fingerprintsEqual: false, migrationForeignKeys: 0, crossProjectRejected: false, idempotencyEnforced: false, dryRunWrites: null };
const connection = await mysql.createConnection(process.env.DATABASE_URL);

const table = (prefix, name) => `\`${prefix}${name}\``;
function isolateSql(sql, prefix) {
  let result = sql;
  for (const name of [...tableNames].sort((a, b) => b.length - a.length)) result = result.replaceAll(`\`${name}\``, table(prefix, name));
  result = result.replace(/CONSTRAINT `([^`]+)` FOREIGN KEY/g, (_match, name) => `CONSTRAINT \`${prefix}f${foreignKeyNames.indexOf(name)}\` FOREIGN KEY`);
  return result;
}
async function executeSql(sql) {
  for (const statement of splitBaselineSql(sql)) await connection.query(statement);
}
async function cleanup(prefix) {
  await connection.query("SET FOREIGN_KEY_CHECKS=0");
  for (const name of [...tableNames].reverse()) await connection.query(`DROP TABLE IF EXISTS ${table(prefix, name)}`);
  await connection.query(`DROP TABLE IF EXISTS \`${prefix}__drizzle_migrations\``);
  await connection.query("SET FOREIGN_KEY_CHECKS=1");
}
async function fingerprint(prefix) {
  const like = `${prefix}%`;
  const strip = value => typeof value === "string" ? value.replaceAll(prefix, "") : value;
  const [tables] = await connection.query("SELECT TABLE_NAME,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE ? AND TABLE_NAME<>? ORDER BY TABLE_NAME", [like, `${prefix}__drizzle_migrations`]);
  const [columns] = await connection.query("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE ? AND TABLE_NAME<>? ORDER BY TABLE_NAME,ORDINAL_POSITION", [like, `${prefix}__drizzle_migrations`]);
  const [indexes] = await connection.query("SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,COLLATION,INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE ? AND TABLE_NAME<>? ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX", [like, `${prefix}__drizzle_migrations`]);
  const [fks] = await connection.query("SELECT TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION", [like]);
  return JSON.parse(JSON.stringify({ tables, columns, indexes, fks }, (_key, value) => strip(value)));
}
function compareFingerprints(left, right) {
  for (const section of ["tables", "columns", "indexes", "fks"]) {
    const length = Math.max(left[section].length, right[section].length);
    for (let index = 0; index < length; index++) {
      if (JSON.stringify(left[section][index]) !== JSON.stringify(right[section][index])) return { section, index, upgrade: left[section][index] ?? null, baseline: right[section][index] ?? null };
    }
  }
  return null;
}

async function verifyBehavior(prefix) {
  await connection.query(`INSERT INTO ${table(prefix,"users")} (id,openId) VALUES (1,'tidb-gate')`);
  const projectInsert = `INSERT INTO ${table(prefix,"projects")} (id,ownerUserId,enterpriseName,industry,website,region,productIntro,targetCustomers,coreSellingPoints,competitorNames,coreKeywords) VALUES (?,1,'gate','test','https://invalid.example','test','test','test','test',JSON_ARRAY(),JSON_ARRAY())`;
  await connection.query(projectInsert, [100]); await connection.query(projectInsert, [200]);
  await connection.query(`INSERT INTO ${table(prefix,"legacy_understanding_migration_runs")} (id,projectId,mode,migrationVersion,status,startedAt) VALUES ('mr',100,'execute','03.6C-v1','running',NOW())`);
  const itemInsert = `INSERT INTO ${table(prefix,"legacy_understanding_migration_items")} (id,projectId,migrationRunId,legacyEvaluationId,sourceChecksum,migrationVersion,migrationStatus,reproducibilityStatus) VALUES (?,?,?,?,?,?,?,?)`;
  await connection.query(itemInsert, ["mi",100,"mr","legacy-1","sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","03.6C-v1","legacy_non_reproducible","legacy_non_reproducible"]);
  try { await connection.query(itemInsert, ["mi2",100,"mr","legacy-1","sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","03.6C-v1","legacy_non_reproducible","legacy_non_reproducible"]); } catch { report.idempotencyEnforced = true; }
  try { await connection.query(itemInsert, ["cross",200,"mr","legacy-2","sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","03.6C-v1","legacy_non_reproducible","legacy_non_reproducible"]); } catch { report.crossProjectRejected = true; }
  const [[fk]] = await connection.query("SELECT COUNT(DISTINCT CONSTRAINT_NAME) count FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?) AND REFERENCED_TABLE_NAME IS NOT NULL", [`${prefix}legacy_understanding_migration_runs`, `${prefix}legacy_understanding_migration_items`]);
  report.migrationForeignKeys = Number(fk.count);
  const [[before]] = await connection.query(`SELECT COUNT(*) count FROM ${table(prefix,"legacy_understanding_migration_items")}`);
  await connection.query(`SELECT legacyEvaluationId,migrationStatus FROM ${table(prefix,"legacy_understanding_migration_items")} WHERE projectId=100`);
  const [[after]] = await connection.query(`SELECT COUNT(*) count FROM ${table(prefix,"legacy_understanding_migration_items")}`);
  report.dryRunWrites = Number(after.count) - Number(before.count);
}

try {
  const [[version]] = await connection.query("SELECT VERSION() version");
  report.version = String(version.version).replace(/TiDB-v(\d+\.\d+\.\d+).*/, "TiDB $1");
  if (!String(version.version).includes("TiDB-v8.5.3")) throw new Error(`Expected TiDB 8.5.3, received ${report.version}`);
  await cleanup(prefixes.upgrade); await cleanup(prefixes.baseline);
  await executeSql(isolateSql(fixtureSql, prefixes.upgrade));
  for (const statement of isolateSql(migration0075, prefixes.upgrade).split(/--> statement-breakpoint\s*/).map(value => value.trim()).filter(Boolean)) await connection.query(statement);
  report.upgrade0074To0075 = "passed";
  await bootstrapTidbV0075(connection, { tablePrefix: prefixes.baseline, transformSql: sql => isolateSql(sql, prefixes.baseline) });
  report.freshBaseline = "passed";
  await migrate(drizzle(connection), { migrationsFolder: "drizzle", migrationsTable: `${prefixes.baseline}__drizzle_migrations` });
  const [[latest]] = await connection.query(`SELECT created_at FROM \`${prefixes.baseline}__drizzle_migrations\` ORDER BY created_at DESC LIMIT 1`);
  const before = await connection.query(`SELECT COUNT(*) count FROM \`${prefixes.baseline}__drizzle_migrations\``);
  report.migratorPending = Number(before[0][0].count) === 71 && Number(latest.created_at) === 1784094000000 ? 0 : "unexpected_metadata";
  const upgradeFingerprint = await fingerprint(prefixes.upgrade);
  const baselineFingerprint = await fingerprint(prefixes.baseline);
  report.fingerprintDifference = compareFingerprints(upgradeFingerprint, baselineFingerprint);
  report.fingerprintsEqual = report.fingerprintDifference === null;
  await verifyBehavior(prefixes.baseline);
  if (!report.fingerprintsEqual || report.migratorPending !== 0 || report.migrationForeignKeys !== 7 || !report.crossProjectRejected || !report.idempotencyEnforced || report.dryRunWrites !== 0) throw new Error("TiDB legacy cutover acceptance failed");
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = error instanceof Error ? error.message : String(error); throw error;
} finally {
  for (const prefix of Object.values(prefixes)) try { await cleanup(prefix); } catch { /* preserve primary error */ }
  await connection.end(); await mkdir("artifacts", { recursive: true }); await writeFile("artifacts/legacy-understanding-tidb.json", `${JSON.stringify(report,null,2)}\n`);
}

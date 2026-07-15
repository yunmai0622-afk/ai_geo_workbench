import { mkdir, readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { bootstrapTidbV0074, splitBaselineSql } from "./bootstrap_tidb_v0074.mjs";

if (process.env.ALLOW_VERSIONED_GOVERNANCE_TIDB_TEST !== "true") throw new Error("Explicit TiDB integration opt-in is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const suffix = Math.random().toString(16).slice(2, 7);
const prefixes = { upgrade: `ga_${suffix}_`, baseline: `gb_${suffix}_` };
const fixtureSql = await readFile("drizzle/fixtures/tidb_v0073.sql", "utf8");
const baselineSql = await readFile("drizzle/baselines/tidb_v0074.sql", "utf8");
const migration0074 = await readFile("drizzle/0074_versioned_understand_governance.sql", "utf8");
const tableNames = [...new Set([...baselineSql.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1]))];
const foreignKeyNames = [...new Set([...baselineSql.matchAll(/CONSTRAINT `([^`]+)` FOREIGN KEY/g)].map(match => match[1]))];
const report = { version: null, upgrade0073To0074: "pending", freshBaseline: "pending", migratorPending: null, fingerprintsEqual: false, crossProjectRejected: false, referencedDeleteRejected: false, multipleMethodologiesPreserved: false, manualReviewsAppendOnly: false };
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
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_profiles")} (id,projectId) VALUES (1,100),(2,200)`);
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_fact_versions")} (id,factId,projectId,version,profileVersion,newValue,newVerificationStatus,changeReason) VALUES (1,1,100,1,1,'v','official_verified','seed')`);
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_profile_versions")} (id,projectId,profileId,version,statusSnapshot,completenessScoreSnapshot,verifiedFactRateSnapshot,conflictCountSnapshot,outdatedFactCountSnapshot) VALUES ('tpv',100,1,1,'active',10000,10000,0,0)`);
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_profile_version_facts")} (projectId,truthProfileVersionId,factVersionId) VALUES (100,'tpv',1)`);
  await connection.query(`INSERT INTO ${table(prefix,"ai_observation_runs")} (id,projectId,questionSetVersionSnapshot,provider,modelName,runPurpose,locale,startedAt,runStatus,systemPromptVersion,systemPromptHash,applicationVersion) VALUES ('run',100,1,'test','test','integration','en',NOW(),'succeeded','1','h','test')`);
  await connection.query(`INSERT INTO ${table(prefix,"ai_observation_answers")} (id,projectId,observationRunId,questionKey,questionVersionSnapshot,questionTextSnapshot,attemptNumber,answerStatus,citationCapability) VALUES ('answer',100,'run','q',1,'q',1,'received','unknown')`);
  await connection.query(`INSERT INTO ${table(prefix,"ai_observation_extractions")} (id,projectId,observationAnswerId,attemptNumber,extractorKey,extractorVersion,extractionPromptVersion,extractionPromptHash,extractionStatus,citationExtractionStatus,startedAt) VALUES ('extraction',100,'answer',1,'e','1','1','h','succeeded','unknown',NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_question_set_versions")} (id,projectId,questionSetKey,version,nameSnapshot,effectiveFrom) VALUES ('qs',100,'q',1,'q',NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_question_versions")} (id,projectId,questionSetVersionId,questionKey,version,questionTextSnapshot,importance,purchaseIntent,effectiveFrom) VALUES ('qv',100,'qs','q',1,'q','high','consideration',NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_extraction_version_registry")} (id,projectId,extractorKey,version,implementationVersion,promptHash,outputSchema,effectiveFrom) VALUES ('ev',100,'e',1,'1','h',JSON_OBJECT(),NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_methodology_registry")} (id,projectId,methodologyKey,name) VALUES ('m',100,'m','m')`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_methodology_versions")} (id,projectId,methodologyId,version,coveragePolicy,confidencePolicy,effectiveFrom) VALUES ('mv1',100,'m',1,JSON_OBJECT(),JSON_OBJECT(),NOW()),('mv2',100,'m',2,JSON_OBJECT(),JSON_OBJECT(),NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_rule_sets")} (id,projectId,ruleSetKey,name) VALUES ('rs',100,'r','r')`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_rule_versions")} (id,projectId,ruleSetId,ruleKey,version,severity,conditionJson,outcomeJson,effectiveFrom) VALUES ('rv',100,'rs','r',1,'P1',JSON_OBJECT(),JSON_OBJECT(),NOW())`);
  const insertAssessment = `INSERT INTO ${table(prefix,"understanding_assessments")} (id,projectId,extractionId,truthProfileVersionId,questionVersionId,extractionVersionId,methodologyVersionId,primaryRuleVersionId,assessmentStatus,automaticOutcome,coverageBasisPoints,confidenceBasisPoints,assessmentPayload) VALUES (?,?,?,?,?,?,?,?,'completed','accurate',10000,9000,JSON_OBJECT())`;
  await connection.query(insertAssessment,["a1",100,"extraction","tpv","qv","ev","mv1","rv"]);
  await connection.query(insertAssessment,["a2",100,"extraction","tpv","qv","ev","mv2","rv"]);
  try { await connection.query(insertAssessment,["cross",200,"extraction","tpv","qv","ev","mv1","rv"]); } catch { report.crossProjectRejected = true; }
  try { await connection.query(`DELETE FROM ${table(prefix,"understanding_methodology_versions")} WHERE id='mv1'`); } catch { report.referencedDeleteRejected = true; }
  await connection.query(`INSERT INTO ${table(prefix,"understanding_assessment_manual_reviews")} (id,projectId,assessmentId,action,reason,evidenceSnapshot,reviewedBy,reviewedAt) VALUES ('r1',100,'a1','confirmed','one',JSON_ARRAY(),1,NOW()),('r2',100,'a1','rejected','two',JSON_ARRAY(),2,NOW())`);
  const [[assessments]] = await connection.query(`SELECT COUNT(*) count FROM ${table(prefix,"understanding_assessments")} WHERE extractionId='extraction'`);
  const [[reviews]] = await connection.query(`SELECT COUNT(*) count FROM ${table(prefix,"understanding_assessment_manual_reviews")} WHERE assessmentId='a1'`);
  report.multipleMethodologiesPreserved = Number(assessments.count) === 2;
  report.manualReviewsAppendOnly = Number(reviews.count) === 2;
}

try {
  const [[version]] = await connection.query("SELECT VERSION() version");
  report.version = String(version.version).replace(/TiDB-v(\d+\.\d+\.\d+).*/, "TiDB $1");
  if (!String(version.version).includes("TiDB-v8.5.3")) throw new Error(`Expected TiDB 8.5.3, received ${report.version}`);
  await cleanup(prefixes.upgrade); await cleanup(prefixes.baseline);
  await executeSql(isolateSql(fixtureSql, prefixes.upgrade));
  for (const statement of isolateSql(migration0074, prefixes.upgrade).split(/--> statement-breakpoint\s*/).map(value => value.trim()).filter(Boolean)) await connection.query(statement);
  report.upgrade0073To0074 = "passed";
  await bootstrapTidbV0074(connection, { tablePrefix: prefixes.baseline, transformSql: sql => isolateSql(sql, prefixes.baseline) });
  report.freshBaseline = "passed";
  await migrate(drizzle(connection), { migrationsFolder: "drizzle", migrationsTable: `${prefixes.baseline}__drizzle_migrations` });
  const [[latest]] = await connection.query(`SELECT created_at FROM \`${prefixes.baseline}__drizzle_migrations\` ORDER BY created_at DESC LIMIT 1`);
  const before = await connection.query(`SELECT COUNT(*) count FROM \`${prefixes.baseline}__drizzle_migrations\``);
  report.migratorPending = Number(before[0][0].count) === 70 && Number(latest.created_at) === 1784090400000 ? 0 : "unexpected_metadata";
  const upgradeFingerprint = await fingerprint(prefixes.upgrade);
  const baselineFingerprint = await fingerprint(prefixes.baseline);
  report.fingerprintDifference = compareFingerprints(upgradeFingerprint, baselineFingerprint);
  report.fingerprintsEqual = report.fingerprintDifference === null;
  await verifyBehavior(prefixes.baseline);
  if (!report.fingerprintsEqual || report.migratorPending !== 0 || !report.crossProjectRejected || !report.referencedDeleteRejected || !report.multipleMethodologiesPreserved || !report.manualReviewsAppendOnly) throw new Error("TiDB governance acceptance failed");
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = error instanceof Error ? error.message : String(error); throw error;
} finally {
  for (const prefix of Object.values(prefixes)) try { await cleanup(prefix); } catch { /* preserve primary error */ }
  await connection.end(); await mkdir("artifacts", { recursive: true }); await writeFile("artifacts/versioned-governance-tidb.json", `${JSON.stringify(report,null,2)}\n`);
}

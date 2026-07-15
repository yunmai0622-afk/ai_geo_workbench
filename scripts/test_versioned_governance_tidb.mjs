import { mkdir, readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

if (process.env.ALLOW_VERSIONED_GOVERNANCE_TIDB_TEST !== "true") throw new Error("Explicit TiDB integration opt-in is required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const migrations = [
  "drizzle/0071_brand_truth_understand_engine.sql",
  "drizzle/0072_brand_truth_understand_acceptance_gate.sql",
  "drizzle/0073_ai_observation_ledger.sql",
  "drizzle/0074_versioned_understand_governance.sql",
];
const expectedAssessmentFks = [
  "understanding_assessments_observation_extraction_project_fk",
  "understanding_assessments_truth_profile_version_project_fk",
  "understanding_assessments_question_project_fk",
  "understanding_assessments_extraction_version_project_fk",
  "understanding_assessments_methodology_project_fk",
  "understanding_assessments_rule_project_fk",
];
const suffix = Math.random().toString(16).slice(2, 7);
const prefixes = [`gf_${suffix}_`, `gu_${suffix}_`];
const report = { version: null, paths: {}, assessmentCompositeForeignKeys: [], crossProjectRejected: false, referencedDeleteRejected: false, historicalAssessmentsPreserved: false };
const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: false });

const migrationSources = await Promise.all(migrations.map(name => readFile(name, "utf8")));
const governedTables = [...new Set(migrationSources.flatMap(sql => [...sql.matchAll(/(?:CREATE|ALTER) TABLE `([^`]+)`/g)].map(match => match[1])))];
const constraintNames = [...new Set(migrationSources.flatMap(sql => [...sql.matchAll(/CONSTRAINT `([^`]+)`/g)].map(match => match[1])))];
const table = (prefix, name) => `\`${prefix}${name}\``;
function isolateSql(sql, prefix) {
  let isolated = sql;
  for (const name of governedTables.sort((a, b) => b.length - a.length)) isolated = isolated.replaceAll(`\`${name}\``, table(prefix, name));
  isolated = isolated.replace(/CONSTRAINT `([^`]+)`/g, (_match, name) => `CONSTRAINT \`${prefix}c${constraintNames.indexOf(name)}\``);
  return isolated;
}

async function apply(name, prefix) {
  const sql = await readFile(name, "utf8");
  for (const statement of isolateSql(sql, prefix).split(/--> statement-breakpoint\s*/).map(value => value.trim()).filter(Boolean)) await connection.query(statement);
}

async function cleanup(prefix) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const name of [...governedTables].reverse()) await connection.query(`DROP TABLE IF EXISTS ${table(prefix, name)}`);
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function seedAndVerify(prefix) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_profiles")} (id,projectId) VALUES (1,100),(2,200)`);
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_fact_versions")} (id,factId,projectId,version,profileVersion,newValue,newVerificationStatus,changeReason) VALUES (1,1,100,1,1,'v','official_verified','seed')`);
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_profile_versions")} (id,projectId,profileId,version,statusSnapshot,completenessScoreSnapshot,verifiedFactRateSnapshot,conflictCountSnapshot,outdatedFactCountSnapshot) VALUES ('tpv-100',100,1,1,'active',10000,10000,0,0)`);
  await connection.query(`INSERT INTO ${table(prefix,"brand_truth_profile_version_facts")} (projectId,truthProfileVersionId,factVersionId) VALUES (100,'tpv-100',1)`);
  await connection.query(`INSERT INTO ${table(prefix,"ai_observation_runs")} (id,projectId,questionSetVersionSnapshot,provider,modelName,runPurpose,locale,startedAt,runStatus,systemPromptVersion,systemPromptHash,applicationVersion) VALUES ('run-100',100,1,'test','test','integration','en',NOW(),'succeeded','1','hash','integration')`);
  await connection.query(`INSERT INTO ${table(prefix,"ai_observation_answers")} (id,projectId,observationRunId,questionKey,questionVersionSnapshot,questionTextSnapshot,attemptNumber,answerStatus,citationCapability) VALUES ('answer-100',100,'run-100','q',1,'q',1,'received','unknown')`);
  await connection.query(`INSERT INTO ${table(prefix,"ai_observation_extractions")} (id,projectId,observationAnswerId,attemptNumber,extractorKey,extractorVersion,extractionPromptVersion,extractionPromptHash,extractionStatus,citationExtractionStatus,startedAt) VALUES ('extraction-100',100,'answer-100',1,'e','1','1','hash','succeeded','unknown',NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_question_set_versions")} (id,projectId,questionSetKey,version,nameSnapshot,effectiveFrom) VALUES ('qs-100',100,'set',1,'set',NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_question_versions")} (id,projectId,questionSetVersionId,questionKey,version,questionTextSnapshot,importance,purchaseIntent,effectiveFrom) VALUES ('qv-100',100,'qs-100','q',1,'q','high','consideration',NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_extraction_version_registry")} (id,projectId,extractorKey,version,implementationVersion,promptHash,outputSchema,effectiveFrom) VALUES ('ev-100',100,'e',1,'1','hash',JSON_OBJECT(),NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_methodology_registry")} (id,projectId,methodologyKey,name) VALUES ('m-100',100,'m','m')`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_methodology_versions")} (id,projectId,methodologyId,version,coveragePolicy,confidencePolicy,effectiveFrom) VALUES ('mv-1',100,'m-100',1,JSON_OBJECT(),JSON_OBJECT(),NOW()),('mv-2',100,'m-100',2,JSON_OBJECT(),JSON_OBJECT(),NOW())`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_rule_sets")} (id,projectId,ruleSetKey,name) VALUES ('rs-100',100,'r','r')`);
  await connection.query(`INSERT INTO ${table(prefix,"understanding_rule_versions")} (id,projectId,ruleSetId,ruleKey,version,severity,conditionJson,outcomeJson,effectiveFrom) VALUES ('rv-100',100,'rs-100','r',1,'P1',JSON_OBJECT(),JSON_OBJECT(),NOW())`);
  const assessmentSql = `INSERT INTO ${table(prefix,"understanding_assessments")} (id,projectId,extractionId,truthProfileVersionId,questionVersionId,extractionVersionId,methodologyVersionId,primaryRuleVersionId,assessmentStatus,automaticOutcome,coverageBasisPoints,confidenceBasisPoints,assessmentPayload) VALUES (?,?,?, ?,?,?,?,?, 'completed','accurate',10000,9000,JSON_OBJECT())`;
  await connection.query(assessmentSql, ["a-1",100,"extraction-100","tpv-100","qv-100","ev-100","mv-1","rv-100"]);
  await connection.query(assessmentSql, ["a-2",100,"extraction-100","tpv-100","qv-100","ev-100","mv-2","rv-100"]);
  try { await connection.query(assessmentSql, ["cross",200,"extraction-100","tpv-100","qv-100","ev-100","mv-1","rv-100"]); } catch { report.crossProjectRejected = true; }
  try { await connection.query(`DELETE FROM ${table(prefix,"understanding_methodology_versions")} WHERE id='mv-1' AND projectId=100`); } catch { report.referencedDeleteRejected = true; }
  const [[count]] = await connection.query(`SELECT COUNT(*) AS count FROM ${table(prefix,"understanding_assessments")} WHERE extractionId='extraction-100'`);
  report.historicalAssessmentsPreserved = Number(count.count) === 2;
}

try {
  const [[version]] = await connection.query("SELECT VERSION() AS version");
  report.version = String(version.version).replace(/TiDB-v(\d+\.\d+\.\d+).*/, "TiDB $1");
  if (!String(version.version).includes("TiDB-v8.5.3")) throw new Error(`Expected TiDB 8.5.3, received ${report.version}`);
  for (const migration of migrations) await apply(migration, prefixes[0]);
  report.paths.fresh0071To0074 = "passed";
  await cleanup(prefixes[0]);
  for (const migration of migrations.slice(0, 3)) await apply(migration, prefixes[1]);
  for (const migration of migrations.slice(3)) await apply(migration, prefixes[1]);
  report.paths.existing0073To0074 = "passed";
  const [fkRows] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY CONSTRAINT_NAME", [`${prefixes[1]}understanding_assessments`]);
  report.assessmentCompositeForeignKeys = fkRows.map(row => constraintNames[Number(String(row.CONSTRAINT_NAME).slice(`${prefixes[1]}c`.length))]);
  if (expectedAssessmentFks.some(name => !report.assessmentCompositeForeignKeys.includes(name))) throw new Error("Assessment composite foreign key verification failed");
  await seedAndVerify(prefixes[1]);
  if (!report.crossProjectRejected || !report.referencedDeleteRejected || !report.historicalAssessmentsPreserved) throw new Error("TiDB behavior verification failed");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  for (const prefix of prefixes) try { await cleanup(prefix); } catch { /* report retains the primary failure */ }
  await connection.end();
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/versioned-governance-tidb.json", `${JSON.stringify(report, null, 2)}\n`);
}

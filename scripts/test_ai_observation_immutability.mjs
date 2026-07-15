import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const migrationUrl = process.env.OBSERVATION_MIGRATION_TEST_DATABASE_URL;
const runtimeUrl = process.env.OBSERVATION_RUNTIME_TEST_DATABASE_URL;
if (!migrationUrl || !runtimeUrl || process.env.ALLOW_OBSERVATION_LEDGER_TEST_DB !== "true") {
  throw new Error("Dedicated migration/runtime test URLs and ALLOW_OBSERVATION_LEDGER_TEST_DB=true are required");
}
if (migrationUrl === runtimeUrl) throw new Error("Migration and runtime principals must be different");

const admin = await mysql.createConnection(migrationUrl);
const runtime = await mysql.createConnection(runtimeUrl);
const migration = await readFile(new URL("../drizzle/0073_ai_observation_ledger.sql", import.meta.url), "utf8");
const statements = migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean);
const tables = ["ai_citation_results","ai_recommendation_results","ai_extracted_brand_facts","ai_observation_extractions","ai_observation_answers","ai_observation_run_events","ai_observation_runs"];
async function rejected(sql, params) {
  try { await runtime.execute(sql, params); throw new Error(`runtime accepted forbidden statement: ${sql}`); }
  catch (error) { if (String(error).includes("runtime accepted forbidden")) throw error; }
}
try {
  await admin.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of tables) await admin.query(`DROP TABLE IF EXISTS \`${table}\``);
  await admin.query("SET FOREIGN_KEY_CHECKS=1");
  for (const statement of statements) await admin.query(statement);

  const runId = randomUUID(); const eventId = randomUUID(); const answerId = randomUUID(); const extractionId = randomUUID();
  await runtime.execute("INSERT INTO ai_observation_runs (id,projectId,questionSetVersionSnapshot,provider,modelName,runPurpose,locale,startedAt,runStatus,systemPromptVersion,systemPromptHash,applicationVersion) VALUES (?,1,1,'test','test','understand','zh-CN',NOW(),'running','v1','hash','test')", [runId]);
  await runtime.execute("INSERT INTO ai_observation_run_events (id,projectId,observationRunId,eventType,eventSequence,occurredAt) VALUES (?,1,?,'running',1,NOW())", [eventId, runId]);
  await runtime.execute("INSERT INTO ai_observation_answers (id,projectId,observationRunId,questionKey,questionVersionSnapshot,questionTextSnapshot,attemptNumber,rawAnswer,answerContentHash,answerStatus,citationCapability) VALUES (?,1,?,'q1',1,'question',1,'raw','hash','received','unsupported')", [answerId, runId]);
  await runtime.execute("INSERT INTO ai_observation_extractions (id,projectId,observationAnswerId,attemptNumber,extractorKey,extractorVersion,extractionPromptVersion,extractionPromptHash,extractionStatus,citationExtractionStatus,startedAt) VALUES (?,1,?,1,'extractor','v1','p1','hash','succeeded','unsupported',NOW())", [extractionId, answerId]);

  for (const table of tables) {
    await rejected(`UPDATE \`${table}\` SET projectId=projectId`);
    await rejected(`DELETE FROM \`${table}\` LIMIT 1`);
  }
  await rejected("ALTER TABLE ai_observation_runs ADD COLUMN forbidden int");
  await rejected("DROP TABLE ai_observation_runs");
  await rejected("INSERT INTO ai_observation_run_events (id,projectId,observationRunId,eventType,eventSequence,occurredAt) VALUES (?,2,?,'running',2,NOW())", [randomUUID(), runId]);
  console.log("[ai-observation-immutability] runtime INSERT succeeded; UPDATE/DELETE/DDL and cross-project linkage rejected");
} finally {
  await runtime.end();
  await admin.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of tables) await admin.query(`DROP TABLE IF EXISTS \`${table}\``);
  await admin.query("SET FOREIGN_KEY_CHECKS=1");
  await admin.end();
}

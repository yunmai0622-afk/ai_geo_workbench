import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
const url = process.env.OBSERVATION_TEST_DATABASE_URL;
if (!url || process.env.ALLOW_OBSERVATION_LEDGER_TEST_DB !== "true") throw new Error("Dedicated OBSERVATION_TEST_DATABASE_URL and ALLOW_OBSERVATION_LEDGER_TEST_DB=true are required");
const db = await mysql.createConnection(url);
const migration = await readFile(new URL("../drizzle/0073_ai_observation_ledger.sql", import.meta.url), "utf8");
const statements = migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean);
const tables = ["ai_citation_results","ai_recommendation_results","ai_extracted_brand_facts","ai_observation_extractions","ai_observation_answers","ai_observation_runs"];
async function rejected(sql, params) { try { await db.execute(sql, params); throw new Error(`database accepted forbidden statement: ${sql}`); } catch (error) { if (String(error).includes("database accepted forbidden")) throw error; } }
try {
  await db.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of tables) await db.query(`DROP TABLE IF EXISTS \`${table}\``);
  await db.query("SET FOREIGN_KEY_CHECKS=1");
  for (const statement of statements) await db.query(statement);
  const runId = randomUUID(); const answerId = randomUUID(); const extractionId = randomUUID();
  await db.execute("INSERT INTO ai_observation_runs (id,projectId,questionSetVersionSnapshot,provider,modelName,runPurpose,locale,startedAt,runStatus,systemPromptVersion,systemPromptHash,applicationVersion) VALUES (?,1,1,'test','test','understand','zh-CN',NOW(),'running','v1','hash','test')", [runId]);
  await db.execute("INSERT INTO ai_observation_answers (id,projectId,observationRunId,questionKey,questionVersionSnapshot,questionTextSnapshot,attemptNumber,rawAnswer,answerContentHash,answerStatus,citationCapability) VALUES (?,1,?,'q1',1,'question',1,'raw','hash','received','unsupported')", [answerId, runId]);
  await db.execute("INSERT INTO ai_observation_extractions (id,projectId,observationAnswerId,attemptNumber,extractorKey,extractorVersion,extractionPromptVersion,extractionPromptHash,extractionStatus,citationExtractionStatus,startedAt) VALUES (?,1,?,1,'extractor','v1','p1','hash','succeeded','unsupported',NOW())", [extractionId, answerId]);
  await rejected("UPDATE ai_observation_answers SET rawAnswer='changed'");
  await rejected("UPDATE ai_observation_answers SET rawProviderMetadata=JSON_OBJECT('changed',true)");
  await rejected("DELETE FROM ai_observation_answers WHERE id=?", [answerId]);
  await rejected("UPDATE ai_observation_extractions SET extractorVersion='v2'");
  await rejected("DELETE FROM ai_observation_extractions WHERE id=?", [extractionId]);
  await rejected("INSERT INTO ai_observation_answers (id,projectId,observationRunId,questionKey,questionVersionSnapshot,questionTextSnapshot,attemptNumber,answerStatus,citationCapability) VALUES (?,2,?,'cross',1,'cross',1,'provider_error','unknown')", [randomUUID(), runId]);
  console.log("[ai-observation-immutability] database rejected UPDATE, DELETE and cross-project linkage");
} finally {
  await db.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of tables) await db.query(`DROP TABLE IF EXISTS \`${table}\``);
  await db.query("SET FOREIGN_KEY_CHECKS=1");
  await db.end();
}

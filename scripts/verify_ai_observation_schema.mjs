import mysql from "mysql2/promise";
const url = process.env.OBSERVATION_TEST_DATABASE_URL;
if (!url) throw new Error("OBSERVATION_TEST_DATABASE_URL is required; production DATABASE_URL is intentionally ignored");
const requiredTables = ["ai_observation_runs","ai_observation_answers","ai_observation_extractions","ai_extracted_brand_facts","ai_recommendation_results","ai_citation_results"];
const requiredTriggers = requiredTables.slice(1).flatMap(table => [`${table}_no_update`, `${table}_no_delete`]);
const db = await mysql.createConnection(url);
try {
  const [schemaRows] = await db.query("SELECT DATABASE() schemaName");
  const schema = schemaRows[0]?.schemaName;
  const [tables] = await db.execute("SELECT table_name tableName FROM information_schema.tables WHERE table_schema=?", [schema]);
  const tableSet = new Set(tables.map(row => row.tableName));
  for (const table of requiredTables) if (!tableSet.has(table)) throw new Error(`missing table ${table}`);
  const [triggers] = await db.execute("SELECT trigger_name triggerName FROM information_schema.triggers WHERE trigger_schema=?", [schema]);
  const triggerSet = new Set(triggers.map(row => row.triggerName));
  for (const trigger of requiredTriggers) if (!triggerSet.has(trigger)) throw new Error(`missing immutable trigger ${trigger}`);
  const [fkRows] = await db.execute("SELECT constraint_name constraintName FROM information_schema.referential_constraints WHERE constraint_schema=? AND constraint_name LIKE 'ai_%_project_fk'", [schema]);
  if (fkRows.length !== 5) throw new Error(`expected 5 project composite foreign keys, found ${fkRows.length}`);
  console.log(`[ai-observation-schema] verified ${requiredTables.length} tables, ${requiredTriggers.length} triggers and ${fkRows.length} composite FKs`);
} finally { await db.end(); }

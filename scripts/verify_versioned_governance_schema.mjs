import { readFile } from "node:fs/promises";

const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
const migration = await readFile("drizzle/0074_versioned_understand_governance.sql", "utf8");
const schema = await readFile("drizzle/schema.ts", "utf8");
const baseline = await readFile("drizzle/baselines/tidb_v0074.sql", "utf8");
const tail = journal.entries.slice(-4).map(entry => entry.tag);
const expectedTail = [
  "0071_brand_truth_understand_engine", "0072_brand_truth_understand_acceptance_gate",
  "0073_ai_observation_ledger", "0074_versioned_understand_governance",
];
if (JSON.stringify(tail) !== JSON.stringify(expectedTail)) throw new Error(`Migration order mismatch: ${tail.join(", ")}`);

const tables = [...migration.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1]);
for (const table of tables) if (!schema.includes(`"${table}"`)) throw new Error(`Schema export missing for ${table}`);
const schemaTables = [...schema.matchAll(/mysqlTable\(\s*"([^"]+)"/g)].map(match => match[1]).sort();
const baselineTables = [...baseline.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1]).sort();
if (JSON.stringify(schemaTables) !== JSON.stringify(baselineTables)) throw new Error("TiDB baseline table set differs from Drizzle schema");
const requiredFks = [
  "understanding_assessments_observation_extraction_project_fk",
  "understanding_assessments_truth_profile_version_project_fk",
  "understanding_assessments_question_project_fk",
  "understanding_assessments_extraction_version_project_fk",
  "understanding_assessments_methodology_project_fk",
  "understanding_assessments_rule_project_fk",
  "brand_truth_profile_version_facts_profile_project_fk",
  "brand_truth_profile_version_facts_fact_project_fk",
];
for (const name of requiredFks) {
  if (!migration.includes(`CONSTRAINT \`${name}\` FOREIGN KEY`)) throw new Error(`Migration foreign key missing: ${name}`);
  if (!schema.includes(`name: "${name}"`)) throw new Error(`Schema foreign key missing: ${name}`);
}
if (!migration.includes("(`extractionId`,`projectId`) REFERENCES `ai_observation_extractions` (`id`,`projectId`)")) throw new Error("Observation Extraction composite foreign key mismatch");
if (!migration.includes("`truthProfileVersionId`")) throw new Error("Truth profile version binding missing");
if (migration.includes("`truthProfileVersion` int")) throw new Error("Legacy numeric truth profile version remains in formal Assessment");
if (/\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(migration)) throw new Error("0074 contains a destructive or data-rewriting statement");

console.log(JSON.stringify({ status: "passed", migrationOrder: tail, migration0074Tables: tables.length, baselineTables: baselineTables.length, requiredCompositeForeignKeys: requiredFks.length }));

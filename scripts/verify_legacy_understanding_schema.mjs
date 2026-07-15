import { readFile } from "node:fs/promises";
const migration = await readFile("drizzle/0075_legacy_understanding_cutover.sql", "utf8");
const baseline = await readFile("drizzle/baselines/tidb_v0075.sql", "utf8");
const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
const tables = ["legacy_understanding_migration_runs", "legacy_understanding_migration_items", "understanding_rollout_configs"];
for (const table of tables) {
  if (!migration.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``)) throw new Error(`0075 missing idempotent ${table}`);
  if (!baseline.includes(`CREATE TABLE \`${table}\``)) throw new Error(`v0075 baseline missing ${table}`);
}
if (journal.entries.at(-1)?.tag !== "0075_legacy_understanding_cutover") throw new Error("0075 is not the journal tail");
if (/^\s*(?:ALTER|DROP|TRUNCATE|UPDATE|DELETE|INSERT)\b/im.test(migration)) throw new Error("0075 must be structure-only and additive");
const fks = [...migration.matchAll(/CONSTRAINT `([^`]+)` FOREIGN KEY/g)].map(match => match[1]);
if (fks.length !== 8) throw new Error(`expected 8 project-scoped foreign keys, found ${fks.length}`);
if (fks.some(name => name.length > 64)) throw new Error("0075 contains a MySQL/TiDB identifier longer than 64 characters");
if (!migration.includes("DEFAULT 'legacy_only'") || !migration.includes("DEFAULT 'legacy'")) throw new Error("rollout defaults are unsafe");
console.log(JSON.stringify({ status: "passed", tables, foreignKeys: fks.length, migration: journal.entries.at(-1).tag }));

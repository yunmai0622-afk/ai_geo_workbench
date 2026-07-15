import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { pathToFileURL } from "node:url";

const BASELINE_PATH = "drizzle/baselines/tidb_v0074.sql";
const JOURNAL_PATH = "drizzle/meta/_journal.json";

export async function loadMigrationMetadata() {
  const journal = JSON.parse(await readFile(JOURNAL_PATH, "utf8"));
  return Promise.all(journal.entries.map(async entry => {
    const sql = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    return { tag: entry.tag, createdAt: Number(entry.when), hash: createHash("sha256").update(sql).digest("hex") };
  }));
}

export function splitBaselineSql(sql) {
  return sql.split(/;\s*(?:\r?\n|$)/).map(statement => statement.trim()).filter(Boolean);
}

export async function bootstrapTidbV0074(connection, options = {}) {
  const prefix = options.tablePrefix ?? "";
  const migrationTable = `${prefix}__drizzle_migrations`;
  const [tables] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE ?",
    [`${prefix}%`],
  );
  const businessTables = tables.map(row => String(row.TABLE_NAME)).filter(name => name !== migrationTable);
  if (businessTables.length) throw new Error(`Baseline refused: database namespace contains ${businessTables.length} business table(s)`);
  if (tables.some(row => String(row.TABLE_NAME) === migrationTable)) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${migrationTable}\``);
    if (Number(row.count) > 0) throw new Error("Baseline refused: migration metadata already contains records");
  }

  const baseline = await readFile(BASELINE_PATH, "utf8");
  const transform = options.transformSql ?? (sql => sql);
  for (const statement of splitBaselineSql(transform(baseline))) await connection.query(statement);
  await connection.query(`CREATE TABLE IF NOT EXISTS \`${migrationTable}\` (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const metadata = await loadMigrationMetadata();
  for (const migration of metadata) await connection.query(
    `INSERT INTO \`${migrationTable}\` (hash, created_at) VALUES (?, ?)`, [migration.hash, migration.createdAt],
  );
  return { tablesCreated: splitBaselineSql(baseline).filter(statement => /^CREATE TABLE/i.test(statement)).length, migrationsRecorded: metadata.length, latest: metadata.at(-1) };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [[version]] = await connection.query("SELECT VERSION() AS version");
    if (!String(version.version).includes("TiDB-v8.5.3")) throw new Error("Baseline requires TiDB 8.5.3");
    const result = await bootstrapTidbV0074(connection);
    console.log(JSON.stringify({ status: "passed", tablesCreated: result.tablesCreated, migrationsRecorded: result.migrationsRecorded, latestMigration: result.latest.tag }));
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const MIGRATION_PATH = new URL("../drizzle/0071_brand_truth_understand_engine.sql", import.meta.url);
const MIGRATION_MILLIS = 1784027117147;
const MIGRATIONS_TABLE = "__drizzle_migrations";

function parseMigration(sql) {
  const statements = sql.split("--> statement-breakpoint").map(statement => statement.trim()).filter(Boolean);
  const tables = statements.filter(statement => /^CREATE TABLE `/i.test(statement)).map(statement => {
    const match = statement.match(/^CREATE TABLE `([^`]+)`/i);
    if (!match) throw new Error("Unable to parse CREATE TABLE statement");
    const columns = [...statement.matchAll(/^\s*`([^`]+)`\s+/gm)].map(column => column[1]);
    return { name: match[1], columns, statement };
  });
  const indexes = statements.filter(statement => /^CREATE (?:UNIQUE )?INDEX `/i.test(statement)).map(statement => {
    const match = statement.match(/^CREATE (?:UNIQUE )?INDEX `([^`]+)` ON `([^`]+)`/i);
    if (!match) throw new Error("Unable to parse CREATE INDEX statement");
    return { name: match[1], table: match[2], statement };
  });
  return { tables, indexes };
}

function sameStringSet(expected, actual) {
  return expected.length === actual.length && expected.every(value => actual.includes(value));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for migration reconciliation");
  const migrationSql = await readFile(MIGRATION_PATH, "utf8");
  const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
  const { tables, indexes } = parseMigration(migrationSql);
  const connection = await mysql.createConnection(databaseUrl);

  try {
    const [schemaRows] = await connection.query("SELECT DATABASE() AS schemaName");
    const schemaName = schemaRows[0]?.schemaName;
    if (!schemaName) throw new Error("DATABASE_URL must select a database schema");

    const [migrationTableRows] = await connection.execute(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [schemaName, MIGRATIONS_TABLE],
    );
    if (Number(migrationTableRows[0]?.count ?? 0) === 0) {
      console.log("[migration-reconcile] no Drizzle history table; standard migrator will run");
      return;
    }

    const expectedTableNames = tables.map(table => table.name);
    const placeholders = expectedTableNames.map(() => "?").join(", ");
    const [existingRows] = await connection.execute(
      `SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = ? AND table_name IN (${placeholders})`,
      [schemaName, ...expectedTableNames],
    );
    const existingNames = new Set(existingRows.map(row => row.tableName));
    if (existingNames.size === 0) {
      console.log("[migration-reconcile] migration has not started; standard migrator will run");
      return;
    }

    const [markerRows] = await connection.execute(
      `SELECT COUNT(*) AS count FROM \`${MIGRATIONS_TABLE}\` WHERE created_at = ?`,
      [MIGRATION_MILLIS],
    );
    if (Number(markerRows[0]?.count ?? 0) > 0) {
      console.log("[migration-reconcile] migration marker already exists");
      return;
    }

    console.log(`[migration-reconcile] detected partial 0071 migration (${existingNames.size}/${tables.length} tables)`);
    for (const table of tables) {
      if (existingNames.has(table.name)) {
        const [columnRows] = await connection.execute(
          "SELECT column_name AS columnName FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
          [schemaName, table.name],
        );
        const actualColumns = columnRows.map(row => row.columnName);
        if (!sameStringSet(table.columns, actualColumns)) {
          throw new Error(`Existing table ${table.name} does not match migration columns; refusing automatic repair`);
        }
        continue;
      }
      await connection.query(table.statement);
      console.log(`[migration-reconcile] created missing table ${table.name}`);
    }

    for (const index of indexes) {
      const [indexRows] = await connection.execute(
        "SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?",
        [schemaName, index.table, index.name],
      );
      if (Number(indexRows[0]?.count ?? 0) === 0) {
        await connection.query(index.statement);
        console.log(`[migration-reconcile] created missing index ${index.name}`);
      }
    }

    for (const table of tables) {
      const [columnRows] = await connection.execute(
        "SELECT column_name AS columnName FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
        [schemaName, table.name],
      );
      if (!sameStringSet(table.columns, columnRows.map(row => row.columnName))) {
        throw new Error(`Post-repair validation failed for ${table.name}`);
      }
    }

    await connection.execute(
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (\`hash\`, \`created_at\`) VALUES (?, ?)`,
      [migrationHash, MIGRATION_MILLIS],
    );
    console.log(`[migration-reconcile] validated ${tables.length} tables and ${indexes.length} indexes; marker recorded`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(`[migration-reconcile] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

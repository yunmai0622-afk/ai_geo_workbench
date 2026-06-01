import mysql from "mysql2/promise";

/** GEO-V1-H：本地库未跑 drizzle/0031 时幂等补齐 projects.ownerUserId（不新增 migration 文件） */
async function columnExists(conn: mysql.Connection, table: string, column: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(conn: mysql.Connection, table: string, indexName: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, indexName],
  );
  return rows.length > 0;
}

export async function ensureProjectsOwnerUserIdColumn(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) return;

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(url);
    if (!(await columnExists(conn, "projects", "ownerUserId"))) {
      await conn.query("ALTER TABLE `projects` ADD COLUMN `ownerUserId` int NULL");
    }
    if (!(await indexExists(conn, "projects", "idx_projects_owner_user_id"))) {
      await conn.query("CREATE INDEX `idx_projects_owner_user_id` ON `projects` (`ownerUserId`)");
    }

    const [users] = await conn.query<mysql.RowDataPacket[]>("SELECT id FROM users ORDER BY id ASC");
    if (users.length === 1) {
      const userId = users[0]!.id;
      await conn.query(
        "UPDATE `projects` SET `ownerUserId` = ? WHERE `ownerUserId` IS NULL OR `ownerUserId` = 0",
        [userId],
      );
    }
  } catch (error) {
    console.warn("[Database] ensureProjectsOwnerUserIdColumn failed:", error);
  } finally {
    await conn?.end();
  }
}

let ensureOnce: Promise<void> | null = null;

export function ensureProjectsOwnerUserIdColumnOnce(): Promise<void> {
  if (!ensureOnce) {
    ensureOnce = ensureProjectsOwnerUserIdColumn();
  }
  return ensureOnce;
}

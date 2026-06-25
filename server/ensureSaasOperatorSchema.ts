import type mysql from "mysql2/promise";

async function columnExists(conn: mysql.Connection, table: string, column: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  const cnt = (rows as Array<{ cnt: number }>)[0]?.cnt ?? 0;
  return cnt > 0;
}

/** GEO-V2.3-P0：幂等补齐 operator 角色与客户 ownerUserId 列 */
export async function ensureSaasOperatorSchema(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) return;

  let conn: mysql.Connection | undefined;
  try {
    conn = await (await import("mysql2/promise")).createConnection(url);

    const [roleRows] = await conn.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
    );
    const roleType = (roleRows as Array<{ COLUMN_TYPE: string }>)[0]?.COLUMN_TYPE ?? "";
    if (!roleType.includes("operator")) {
      await conn.query(
        "ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','operator') NOT NULL DEFAULT 'user'",
      );
    }

    if (!(await columnExists(conn, "users", "operatorCompanyName"))) {
      await conn.query("ALTER TABLE `users` ADD COLUMN `operatorCompanyName` varchar(255) NULL");
    }

    if (!(await columnExists(conn, "customer_companies", "ownerUserId"))) {
      await conn.query("ALTER TABLE `customer_companies` ADD COLUMN `ownerUserId` int NULL");
    }

    const [idxRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_companies' AND INDEX_NAME = 'customer_companies_owner_user_idx'`,
    );
    if (((idxRows as Array<{ cnt: number }>)[0]?.cnt ?? 0) === 0) {
      await conn.query(
        "CREATE INDEX `customer_companies_owner_user_idx` ON `customer_companies` (`ownerUserId`)",
      );
    }
  } catch (error) {
    console.warn("[Database] ensureSaasOperatorSchema failed:", error);
  } finally {
    await conn?.end();
  }
}

let ensureOnce: Promise<void> | null = null;

export function ensureSaasOperatorSchemaOnce(): Promise<void> {
  if (!ensureOnce) {
    ensureOnce = ensureSaasOperatorSchema();
  }
  return ensureOnce;
}

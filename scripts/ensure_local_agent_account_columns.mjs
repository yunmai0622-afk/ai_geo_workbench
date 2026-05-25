#!/usr/bin/env node
/**
 * 幂等补齐 project_platform_accounts 本地 Agent 字段（0026）。
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const TABLE = "project_platform_accounts";
const COLUMNS = [
  ["localAgentId", "ADD COLUMN `localAgentId` varchar(100) NULL"],
  ["localProfileId", "ADD COLUMN `localProfileId` varchar(100) NULL"],
  ["sessionStatus", "ADD COLUMN `sessionStatus` varchar(30) NULL"],
  ["lastSessionCheckedAt", "ADD COLUMN `lastSessionCheckedAt` timestamp NULL"],
  ["lastLoginAt", "ADD COLUMN `lastLoginAt` timestamp NULL"],
];

async function exists(conn, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [TABLE, column],
  );
  return rows.length > 0;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
try {
  for (const [name, ddl] of COLUMNS) {
    if (await exists(conn, name)) {
      console.log(`${name}: exists`);
      continue;
    }
    await conn.query(`ALTER TABLE \`${TABLE}\` ${ddl}`);
    console.log(`${name}: added`);
  }
  console.log("done");
} finally {
  await conn.end();
}

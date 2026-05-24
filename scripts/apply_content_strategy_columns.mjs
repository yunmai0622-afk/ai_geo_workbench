#!/usr/bin/env node
import "dotenv/config";
import mysql from "mysql2/promise";

const ARTICLE_COLS = [
  ["contentStrategyType", "ADD COLUMN `contentStrategyType` varchar(50) NULL"],
  ["publishIdentity", "ADD COLUMN `publishIdentity` varchar(50) NULL"],
  ["recommendedAccountGroup", "ADD COLUMN `recommendedAccountGroup` varchar(50) NULL"],
];
const ACCOUNT_COLS = [
  ["accountGroup", "ADD COLUMN `accountGroup` varchar(50) NULL"],
  ["accountRole", "ADD COLUMN `accountRole` varchar(50) NULL"],
];

async function exists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows.length > 0;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const conn = await mysql.createConnection(url);
try {
  for (const [name, ddl] of ARTICLE_COLS) {
    if (await exists(conn, "geo_articles", name)) {
      console.log(`skip geo_articles.${name}`);
      continue;
    }
    await conn.query(`ALTER TABLE geo_articles ${ddl}`);
    console.log(`added geo_articles.${name}`);
  }
  for (const [name, ddl] of ACCOUNT_COLS) {
    if (await exists(conn, "project_platform_accounts", name)) {
      console.log(`skip project_platform_accounts.${name}`);
      continue;
    }
    await conn.query(`ALTER TABLE project_platform_accounts ${ddl}`);
    console.log(`added project_platform_accounts.${name}`);
  }
} finally {
  await conn.end();
}

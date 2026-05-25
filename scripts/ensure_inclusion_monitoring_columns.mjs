#!/usr/bin/env node
/**
 * 幂等补齐 geo_inclusion_monitoring_records 列（不删字段、不重建表）。
 * 用法：node scripts/ensure_inclusion_monitoring_columns.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const TABLE = "geo_inclusion_monitoring_records";

/** 列名 -> ALTER 片段（类型与 drizzle/schema.ts 一致） */
const COLUMNS = [
  ["publishRecordId", "ADD COLUMN `publishRecordId` int NOT NULL DEFAULT 0"],
  ["publicUrl", "ADD COLUMN `publicUrl` varchar(1000) NOT NULL DEFAULT ''"],
  [
    "inclusionMonitorStatus",
    "ADD COLUMN `inclusionMonitorStatus` enum('未检测','检测中','已收录','未收录','检测失败') NOT NULL DEFAULT '未检测'",
  ],
  [
    "aiMentionMonitorStatus",
    "ADD COLUMN `aiMentionMonitorStatus` enum('未检测','检测中','已提及','未提及','检测失败') NOT NULL DEFAULT '未检测'",
  ],
  [
    "aiRecommendMonitorStatus",
    "ADD COLUMN `aiRecommendMonitorStatus` enum('未检测','检测中','已推荐','未推荐','检测失败') NOT NULL DEFAULT '未检测'",
  ],
  ["lastCheckedAt", "ADD COLUMN `lastCheckedAt` timestamp NULL"],
  ["currentSuggestion", "ADD COLUMN `currentSuggestion` text NOT NULL"],
  ["optimizationSuggestions", "ADD COLUMN `optimizationSuggestions` json NOT NULL"],
  ["rawJson", "ADD COLUMN `rawJson` json NOT NULL"],
  ["aiTestResults", "ADD COLUMN `aiTestResults` json NULL"],
  ["lastAiTestedAt", "ADD COLUMN `lastAiTestedAt` timestamp NULL"],
  ["createdAt", "ADD COLUMN `createdAt` timestamp NOT NULL DEFAULT (now())"],
  ["updatedAt", "ADD COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP"],
];

async function columnExists(conn, column) {
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
  const [tables] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [TABLE],
  );
  if (tables.length === 0) {
    console.error(`table ${TABLE} does not exist — run drizzle migrations first`);
    process.exit(1);
  }

  for (const [name, ddl] of COLUMNS) {
    if (await columnExists(conn, name)) {
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

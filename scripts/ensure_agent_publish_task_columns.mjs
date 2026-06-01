/**
 * 确保 publish_tasks 含 Agent-2 字段（与 drizzle/0026_agent_publish_tasks.sql 一致）
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const cols = [
  ["localAgentId", "varchar(100) NULL"],
  ["localProfileId", "varchar(100) NULL"],
  ["agentPickedAt", "timestamp NULL"],
  ["agentFinishedAt", "timestamp NULL"],
  ["agentErrorType", "varchar(50) NULL"],
  ["agentErrorMessage", "text NULL"],
  ["agentLog", "json NULL"],
  ["draftUrl", "varchar(500) NULL"],
  ["publishedUrl", "varchar(500) NULL"],
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("需要 DATABASE_URL");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
try {
  for (const [name, def] of cols) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'publish_tasks' AND COLUMN_NAME = ?`,
      [name],
    );
    if (rows[0].c > 0) {
      console.log(`[ok] publish_tasks.${name}`);
      continue;
    }
    await conn.query(`ALTER TABLE publish_tasks ADD COLUMN \`${name}\` ${def}`);
    console.log(`[add] publish_tasks.${name}`);
  }
  console.log("done");
} finally {
  await conn.end();
}

/**
 * 确保 geo_articles 含生命周期字段（与 drizzle/0028_article_lifecycle.sql 一致）
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const cols = [
  ["lifecycleStatus", "varchar(32) NULL DEFAULT 'generated'"],
  ["lifecycleEvents", "json NULL"],
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
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'geo_articles' AND COLUMN_NAME = ?`,
      [name],
    );
    if (rows[0].c > 0) {
      console.log(`[ok] geo_articles.${name}`);
      continue;
    }
    await conn.query(`ALTER TABLE geo_articles ADD COLUMN \`${name}\` ${def}`);
    console.log(`[add] geo_articles.${name}`);
  }
  console.log("done");
} finally {
  await conn.end();
}

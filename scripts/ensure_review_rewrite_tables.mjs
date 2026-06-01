/**
 * 确保 geo_review_queue / geo_rewrite_pool 表存在（GEO-P0-C）
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(__dirname, "../drizzle/0030_review_rewrite_queue.sql"), "utf8");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("需要 DATABASE_URL");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
try {
  for (const stmt of sql.split(";").map(s => s.trim()).filter(Boolean)) {
    await conn.query(stmt);
  }
  console.log("[ok] geo_review_queue + geo_rewrite_pool");
} finally {
  await conn.end();
}

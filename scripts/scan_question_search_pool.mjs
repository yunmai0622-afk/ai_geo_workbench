#!/usr/bin/env node
/**
 * 扫描 questions 表 searchPoolType 分布（GEO-V2.2-P1）
 * 用法：node scripts/scan_question_search_pool.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL 未配置");
    process.exit(1);
  }

  const connection = await mysql.createConnection(url);
  try {
    const [nullRows] = await connection.query(
      "SELECT COUNT(*) AS cnt FROM questions WHERE searchPoolType IS NULL",
    );
    const [distribution] = await connection.query(
      "SELECT COALESCE(searchPoolType, '(null)') AS searchPoolType, COUNT(*) AS cnt FROM questions GROUP BY searchPoolType ORDER BY cnt DESC",
    );
    const [columns] = await connection.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'questions' AND column_name IN ('priorityLevel','businessValue','enabled','searchPoolType','questionType') ORDER BY column_name",
    );
    const [project180001] = await connection.query(
      "SELECT COALESCE(searchPoolType, '(null)') AS searchPoolType, COUNT(*) AS cnt FROM questions WHERE projectId = 180001 GROUP BY searchPoolType ORDER BY cnt DESC",
    );

    console.log("=== Question Search Pool Scan ===");
    console.log("A. searchPoolType IS NULL:", nullRows[0]?.cnt ?? 0);
    console.log("B. Distribution:");
    for (const row of distribution) {
      console.log(`  - ${row.searchPoolType}: ${row.cnt}`);
    }
    console.log("C. Sort-related columns:", columns.map(c => c.column_name ?? c.COLUMN_NAME).join(", "));
    console.log("D. projectId=180001 distribution:");
    for (const row of project180001) {
      console.log(`  - ${row.searchPoolType}: ${row.cnt}`);
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * 回填 questions.searchPoolType 为 null 的历史数据（GEO-V2.2-P1）
 * 用法：pnpm exec tsx scripts/backfill_question_search_pool_type.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { backfillAllNullSearchPoolTypes } from "../server/questionSearchPoolService";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL 未配置");
    process.exit(1);
  }

  const pool = mysql.createPool(url);
  const db = drizzle(pool);
  const updated = await backfillAllNullSearchPoolTypes(db);
  await pool.end();
  console.log(`[backfill] updated ${updated} question rows`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

/**
 * 复现 reviewAndEnqueueArticle 500：检查生产常见缺列并模拟 lifecycle 写入失败。
 *
 * 用法：pnpm exec tsx scripts/repro_review_enqueue_500.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const REQUIRED_COLUMNS: Array<{ table: string; column: string; step: string }> = [
  { table: "geo_articles", column: "lifecycleStatus", step: "appendArticleLifecycleEvent" },
  { table: "geo_articles", column: "lifecycleEvents", step: "appendArticleLifecycleEvent" },
  { table: "geo_articles", column: "contentReviewStatus", step: "update contentReviewStatus" },
  { table: "publish_tasks", column: "localAgentId", step: "insert publish_tasks" },
  { table: "publish_tasks", column: "localProfileId", step: "insert publish_tasks" },
  { table: "publish_tasks", column: "platformAccountId", step: "insert publish_tasks" },
  { table: "users", column: "extensionApiKey", step: "ensureUserExtensionApiKey" },
];

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("[repro] DATABASE_URL 未配置，无法连接数据库");
    process.exit(1);
  }

  const missing: typeof REQUIRED_COLUMNS = [];
  for (const req of REQUIRED_COLUMNS) {
    const rows = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ${req.table}
            AND COLUMN_NAME = ${req.column}`,
    );
    const cnt = Number((rows as unknown as Array<{ cnt: number }>)[0]?.[0]?.cnt ?? 0);
    if (cnt === 0) missing.push(req);
  }

  if (missing.length === 0) {
    console.log("[repro] 所有 reviewAndEnqueue 依赖列均已存在，缺列不是当前库的根因");
    return;
  }

  console.error("[repro] 检测到缺列（与 reviewAndEnqueueArticle 500 根因一致）：");
  for (const m of missing) {
    console.error(`  - ${m.table}.${m.column} → 失败步骤: ${m.step}`);
  }

  const probe = missing.find(m => m.column === "lifecycleStatus") ?? missing[0]!;
  try {
    await db.execute(
      sql.raw(`UPDATE \`${probe.table}\` SET \`${probe.column}\` = \`${probe.column}\` WHERE 1=0`),
    );
  } catch (err) {
    const e = err as Error & { code?: string; sqlMessage?: string };
    console.error("[repro] 模拟 SQL 写入失败:", {
      step: probe.step,
      code: e.code,
      message: e.message,
      sqlMessage: e.sqlMessage,
    });
    console.error("[repro] 结论: 生产库未执行 0061 migration 时，insert 后 lifecycle/contentReview 更新会 500");
    process.exit(2);
  }
}

main().catch(err => {
  console.error("[repro] unexpected", err);
  process.exit(1);
});

import { TRPCError } from "@trpc/server";
import { isNull, sql } from "drizzle-orm";
import { geoArticles, geoPublishRecords, projects, users } from "../drizzle/schema";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接不可用" });
  }
  return db;
}

function toCount(rows: { count: number }[]): number {
  const raw = rows[0]?.count;
  return typeof raw === "number" ? raw : Number(raw ?? 0);
}

export const adminStatsRouter = router({
  /** 管理员：系统使用统计（现有表聚合，无新表） */
  summary: adminProcedure.query(async () => {
    const db = await requireDb();

    const [
      registeredUserRows,
      activeProjectRows,
      publishRows,
      contentGenerationRows,
      todayActiveUserRows,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(isNull(projects.archivedAt)),
      db.select({ count: sql<number>`count(*)` }).from(geoPublishRecords),
      db.select({ count: sql<number>`count(*)` }).from(geoArticles),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(sql`DATE(${users.lastSignedIn}) = CURDATE()`),
    ]);

    return {
      totalRegisteredUsers: toCount(registeredUserRows),
      activeProjectCount: toCount(activeProjectRows),
      totalPublishCount: toCount(publishRows),
      totalContentGenerationCount: toCount(contentGenerationRows),
      todayActiveUserCount: toCount(todayActiveUserRows),
      sources: {
        totalRegisteredUsers: "users（全表 count）",
        activeProjectCount: "projects（archivedAt IS NULL）",
        totalPublishCount: "geo_publish_records（全表 count）",
        totalContentGenerationCount: "geo_articles（全表 count）",
        todayActiveUserCount: "users（DATE(lastSignedIn) = CURDATE()）",
      },
    } as const;
  }),
});

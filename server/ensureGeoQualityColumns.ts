import mysql from "mysql2/promise";

/** C7-A / C8-A：本地库未跑 drizzle 迁移时补齐 geo_articles 字段（幂等） */
const GEO_ARTICLE_QUALITY_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: "coverTemplate", ddl: "ADD COLUMN `coverTemplate` varchar(32) NULL" },
  { name: "coverImageUrl", ddl: "ADD COLUMN `coverImageUrl` varchar(2000) NULL" },
  { name: "coverBase64", ddl: "ADD COLUMN `coverBase64` mediumtext NULL" },
  { name: "geoQualityScore", ddl: "ADD COLUMN `geoQualityScore` int NULL" },
  { name: "geoQualityDetail", ddl: "ADD COLUMN `geoQualityDetail` json NULL" },
  { name: "geoQualityReviewedAt", ddl: "ADD COLUMN `geoQualityReviewedAt` timestamp NULL" },
  { name: "geoQualityModel", ddl: "ADD COLUMN `geoQualityModel` varchar(50) NULL" },
  { name: "geoQualityRecommendation", ddl: "ADD COLUMN `geoQualityRecommendation` varchar(20) NULL" },
  { name: "geoQualityStale", ddl: "ADD COLUMN `geoQualityStale` int NULL DEFAULT 0" },
  { name: "contentStrategyType", ddl: "ADD COLUMN `contentStrategyType` varchar(50) NULL" },
  { name: "publishIdentity", ddl: "ADD COLUMN `publishIdentity` varchar(50) NULL" },
  { name: "recommendedAccountGroup", ddl: "ADD COLUMN `recommendedAccountGroup` varchar(50) NULL" },
  { name: "contentTags", ddl: "ADD COLUMN `contentTags` json NULL" },
  { name: "lifecycleStatus", ddl: "ADD COLUMN `lifecycleStatus` varchar(32) NULL DEFAULT 'generated'" },
  { name: "lifecycleEvents", ddl: "ADD COLUMN `lifecycleEvents` json NULL" },
  { name: "contentEditedAt", ddl: "ADD COLUMN `contentEditedAt` timestamp NULL" },
  { name: "contentReviewStatus", ddl: "ADD COLUMN `contentReviewStatus` varchar(32) NULL DEFAULT '待审核'" },
];

const PROJECT_PLATFORM_ACCOUNT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: "accountGroup", ddl: "ADD COLUMN `accountGroup` varchar(50) NULL" },
  { name: "accountRole", ddl: "ADD COLUMN `accountRole` varchar(50) NULL" },
];

async function columnExists(
  conn: mysql.Connection,
  table: string,
  column: string,
): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

/** @deprecated 名称保留兼容；实际补齐 C7 封面 + C8 质检列 */
export async function ensureGeoQualityColumns(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) return;

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(url);
    for (const col of GEO_ARTICLE_QUALITY_COLUMNS) {
      if (await columnExists(conn, "geo_articles", col.name)) {
        if (col.name === "coverBase64") {
          await conn.query("ALTER TABLE `geo_articles` MODIFY COLUMN `coverBase64` mediumtext NULL");
        }
        continue;
      }
      await conn.query(`ALTER TABLE \`geo_articles\` ${col.ddl}`);
    }
    for (const col of PROJECT_PLATFORM_ACCOUNT_COLUMNS) {
      if (await columnExists(conn, "project_platform_accounts", col.name)) continue;
      await conn.query(`ALTER TABLE \`project_platform_accounts\` ${col.ddl}`);
    }
  } catch (error) {
    console.warn("[Database] ensureGeoQualityColumns failed:", error);
  } finally {
    await conn?.end();
  }
}

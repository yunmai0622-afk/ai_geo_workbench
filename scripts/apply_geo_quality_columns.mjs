#!/usr/bin/env node
/**
 * 幂等补齐 geo_articles 的 GEO 质检字段（0021 + 0022）。
 * 用法：node scripts/apply_geo_quality_columns.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const COLUMNS = [
  ["coverTemplate", "ADD COLUMN `coverTemplate` varchar(32) NULL"],
  ["coverImageUrl", "ADD COLUMN `coverImageUrl` varchar(2000) NULL"],
  ["coverBase64", "ADD COLUMN `coverBase64` text NULL"],
  ["geoQualityScore", "ADD COLUMN `geoQualityScore` int NULL"],
  ["geoQualityDetail", "ADD COLUMN `geoQualityDetail` json NULL"],
  ["geoQualityReviewedAt", "ADD COLUMN `geoQualityReviewedAt` timestamp NULL"],
  ["geoQualityModel", "ADD COLUMN `geoQualityModel` varchar(50) NULL"],
  ["geoQualityRecommendation", "ADD COLUMN `geoQualityRecommendation` varchar(20) NULL"],
  ["geoQualityStale", "ADD COLUMN `geoQualityStale` int NULL DEFAULT 0"],
];

async function exists(conn, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'geo_articles' AND COLUMN_NAME = ?`,
    [column],
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
  for (const [name, ddl] of COLUMNS) {
    if (await exists(conn, name)) {
      console.log(`skip ${name} (exists)`);
      continue;
    }
    await conn.query(`ALTER TABLE \`geo_articles\` ${ddl}`);
    console.log(`added ${name}`);
  }
  console.log("done");
} finally {
  await conn.end();
}

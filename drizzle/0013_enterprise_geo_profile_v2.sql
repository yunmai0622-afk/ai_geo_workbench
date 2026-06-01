-- 企业档案 V2：新增可空字段（旧列保留）；MySQL 使用 JSON 类型（非 jsonb）
ALTER TABLE `enterprise_geo_profiles`
  ADD COLUMN `brandName` text NULL,
  ADD COLUMN `industryTag` text NULL,
  ADD COLUMN `productDesc` text NULL,
  ADD COLUMN `mainChannel` text NULL,
  ADD COLUMN `targetCustomer` text NULL,
  ADD COLUMN `customerPains` json NULL,
  ADD COLUMN `competitors` json NULL,
  ADD COLUMN `hasCases` tinyint(1) NULL DEFAULT 0,
  ADD COLUMN `oneLiner` text NULL,
  ADD COLUMN `keyPoints` json NULL,
  ADD COLUMN `keywords` json NULL;

--> statement-breakpoint

-- 从旧字段一次性回填（仅在新 brandName 仍为空时执行，便于幂等重跑）
UPDATE `enterprise_geo_profiles`
SET
  `brandName` = `enterpriseName`,
  `industryTag` = NULLIF(TRIM(`industry`), ''),
  `targetCustomer` = NULLIF(TRIM(`targetCustomers`), ''),
  `productDesc` = CASE
    WHEN TRIM(COALESCE(`productServiceIntro`, '')) <> '' THEN TRIM(`productServiceIntro`)
    WHEN TRIM(COALESCE(`productIntro`, '')) <> '' THEN TRIM(`productIntro`)
    WHEN TRIM(COALESCE(`coreSellingPoints`, '')) <> '' THEN TRIM(`coreSellingPoints`)
    ELSE NULL
  END
WHERE `brandName` IS NULL;

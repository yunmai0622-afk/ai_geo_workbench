-- C8-A-Fix: 内容修改后标记 GEO 质检评分为过期
ALTER TABLE `geo_articles` ADD COLUMN `geoQualityStale` int NULL DEFAULT 0;

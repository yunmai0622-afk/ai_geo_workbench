-- C8-A: GEO 发布前内容质量评分字段（geo_articles）
ALTER TABLE `geo_articles` ADD COLUMN `geoQualityScore` int NULL;
ALTER TABLE `geo_articles` ADD COLUMN `geoQualityDetail` json NULL;
ALTER TABLE `geo_articles` ADD COLUMN `geoQualityReviewedAt` timestamp NULL;
ALTER TABLE `geo_articles` ADD COLUMN `geoQualityModel` varchar(50) NULL;
ALTER TABLE `geo_articles` ADD COLUMN `geoQualityRecommendation` varchar(20) NULL;

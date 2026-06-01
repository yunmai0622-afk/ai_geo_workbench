-- GEO-P0-B：文章生命周期（幂等补列）
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `lifecycleStatus` varchar(32) NULL DEFAULT 'generated';

ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `lifecycleEvents` json NULL;

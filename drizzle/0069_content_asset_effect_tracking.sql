-- GEO-V2.1-P1: 内容资产效果追踪字段（手动回填）
ALTER TABLE `geo_inclusion_monitoring_records`
  ADD COLUMN IF NOT EXISTS `effectInclusionStatus` varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS `inclusionVerifiedAt` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `inclusionKeywords` json NULL,
  ADD COLUMN IF NOT EXISTS `readCount` int NULL,
  ADD COLUMN IF NOT EXISTS `impressionCount` int NULL,
  ADD COLUMN IF NOT EXISTS `interactionCount` int NULL,
  ADD COLUMN IF NOT EXISTS `searchTriggerKeywords` json NULL,
  ADD COLUMN IF NOT EXISTS `effectDataSource` varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS `evidenceScreenshotUrl` varchar(2000) NULL,
  ADD COLUMN IF NOT EXISTS `evidenceNotes` text NULL;

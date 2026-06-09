-- GEO-V1.3-Debug-ReviewEnqueue: 幂等补丁，修复 reviewAndEnqueueArticle 线上缺列导致 500
-- 可在已部分迁移的环境重复执行

--> statement-breakpoint
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `lifecycleStatus` varchar(32) NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS `lifecycleEvents` json NULL,
  ADD COLUMN IF NOT EXISTS `contentReviewStatus` varchar(32) NOT NULL DEFAULT '待审核',
  ADD COLUMN IF NOT EXISTS `coverBase64` mediumtext NULL;

--> statement-breakpoint
ALTER TABLE `publish_tasks`
  ADD COLUMN IF NOT EXISTS `projectName` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `platformAccountId` int NULL,
  ADD COLUMN IF NOT EXISTS `expectedAccountName` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `detectedAccountName` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `accountVerificationStatus` varchar(32) NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS `coverImageUrl` text NULL,
  ADD COLUMN IF NOT EXISTS `localAgentId` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `localProfileId` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `agentPickedAt` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `agentFinishedAt` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `agentErrorType` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `agentErrorMessage` text NULL,
  ADD COLUMN IF NOT EXISTS `agentLog` json NULL,
  ADD COLUMN IF NOT EXISTS `draftUrl` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `publishedUrl` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `retryCount` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `retryLog` json NULL;

--> statement-breakpoint
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `extensionApiKey` varchar(100) NULL;

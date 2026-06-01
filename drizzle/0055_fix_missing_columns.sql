-- GEO-V1.1-Fix-DB-Schema-Missing-Columns: 幂等补丁，修复线上未执行 ALTER 的缺失列
-- 可在已部分迁移的环境重复执行

--> statement-breakpoint
ALTER TABLE `competitor_profiles`
  ADD COLUMN IF NOT EXISTS `positioning` text NULL,
  ADD COLUMN IF NOT EXISTS `strengths` text NULL,
  ADD COLUMN IF NOT EXISTS `weaknesses` text NULL,
  ADD COLUMN IF NOT EXISTS `priceInfo` text NULL,
  ADD COLUMN IF NOT EXISTS `contentAssets` text NULL,
  ADD COLUMN IF NOT EXISTS `aiMentionCount` int NOT NULL DEFAULT 0;

--> statement-breakpoint
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `contentTags` json NULL,
  ADD COLUMN IF NOT EXISTS `contentReviewStatus` varchar(32) NOT NULL DEFAULT '待审核',
  ADD COLUMN IF NOT EXISTS `publishedAt` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `contentEditedAt` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `targetQuestionId` varchar(36) NULL,
  ADD COLUMN IF NOT EXISTS `targetGapType` varchar(64) NULL;

--> statement-breakpoint
ALTER TABLE `publish_tasks`
  ADD COLUMN IF NOT EXISTS `retryCount` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `retryLog` json NULL;

--> statement-breakpoint
ALTER TABLE `questions`
  ADD COLUMN IF NOT EXISTS `contentGapTags` json NULL;

--> statement-breakpoint
ALTER TABLE `projects`
  ADD COLUMN IF NOT EXISTS `archivedAt` timestamp NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_projects_archived_at` ON `projects` (`archivedAt`);

--> statement-breakpoint
ALTER TABLE `geo_system_config`
  ADD COLUMN IF NOT EXISTS `systemAnnouncementEnabled` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `systemAnnouncementBody` text NULL,
  ADD COLUMN IF NOT EXISTS `systemAnnouncementUpdatedAt` timestamp NULL;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_feedbacks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `projectId` int,
  `type` enum('bug','suggestion','other') NOT NULL,
  `description` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `user_feedbacks_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_feedbacks_user_id` ON `user_feedbacks` (`userId`);

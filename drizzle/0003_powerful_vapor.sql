ALTER TABLE `content_templates` RENAME COLUMN `optimizationTaskId` TO `optimization_task_id`;--> statement-breakpoint
ALTER TABLE `optimization_tasks` RENAME COLUMN `publishedUrl` TO `published_url`;--> statement-breakpoint
ALTER TABLE `optimization_tasks` RENAME COLUMN `completedAt` TO `completed_at`;--> statement-breakpoint
ALTER TABLE `optimization_tasks` RENAME COLUMN `needRetest` TO `need_retest`;
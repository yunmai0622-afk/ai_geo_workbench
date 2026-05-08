ALTER TABLE `content_templates` RENAME COLUMN `taskId` TO `optimizationTaskId`;--> statement-breakpoint
ALTER TABLE `optimization_tasks` RENAME COLUMN `taskStatus` TO `status`;--> statement-breakpoint
ALTER TABLE `optimization_tasks` MODIFY COLUMN `status` enum('todo','doing','done','retest') NOT NULL DEFAULT 'todo';--> statement-breakpoint
ALTER TABLE `optimization_tasks` ADD `publishedUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `optimization_tasks` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `optimization_tasks` ADD `needRetest` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `status` enum('created','questions_ready','responses_imported','analysis_done','score_done','tasks_ready','report_ready') DEFAULT 'created' NOT NULL;
ALTER TABLE `analysis_results` ADD `manual_override_json` json;--> statement-breakpoint
ALTER TABLE `analysis_results` ADD `manually_reviewed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysis_results` ADD `reviewed_at` timestamp;--> statement-breakpoint
ALTER TABLE `analysis_results` ADD `review_note` text;
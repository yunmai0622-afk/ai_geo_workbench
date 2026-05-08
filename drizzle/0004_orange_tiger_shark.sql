ALTER TABLE `questions` MODIFY COLUMN `questionType` enum('品牌认知','行业推荐','竞品对比','痛点解决','价格选型','高意向成交','指定问题') NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `targetKeyword` varchar(255);--> statement-breakpoint
ALTER TABLE `questions` ADD `intentLevel` varchar(64) DEFAULT '中' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `businessValue` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `source` enum('ai_generated','manual','csv') DEFAULT 'ai_generated' NOT NULL;
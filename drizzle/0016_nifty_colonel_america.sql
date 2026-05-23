CREATE TABLE `delivery_report_share_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`projectId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`isEnabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `delivery_report_share_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_report_share_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `publish_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`platform` varchar(50) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`articleTitle` text NOT NULL,
	`articleContent` text NOT NULL,
	`coverImageUrl` varchar(2000),
	`resultUrl` varchar(500),
	`errorMessage` text,
	`apiKey` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publish_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `geo_article_topics` MODIFY COLUMN `status` enum('待生成','已生成','待质检','质检通过','待审核','审核通过','已发布','待复测','质检未通过','需人工审核','审核未通过') NOT NULL DEFAULT '待生成';--> statement-breakpoint
ALTER TABLE `geo_articles` MODIFY COLUMN `status` enum('待生成','已生成','待质检','质检通过','待审核','审核通过','已发布','待复测','质检未通过','需人工审核','审核未通过') NOT NULL DEFAULT '待质检';--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `brandName` text;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `industryTag` text;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `productDesc` text;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `mainChannel` text;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetCustomer` text;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `customerPains` json;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `competitors` json;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `hasCases` boolean;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `oneLiner` text;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `keyPoints` json;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `keywords` json;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `coverTemplate` varchar(32);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `coverImageUrl` varchar(2000);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `coverBase64` text;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `aiTestResults` json;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `lastAiTestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `extensionApiKey` varchar(100);
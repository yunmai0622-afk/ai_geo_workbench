CREATE TABLE `content_plan_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`topicId` int,
	`articleId` int,
	`targetPlatform` varchar(255) NOT NULL,
	`contentType` varchar(255) NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT '待生成',
	`differentiationAngle` text,
	`duplicateRisk` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_plan_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`planName` varchar(255) NOT NULL,
	`weekStartDate` varchar(32) NOT NULL,
	`weeklyArticleCount` int NOT NULL DEFAULT 3,
	`targetPlatforms` json NOT NULL,
	`contentTypes` json NOT NULL,
	`linkedOptimizationTaskIds` json NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT '已配置',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_plans_id` PRIMARY KEY(`id`)
);

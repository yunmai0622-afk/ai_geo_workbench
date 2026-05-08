CREATE TABLE `geo_article_quality_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`problemMatchScore` int NOT NULL DEFAULT 0,
	`evidenceScore` int NOT NULL DEFAULT 0,
	`structureScore` int NOT NULL DEFAULT 0,
	`originalityScore` int NOT NULL DEFAULT 0,
	`geoCitableScore` int NOT NULL DEFAULT 0,
	`complianceScore` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 0,
	`blocked` int NOT NULL DEFAULT 0,
	`blockReasons` json NOT NULL,
	`reviewSummary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_article_quality_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_article_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`optimizationTaskId` int,
	`sourceAnalysisIds` json NOT NULL,
	`sourceQuestionIds` json NOT NULL,
	`title` varchar(255) NOT NULL,
	`articleType` enum('官网版 GEO 文章','问答型 GEO 文章','竞品对比型 GEO 文章','行业选型型 GEO 文章') NOT NULL,
	`contentGap` text NOT NULL,
	`businessReason` text NOT NULL,
	`status` enum('待生成','已生成','待质检','质检通过','待审核','审核通过','已发布','待复测','质检未通过','审核未通过') NOT NULL DEFAULT '待生成',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_article_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`topicId` int NOT NULL,
	`optimizationTaskId` int,
	`title` varchar(255) NOT NULL,
	`articleType` enum('官网版 GEO 文章','问答型 GEO 文章','竞品对比型 GEO 文章','行业选型型 GEO 文章') NOT NULL,
	`markdownContent` text NOT NULL,
	`thirdPartyMaterials` json NOT NULL,
	`status` enum('待生成','已生成','待质检','质检通过','待审核','审核通过','已发布','待复测','质检未通过','审核未通过') NOT NULL DEFAULT '已生成',
	`publicPath` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_publish_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`optimizationTaskId` int,
	`publishChannel` enum('系统内置 GEO 内容页') NOT NULL,
	`publishUrl` varchar(1000) NOT NULL,
	`publishStatus` varchar(64) NOT NULL DEFAULT '已发布',
	`qualityScore` int NOT NULL DEFAULT 0,
	`needRetest` int NOT NULL DEFAULT 1,
	`notes` text,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_publish_records_id` PRIMARY KEY(`id`)
);

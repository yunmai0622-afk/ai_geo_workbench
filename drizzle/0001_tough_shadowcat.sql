CREATE TABLE `ai_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`questionId` int,
	`questionText` text NOT NULL,
	`aiPlatform` enum('ChatGPT','DeepSeek','豆包','Kimi','通义','文心','Perplexity','其他') NOT NULL,
	`rawAnswer` text NOT NULL,
	`checkedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysis_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`aiResponseId` int NOT NULL,
	`mentionsEnterprise` int NOT NULL DEFAULT 0,
	`recommendsEnterprise` int NOT NULL DEFAULT 0,
	`mentionsCompetitors` int NOT NULL DEFAULT 0,
	`recommendedCompetitors` json NOT NULL,
	`enterpriseWins` int NOT NULL DEFAULT 0,
	`recommendationReason` text,
	`notRecommendedReason` text,
	`hasMisconception` int NOT NULL DEFAULT 0,
	`contentGap` text,
	`optimizationSuggestion` text,
	`rawJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysis_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`taskId` int,
	`templateType` enum('官网首页模板','FAQ 模板','竞品对比页模板','客户案例页模板','行业选型文章模板') NOT NULL,
	`title` varchar(255) NOT NULL,
	`markdownContent` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`aiVisibilityScore` int NOT NULL DEFAULT 0,
	`aiRecommendationScore` int NOT NULL DEFAULT 0,
	`competitorWinScore` int NOT NULL DEFAULT 0,
	`cognitionAccuracyScore` int NOT NULL DEFAULT 0,
	`contentAssetScore` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 0,
	`visibilityLevel` enum('弱可见','初步可见','良好可见','强势推荐') NOT NULL,
	`calculationDetail` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `optimization_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`taskType` enum('官网首页','产品页','竞品对比页','FAQ','客户案例','行业文章','社媒内容') NOT NULL,
	`taskName` varchar(255) NOT NULL,
	`taskPriority` enum('P0','P1','P2') NOT NULL,
	`generationReason` text NOT NULL,
	`executionSuggestion` text NOT NULL,
	`expectedImpact` text NOT NULL,
	`taskStatus` enum('待处理','进行中','已完成') NOT NULL DEFAULT '待处理',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `optimization_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enterpriseName` varchar(255) NOT NULL,
	`industry` varchar(255) NOT NULL,
	`website` varchar(500) NOT NULL,
	`region` varchar(255) NOT NULL,
	`productIntro` text NOT NULL,
	`targetCustomers` text NOT NULL,
	`coreSellingPoints` text NOT NULL,
	`competitorNames` json NOT NULL,
	`coreKeywords` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`questionText` text NOT NULL,
	`questionType` enum('品牌认知','行业推荐','竞品对比','痛点解决','价格选型','高意向成交') NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`geoScoreId` int,
	`oneSentenceConclusion` text NOT NULL,
	`totalScore` int NOT NULL DEFAULT 0,
	`mentionRecommendationSummary` text NOT NULL,
	`competitorAnalysis` text NOT NULL,
	`coreProblems` text NOT NULL,
	`contentGaps` text NOT NULL,
	`thirtyDayActions` text NOT NULL,
	`markdownContent` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);

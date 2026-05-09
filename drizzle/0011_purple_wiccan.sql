CREATE TABLE `geo_inclusion_monitoring_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`publishRecordId` int NOT NULL,
	`publicUrl` varchar(1000) NOT NULL,
	`inclusionMonitorStatus` enum('未检测','检测中','已收录','未收录','检测失败') NOT NULL DEFAULT '未检测',
	`aiMentionMonitorStatus` enum('未检测','检测中','已提及','未提及','检测失败') NOT NULL DEFAULT '未检测',
	`aiRecommendMonitorStatus` enum('未检测','检测中','已推荐','未推荐','检测失败') NOT NULL DEFAULT '未检测',
	`lastCheckedAt` timestamp,
	`currentSuggestion` text NOT NULL,
	`optimizationSuggestions` json NOT NULL,
	`rawJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_inclusion_monitoring_records_id` PRIMARY KEY(`id`)
);

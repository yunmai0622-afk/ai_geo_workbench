CREATE TABLE IF NOT EXISTS `monthly_optimization_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`roundNumber` int NOT NULL DEFAULT 1,
	`monthlyOptimizationPlanStatus` enum('active','completed') NOT NULL DEFAULT 'active',
	`baselineMaturityScore` int NOT NULL,
	`baselineDimensionScores` json NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`retestScheduledAt` timestamp,
	`retestCompletedAt` timestamp,
	`resultMaturityScore` int,
	`resultDimensionScores` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_optimization_plans_id` PRIMARY KEY(`id`)
);

CREATE INDEX `monthly_optimization_plans_project_status_idx` ON `monthly_optimization_plans` (`projectId`,`monthlyOptimizationPlanStatus`);

CREATE TABLE IF NOT EXISTS `monthly_optimization_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`projectId` int NOT NULL,
	`monthlyOptimizationTaskType` enum('content_generation','source_discovery','evidence_addition','profile_completion') NOT NULL,
	`targetDimension` varchar(64) NOT NULL,
	`relatedQuestionId` int,
	`title` varchar(255) NOT NULL,
	`reason` text NOT NULL,
	`monthlyOptimizationTaskStatus` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`linkedEntityId` int,
	`actionUrl` varchar(500) NOT NULL,
	`metadata` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_optimization_tasks_id` PRIMARY KEY(`id`)
);

CREATE INDEX `monthly_optimization_tasks_plan_idx` ON `monthly_optimization_tasks` (`planId`);
CREATE INDEX `monthly_optimization_tasks_project_idx` ON `monthly_optimization_tasks` (`projectId`);

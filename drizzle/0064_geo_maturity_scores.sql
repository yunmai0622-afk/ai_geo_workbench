CREATE TABLE `geo_maturity_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`totalScore` int NOT NULL,
	`brandIdentityScore` int,
	`categoryPositioningScore` int,
	`questionCoverageScore` int,
	`sourceGraphScore` int,
	`trustEvidenceScore` int,
	`aiTestPerformanceScore` int,
	`calculationDetail` json,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_maturity_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `geo_maturity_scores_project_unique` UNIQUE(`projectId`)
);

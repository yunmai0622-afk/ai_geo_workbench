-- GEO V1.1 Phase 1: test_rounds / ai_test_runs / retest_comparisons

CREATE TABLE `test_rounds` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`roundType` enum('T0_BASELINE','T1_RETEST','T2_RETEST','T3_RETEST') NOT NULL,
	`roundName` varchar(255) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`platforms` json NOT NULL,
	`questionsCount` int NOT NULL DEFAULT 0,
	`runsPerQuestion` int NOT NULL DEFAULT 3,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_rounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_test_runs` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`roundId` varchar(36) NOT NULL,
	`questionId` int NOT NULL,
	`platform` varchar(64) NOT NULL,
	`runIndex` int NOT NULL,
	`testedAt` timestamp NOT NULL,
	`rawAnswer` text NOT NULL,
	`mentionedCompany` boolean NOT NULL DEFAULT false,
	`recommendedCompany` boolean NOT NULL DEFAULT false,
	`descriptionAccurate` boolean,
	`competitorMentioned` boolean NOT NULL DEFAULT false,
	`competitorNames` json NOT NULL,
	`hasSourceLinks` boolean NOT NULL DEFAULT false,
	`sourceLinks` json,
	`suspectedContentClues` text,
	`manualNote` text,
	`screenshotUrl` varchar(2000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_test_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `retest_comparisons` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`baseRoundId` varchar(36) NOT NULL,
	`compareRoundId` varchar(36) NOT NULL,
	`questionType` varchar(64) NOT NULL,
	`platform` varchar(64) NOT NULL,
	`baseMentionCount` int NOT NULL DEFAULT 0,
	`compareMentionCount` int NOT NULL DEFAULT 0,
	`baseRecommendCount` int NOT NULL DEFAULT 0,
	`compareRecommendCount` int NOT NULL DEFAULT 0,
	`baseCompetitorCount` int NOT NULL DEFAULT 0,
	`compareCompetitorCount` int NOT NULL DEFAULT 0,
	`changeDirection` enum('up','flat','down','unknown') NOT NULL,
	`systemConclusion` text NOT NULL,
	`confidenceLevel` enum('high','medium','low','observe_more') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `retest_comparisons_id` PRIMARY KEY(`id`)
);

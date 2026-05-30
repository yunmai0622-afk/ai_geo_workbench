-- GEO V1.1 Phase 2: effective_actions（有效动作库）

CREATE TABLE `effective_actions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`industry` varchar(255) NOT NULL,
	`customerType` varchar(255) NOT NULL,
	`questionType` varchar(64) NOT NULL,
	`actionType` varchar(64) NOT NULL,
	`actionName` varchar(255) NOT NULL,
	`platform` varchar(64) NOT NULL,
	`publishedUrl` varchar(2000),
	`executedAt` timestamp NOT NULL,
	`baseRoundId` varchar(36),
	`compareRoundId` varchar(36),
	`baseMentionCount` int,
	`compareMentionCount` int,
	`changeDirection` varchar(32),
	`effectLevel` varchar(64) NOT NULL,
	`manualConclusion` text,
	`applicableCondition` text,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `effective_actions_id` PRIMARY KEY(`id`)
);

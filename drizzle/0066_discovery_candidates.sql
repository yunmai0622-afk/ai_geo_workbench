CREATE TABLE `discovery_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`candidateType` enum('source','trust_evidence') NOT NULL,
	`title` varchar(500) NOT NULL,
	`url` varchar(2000) NOT NULL,
	`snippet` text,
	`sourceDomain` varchar(255),
	`suggestedRecordType` varchar(64) NOT NULL,
	`confidence` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`detectedSignals` json NOT NULL DEFAULT ('{}'),
	`status` enum('pending','accepted','ignored') NOT NULL DEFAULT 'pending',
	`acceptedRecordId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discovery_candidates_id` PRIMARY KEY(`id`)
);

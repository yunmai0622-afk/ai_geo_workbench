CREATE TABLE `trust_evidence_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`evidenceType` enum('case','certificate','media_coverage','customer_review','partnership','award','data_proof','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text,
	`content` text,
	`sourceUrl` varchar(2000),
	`isPublic` boolean NOT NULL DEFAULT true,
	`verificationStatus` enum('draft','verified','rejected') NOT NULL DEFAULT 'draft',
	`displayOrder` int NOT NULL DEFAULT 0,
	`linkedCustomerCaseId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_evidence_items_id` PRIMARY KEY(`id`)
);

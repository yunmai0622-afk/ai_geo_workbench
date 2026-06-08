CREATE TABLE `brand_source_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`platform` varchar(64) NOT NULL,
	`platformName` varchar(255),
	`url` varchar(2000),
	`isPubliclyAccessible` boolean NOT NULL DEFAULT false,
	`containsBrandName` boolean NOT NULL DEFAULT false,
	`containsOfficialSite` boolean NOT NULL DEFAULT false,
	`containsCoreKeywords` boolean NOT NULL DEFAULT false,
	`aiCitationConfirmed` boolean NOT NULL DEFAULT false,
	`isCrossSourceConsistent` boolean NOT NULL DEFAULT false,
	`notes` text,
	`lastVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_source_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entity_anchors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`brandName` varchar(255),
	`companyName` varchar(255),
	`coreBusiness` text,
	`targetCustomer` text,
	`coreKeywords` json NOT NULL DEFAULT ('[]'),
	`officialSite` varchar(500),
	`founderName` varchar(255),
	`typicalCases` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_anchors_id` PRIMARY KEY(`id`),
	CONSTRAINT `entity_anchors_project_id_unique` UNIQUE(`projectId`)
);

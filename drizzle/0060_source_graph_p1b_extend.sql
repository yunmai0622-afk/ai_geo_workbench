ALTER TABLE `brand_source_records` ADD `sourceName` varchar(255);--> statement-breakpoint
ALTER TABLE `brand_source_records` ADD `containsBusinessDescription` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `brand_source_records` ADD `riskLevel` enum('low','medium','high') DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE `brand_source_records` ADD `riskNotes` text;--> statement-breakpoint
CREATE TABLE `entity_consistency_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`anchorType` enum('brand_name','company_name','main_business','target_customer','core_product','official_url','target_keywords','customer_proof') NOT NULL,
	`standardValue` text,
	`observedValues` json NOT NULL DEFAULT ('[]'),
	`status` enum('consistent','partial','missing','conflict') NOT NULL,
	`score` int NOT NULL,
	`issueSummary` text,
	`suggestion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_consistency_checks_id` PRIMARY KEY(`id`),
	CONSTRAINT `entity_consistency_checks_project_anchor_unique` UNIQUE(`projectId`,`anchorType`)
);
--> statement-breakpoint
CREATE TABLE `source_enhancement_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`suggestionTitle` varchar(255) NOT NULL,
	`gapType` varchar(64) NOT NULL,
	`targetPlatform` varchar(64),
	`targetKeywords` json NOT NULL DEFAULT ('[]'),
	`contentDirection` text NOT NULL,
	`priority` enum('P0','P1','P2') NOT NULL,
	`status` enum('pending','accepted','content_task_created','ignored','verified') NOT NULL DEFAULT 'pending',
	`linkedTaskId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_enhancement_suggestions_id` PRIMARY KEY(`id`)
);

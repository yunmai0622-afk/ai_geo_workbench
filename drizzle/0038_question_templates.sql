CREATE TABLE `question_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`platform` varchar(64) NOT NULL,
	`questionType` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`promptTemplate` text NOT NULL,
	`description` text,
	`isBuiltin` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_templates_slug_unique` UNIQUE(`slug`)
);

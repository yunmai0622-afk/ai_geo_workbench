CREATE TABLE `project_platform_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `projectId` int NOT NULL,
  `platform` varchar(50) NOT NULL,
  `accountName` varchar(255) NOT NULL,
  `accountIdOrUrl` varchar(2000),
  `isEnabled` int NOT NULL DEFAULT 1,
  `verificationStatus` varchar(32) NOT NULL DEFAULT 'unknown',
  `lastVerifiedAt` timestamp,
  `lastDetectedAccountName` varchar(255),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `project_platform_accounts_id` PRIMARY KEY(`id`),
  CONSTRAINT `project_platform_accounts_project_platform` UNIQUE(`projectId`,`platform`)
);

--> statement-breakpoint
CREATE INDEX `project_platform_accounts_projectId_idx` ON `project_platform_accounts` (`projectId`);

--> statement-breakpoint
ALTER TABLE `publish_tasks` MODIFY `status` varchar(32) NOT NULL DEFAULT 'pending';

--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `projectName` varchar(255);

--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `platformAccountId` int;

--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `expectedAccountName` varchar(255);

--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `detectedAccountName` varchar(255);

--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `accountVerificationStatus` varchar(32) DEFAULT 'pending';

--> statement-breakpoint
CREATE INDEX `publish_tasks_platformAccountId_idx` ON `publish_tasks` (`platformAccountId`);

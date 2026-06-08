ALTER TABLE `questions` ADD `searchPoolType` varchar(64);
--> statement-breakpoint
ALTER TABLE `questions` ADD `targetKeywords` json;
--> statement-breakpoint
ALTER TABLE `questions` ADD `targetCustomerScene` text;
--> statement-breakpoint
ALTER TABLE `questions` ADD `relatedGeoGap` text;
--> statement-breakpoint
ALTER TABLE `questions` ADD `relatedContentTask` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `questions` ADD `requiredSourceTypes` json;
--> statement-breakpoint
ALTER TABLE `questions` ADD `requiredEntityAnchors` json;
--> statement-breakpoint
ALTER TABLE `questions` ADD `priorityLevel` varchar(16);
--> statement-breakpoint
ALTER TABLE `questions` ADD `lastTestResult` varchar(32);
--> statement-breakpoint
ALTER TABLE `questions` ADD `lastTestedAt` timestamp;

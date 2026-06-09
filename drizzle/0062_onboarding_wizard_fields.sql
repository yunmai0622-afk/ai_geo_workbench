ALTER TABLE `enterprise_geo_profiles` ADD `wizardStep` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `wizardCompletedAt` timestamp;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetMentionRate` int;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetRecommendationRate` int;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetPlatforms` json DEFAULT ('[]') NOT NULL;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetQuestionCategories` json DEFAULT ('[]') NOT NULL;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetCompetitorsToBeat` json DEFAULT ('[]') NOT NULL;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `monthlyContentCapacity` int;
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `internalOwnerName` varchar(255);
--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `geoGoalNotes` text;
--> statement-breakpoint
ALTER TABLE `entity_anchors` ADD `manualOverride` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `entity_anchors` ADD `lastSyncedFrom` varchar(64);
--> statement-breakpoint
ALTER TABLE `entity_anchors` ADD `lastSyncedAt` timestamp;
--> statement-breakpoint
ALTER TABLE `questions` MODIFY COLUMN `source` enum('ai_generated','manual','csv','onboarding_wizard') NOT NULL DEFAULT 'ai_generated';

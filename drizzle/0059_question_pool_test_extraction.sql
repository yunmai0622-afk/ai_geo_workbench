ALTER TABLE `ai_responses` ADD `extractedMentioned` boolean;
--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedRecommended` boolean;
--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedCitations` json;
--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedCompetitors` json;
--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedSentiment` varchar(16);
--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractionMethod` varchar(16);
--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedAt` timestamp;
--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `questionPoolType` varchar(64);
--> statement-breakpoint
ALTER TABLE `test_rounds` ADD `sourceQuestionPoolSize` int;
--> statement-breakpoint
ALTER TABLE `test_rounds` ADD `platformsIncluded` json;
--> statement-breakpoint
ALTER TABLE `test_rounds` ADD `scheduledType` varchar(32);
--> statement-breakpoint
ALTER TABLE `test_rounds` ADD `comparedToRoundId` varchar(36);

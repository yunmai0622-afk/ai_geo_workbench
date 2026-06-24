CREATE TABLE `ai_test_runs` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`roundId` varchar(36) NOT NULL,
	`questionId` int NOT NULL,
	`platform` varchar(64) NOT NULL,
	`runIndex` int NOT NULL,
	`testedAt` timestamp NOT NULL,
	`rawAnswer` text NOT NULL,
	`mentionedCompany` boolean NOT NULL DEFAULT false,
	`recommendedCompany` boolean NOT NULL DEFAULT false,
	`descriptionAccurate` boolean,
	`competitorMentioned` boolean NOT NULL DEFAULT false,
	`competitorNames` json NOT NULL,
	`hasSourceLinks` boolean NOT NULL DEFAULT false,
	`sourceLinks` json,
	`suspectedContentClues` text,
	`manualNote` text,
	`screenshotUrl` varchar(2000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_test_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_test_runs_round_question_platform_run_unique` UNIQUE(`roundId`,`questionId`,`platform`,`runIndex`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`action` varchar(64) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_source_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`platform` varchar(64) NOT NULL,
	`sourceName` varchar(255),
	`platformName` varchar(255),
	`url` varchar(2000),
	`isPubliclyAccessible` boolean NOT NULL DEFAULT false,
	`containsBrandName` boolean NOT NULL DEFAULT false,
	`containsBusinessDescription` boolean NOT NULL DEFAULT false,
	`containsOfficialSite` boolean NOT NULL DEFAULT false,
	`containsCoreKeywords` boolean NOT NULL DEFAULT false,
	`aiCitationConfirmed` boolean NOT NULL DEFAULT false,
	`isCrossSourceConsistent` boolean NOT NULL DEFAULT false,
	`brand_source_risk_level` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`riskNotes` text,
	`notes` text,
	`lastVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_source_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_projects_project_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `company_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`planType` enum('trial','basic','pro','agency','custom') NOT NULL,
	`planName` varchar(120) NOT NULL,
	`status` enum('trial','active','expired','paused','cancelled') NOT NULL DEFAULT 'trial',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`maxProjects` int NOT NULL DEFAULT 1,
	`monthlyAiTests` int NOT NULL DEFAULT 10,
	`monthlyContentTasks` int NOT NULL DEFAULT 20,
	`monthlyReports` int NOT NULL DEFAULT 1,
	`maxTeamMembers` int NOT NULL DEFAULT 5,
	`enabledFeatures` json NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_subscriptions_company_unique` UNIQUE(`companyId`)
);
--> statement-breakpoint
CREATE TABLE `customer_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`contactName` varchar(120),
	`contactPhone` varchar(64),
	`contactEmail` varchar(320),
	`industry` varchar(255),
	`sourceChannel` varchar(120),
	`status` enum('pending','active','rejected','disabled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`approvedAt` timestamp,
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
	`manualOverride` boolean NOT NULL DEFAULT false,
	`lastSyncedFrom` varchar(64),
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_anchors_id` PRIMARY KEY(`id`),
	CONSTRAINT `entity_anchors_project_id_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `entity_consistency_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`entity_anchor_type` enum('brand_name','company_name','main_business','target_customer','core_product','official_url','target_keywords','customer_proof') NOT NULL,
	`standardValue` text,
	`observedValues` json NOT NULL DEFAULT ('[]'),
	`entity_consistency_status` enum('consistent','partial','missing','conflict') NOT NULL,
	`score` int NOT NULL,
	`issueSummary` text,
	`suggestion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_consistency_checks_id` PRIMARY KEY(`id`),
	CONSTRAINT `entity_consistency_checks_project_anchor_unique` UNIQUE(`projectId`,`entity_anchor_type`)
);
--> statement-breakpoint
CREATE TABLE `geo_maturity_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`totalScore` int NOT NULL,
	`brandIdentityScore` int,
	`categoryPositioningScore` int,
	`questionCoverageScore` int,
	`sourceGraphScore` int,
	`trustEvidenceScore` int,
	`aiTestPerformanceScore` int,
	`calculationDetail` json,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_maturity_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_review_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`projectId` int NOT NULL,
	`triggerStatus` varchar(32) NOT NULL,
	`reviewType` varchar(32) NOT NULL,
	`scheduledAt` timestamp,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`result` json,
	`publishTaskId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_review_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_rewrite_pool` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`projectId` int NOT NULL,
	`triggerStatus` varchar(32) NOT NULL,
	`source` varchar(64) NOT NULL,
	`reason` text NOT NULL,
	`publishTaskId` int,
	`status` varchar(32) NOT NULL DEFAULT 'open',
	`suggestionText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_rewrite_pool_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_system_config` (
	`id` int NOT NULL DEFAULT 1,
	`contentGenerationPerMinuteLimit` int NOT NULL,
	`t0DetectionPerHourLimit` int NOT NULL,
	`qualityMinPassScore` int NOT NULL,
	`defaultPublishPlatforms` json NOT NULL,
	`systemAnnouncementEnabled` int NOT NULL DEFAULT 0,
	`systemAnnouncementBody` text,
	`systemAnnouncementUpdatedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedByUserId` int,
	CONSTRAINT `geo_system_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthly_optimization_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`roundNumber` int NOT NULL DEFAULT 1,
	`monthlyOptimizationPlanStatus` enum('active','completed') NOT NULL DEFAULT 'active',
	`baselineMaturityScore` int NOT NULL,
	`baselineDimensionScores` json NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`retestScheduledAt` timestamp,
	`retestCompletedAt` timestamp,
	`resultMaturityScore` int,
	`resultDimensionScores` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_optimization_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthly_optimization_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`projectId` int NOT NULL,
	`monthlyOptimizationTaskType` enum('content_generation','source_discovery','evidence_addition','profile_completion') NOT NULL,
	`targetDimension` varchar(64) NOT NULL,
	`relatedQuestionId` int,
	`title` varchar(255) NOT NULL,
	`reason` text NOT NULL,
	`monthlyOptimizationTaskStatus` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`linkedEntityId` int,
	`actionUrl` varchar(500) NOT NULL,
	`metadata` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_optimization_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_platform_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`platform` varchar(50) NOT NULL,
	`accountName` varchar(255) NOT NULL,
	`accountIdOrUrl` varchar(2000),
	`accountGroup` varchar(50),
	`accountRole` varchar(50),
	`isEnabled` int NOT NULL DEFAULT 1,
	`verificationStatus` varchar(32) NOT NULL DEFAULT 'unknown',
	`lastVerifiedAt` timestamp,
	`lastDetectedAccountName` varchar(255),
	`localAgentId` varchar(100),
	`localProfileId` varchar(100),
	`sessionStatus` varchar(30),
	`lastSessionCheckedAt` timestamp,
	`lastLoginAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_platform_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_platform_accounts_project_platform_name` UNIQUE(`projectId`,`platform`,`accountName`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `retest_comparisons` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`baseRoundId` varchar(36) NOT NULL,
	`compareRoundId` varchar(36) NOT NULL,
	`questionType` varchar(64) NOT NULL,
	`platform` varchar(64) NOT NULL,
	`baseMentionCount` int NOT NULL DEFAULT 0,
	`compareMentionCount` int NOT NULL DEFAULT 0,
	`baseRecommendCount` int NOT NULL DEFAULT 0,
	`compareRecommendCount` int NOT NULL DEFAULT 0,
	`baseCompetitorCount` int NOT NULL DEFAULT 0,
	`compareCompetitorCount` int NOT NULL DEFAULT 0,
	`changeDirection` enum('up','flat','down','unknown') NOT NULL,
	`systemConclusion` text NOT NULL,
	`confidenceLevel` enum('high','medium','low','observe_more') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `retest_comparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `round_questions` (
	`id` varchar(36) NOT NULL,
	`roundId` varchar(36) NOT NULL,
	`questionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `round_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `round_questions_round_question_unique` UNIQUE(`roundId`,`questionId`)
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
	`taskPriority` enum('P0','P1','P2') NOT NULL,
	`source_enhancement_status` enum('pending','accepted','content_task_created','ignored','verified') NOT NULL DEFAULT 'pending',
	`linkedTaskId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_enhancement_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`type` enum('t0_complete','publish_success','publish_failed','t1_retest_complete','weekly_growth_report') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_rounds` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`roundType` enum('T0_BASELINE','T1_RETEST','T2_RETEST','T3_RETEST') NOT NULL,
	`roundName` varchar(255) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`platforms` json NOT NULL,
	`questionsCount` int NOT NULL DEFAULT 0,
	`runsPerQuestion` int NOT NULL DEFAULT 3,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`sourceQuestionPoolSize` int,
	`platformsIncluded` json,
	`scheduledType` varchar(32),
	`comparedToRoundId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_rounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `user_feedbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`feedbackType` enum('bug','suggestion','other') NOT NULL,
	`description` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_feedbacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `geo_articles` MODIFY COLUMN `coverBase64` mediumtext;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `publish_tasks` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `publish_tasks` MODIFY COLUMN `coverImageUrl` text;--> statement-breakpoint
ALTER TABLE `questions` MODIFY COLUMN `questionType` enum('品牌认知','行业推荐','竞品对比','痛点解决','价格选型','高意向成交','指定问题','scenario_need','long_tail_conversion') NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` MODIFY COLUMN `source` enum('ai_generated','manual','csv','onboarding_wizard') NOT NULL DEFAULT 'ai_generated';--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedMentioned` boolean;--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedRecommended` boolean;--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedCitations` json;--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedCompetitors` json;--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedSentiment` varchar(16);--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractionMethod` varchar(16);--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `extractedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ai_responses` ADD `questionPoolType` varchar(64);--> statement-breakpoint
ALTER TABLE `competitor_profiles` ADD `aiMentionCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `wizardStep` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `wizardCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetMentionRate` int;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetRecommendationRate` int;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetPlatforms` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetQuestionCategories` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `targetCompetitorsToBeat` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `monthlyContentCapacity` int;--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `internalOwnerName` varchar(255);--> statement-breakpoint
ALTER TABLE `enterprise_geo_profiles` ADD `geoGoalNotes` text;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `targetQuestionId` varchar(36);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `targetGapType` varchar(64);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `lifecycleStatus` varchar(32) DEFAULT 'generated';--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `lifecycleEvents` json;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `geoQualityScore` int;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `geoQualityDetail` json;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `geoQualityReviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `geoQualityModel` varchar(50);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `geoQualityRecommendation` varchar(20);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `geoQualityStale` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `contentStrategyType` varchar(50);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `publishIdentity` varchar(50);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `recommendedAccountGroup` varchar(50);--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `contentEditedAt` timestamp;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `contentTags` json;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `contentReviewStatus` varchar(32) DEFAULT '待审核' NOT NULL;--> statement-breakpoint
ALTER TABLE `geo_articles` ADD `publishedAt` timestamp;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `effectInclusionStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `inclusionVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `inclusionKeywords` json;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `readCount` int;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `impressionCount` int;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `interactionCount` int;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `searchTriggerKeywords` json;--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `effectDataSource` varchar(32);--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `evidenceScreenshotUrl` varchar(2000);--> statement-breakpoint
ALTER TABLE `geo_inclusion_monitoring_records` ADD `evidenceNotes` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `ownerUserId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `projectName` varchar(255);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `platformAccountId` int;--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `expectedAccountName` varchar(255);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `detectedAccountName` varchar(255);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `accountVerificationStatus` varchar(32) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `draftUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `publishedUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `localAgentId` varchar(100);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `localProfileId` varchar(100);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `agentPickedAt` timestamp;--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `agentFinishedAt` timestamp;--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `agentErrorType` varchar(50);--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `agentErrorMessage` text;--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `agentLog` json;--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `retryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `publish_tasks` ADD `retryLog` json;--> statement-breakpoint
ALTER TABLE `questions` ADD `contentGapTags` json;--> statement-breakpoint
ALTER TABLE `questions` ADD `searchPoolType` varchar(64);--> statement-breakpoint
ALTER TABLE `questions` ADD `targetKeywords` json;--> statement-breakpoint
ALTER TABLE `questions` ADD `targetCustomerScene` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `relatedGeoGap` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `relatedContentTask` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `requiredSourceTypes` json;--> statement-breakpoint
ALTER TABLE `questions` ADD `requiredEntityAnchors` json;--> statement-breakpoint
ALTER TABLE `questions` ADD `priorityLevel` varchar(16);--> statement-breakpoint
ALTER TABLE `questions` ADD `lastTestResult` varchar(32);--> statement-breakpoint
ALTER TABLE `questions` ADD `lastTestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `userStatus` enum('pending_review','active','rejected','disabled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `customerRole` enum('customer_admin','customer_member');--> statement-breakpoint
ALTER TABLE `users` ADD `applicationNote` text;--> statement-breakpoint
ALTER TABLE `users` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `reviewedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionPlanId` enum('basic','professional','enterprise') DEFAULT 'basic' NOT NULL;--> statement-breakpoint
CREATE INDEX `company_projects_company_idx` ON `company_projects` (`companyId`);--> statement-breakpoint
CREATE INDEX `geo_maturity_scores_project_calculated_idx` ON `geo_maturity_scores` (`projectId`,`calculatedAt`);--> statement-breakpoint
CREATE INDEX `monthly_optimization_plans_project_status_idx` ON `monthly_optimization_plans` (`projectId`,`monthlyOptimizationPlanStatus`);--> statement-breakpoint
CREATE INDEX `monthly_optimization_tasks_plan_idx` ON `monthly_optimization_tasks` (`planId`);--> statement-breakpoint
CREATE INDEX `monthly_optimization_tasks_project_idx` ON `monthly_optimization_tasks` (`projectId`);
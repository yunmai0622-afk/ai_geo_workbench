CREATE TABLE `brand_truth_conflicts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`factKey` varchar(128) NOT NULL,
	`factId` int NOT NULL,
	`evidenceAId` int,
	`evidenceBId` int,
	`conflictType` varchar(64) NOT NULL,
	`severity` enum('P0','P1','P2') NOT NULL DEFAULT 'P2',
	`resolutionStatus` enum('open','reviewing','resolved','accepted_difference') NOT NULL DEFAULT 'open',
	`resolutionNote` text,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_truth_conflicts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_truth_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`evidenceType` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`url` varchar(2000),
	`publisher` varchar(255),
	`sourceOwner` varchar(255),
	`sourceClass` enum('official','third_party','enterprise_provided','unknown') NOT NULL DEFAULT 'unknown',
	`independentSource` boolean NOT NULL DEFAULT false,
	`accessible` boolean NOT NULL DEFAULT false,
	`authorityLevel` enum('high','medium','low','unknown') NOT NULL DEFAULT 'unknown',
	`freshnessStatus` enum('current','aging','outdated','unknown') NOT NULL DEFAULT 'unknown',
	`consistencyStatus` enum('consistent','partial','conflicting','unknown') NOT NULL DEFAULT 'unknown',
	`verificationStatus` enum('pending','verified','rejected','unverifiable') NOT NULL DEFAULT 'pending',
	`evidenceExcerpt` text,
	`evidenceHash` varchar(128),
	`manualReviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`publishedAt` timestamp,
	`sourceUpdatedAt` timestamp,
	`capturedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_truth_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_truth_fact_evidence_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`factId` int NOT NULL,
	`evidenceId` int NOT NULL,
	`supportType` enum('supports','contradicts','context_only') NOT NULL DEFAULT 'supports',
	`confidence` int NOT NULL DEFAULT 0,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_truth_fact_evidence_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_truth_fact_evidence_link_unique` UNIQUE(`factId`,`evidenceId`)
);
--> statement-breakpoint
CREATE TABLE `brand_truth_fact_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`factId` int NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL,
	`profileVersion` int NOT NULL,
	`previousValue` text,
	`newValue` text NOT NULL,
	`previousVerificationStatus` varchar(64),
	`newVerificationStatus` varchar(64) NOT NULL,
	`changeReason` text NOT NULL,
	`evidenceChange` json,
	`affectsHistoricalInterpretation` boolean NOT NULL DEFAULT false,
	`requiresRevalidation` boolean NOT NULL DEFAULT true,
	`effectiveAt` timestamp,
	`changedBy` int,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_truth_fact_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_truth_fact_versions_fact_version_unique` UNIQUE(`factId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `brand_truth_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`projectId` int NOT NULL,
	`category` enum('identity','business','capability_boundary','temporal') NOT NULL,
	`factType` varchar(64) NOT NULL,
	`factKey` varchar(128) NOT NULL,
	`factValue` text NOT NULL,
	`normalizedValue` text,
	`description` text,
	`importance` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`verificationStatus` enum('provided_unverified','official_verified','third_party_verified','multi_source_verified','conflicting','outdated','deprecated','unknown') NOT NULL DEFAULT 'provided_unverified',
	`validFrom` timestamp,
	`validTo` timestamp,
	`sourceCount` int NOT NULL DEFAULT 0,
	`officialSourceCount` int NOT NULL DEFAULT 0,
	`thirdPartySourceCount` int NOT NULL DEFAULT 0,
	`conflictCount` int NOT NULL DEFAULT 0,
	`lastVerifiedAt` timestamp,
	`createdBy` int,
	`reviewedBy` int,
	`version` int NOT NULL DEFAULT 1,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_truth_facts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_truth_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`currentVersion` int NOT NULL DEFAULT 1,
	`status` enum('draft','active','needs_review','archived') NOT NULL DEFAULT 'draft',
	`completenessScore` int NOT NULL DEFAULT 0,
	`verifiedFactRate` int NOT NULL DEFAULT 0,
	`conflictCount` int NOT NULL DEFAULT 0,
	`outdatedFactCount` int NOT NULL DEFAULT 0,
	`lastReviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_truth_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_truth_profiles_project_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_correction_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`evaluationId` varchar(36),
	`factKey` varchar(128) NOT NULL,
	`expectedFact` text,
	`observedStatement` text NOT NULL,
	`severity` enum('P0','P1','P2') NOT NULL,
	`affectedStage` enum('know','understand','trust','recommend','grow') NOT NULL DEFAULT 'understand',
	`recommendedAssetType` varchar(64) NOT NULL,
	`actionType` varchar(64) NOT NULL,
	`actionDescription` text NOT NULL,
	`requiredEvidence` text NOT NULL,
	`owner` varchar(255),
	`priority` enum('P0','P1','P2') NOT NULL,
	`dependency` text,
	`completionCriteria` text NOT NULL,
	`verificationQuestionIds` json NOT NULL,
	`targetRetestRound` varchar(64),
	`targetRetestAt` timestamp,
	`status` enum('pending','in_progress','completed','retest_scheduled','verified','cancelled') NOT NULL DEFAULT 'pending',
	`createdBy` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `understanding_correction_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `understanding_rule_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ruleKey` varchar(128) NOT NULL,
	`ruleVersion` int NOT NULL DEFAULT 1,
	`configJson` json NOT NULL,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `understanding_rule_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_rule_configs_project_rule_unique` UNIQUE(`projectId`,`ruleKey`)
);
--> statement-breakpoint
CREATE TABLE `understanding_dimension_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`evaluationId` varchar(36) NOT NULL,
	`dimension` varchar(64) NOT NULL,
	`score` int,
	`status` varchar(64) NOT NULL,
	`expectedFacts` json NOT NULL,
	`actualStatements` json NOT NULL,
	`matchedFacts` json NOT NULL,
	`missingFacts` json NOT NULL,
	`inaccurateFacts` json NOT NULL,
	`outdatedFacts` json NOT NULL,
	`conflictingFacts` json NOT NULL,
	`hallucinatedClaims` json NOT NULL,
	`unverifiableClaims` json NOT NULL,
	`evidenceReferences` json NOT NULL,
	`severity` enum('P0','P1','P2') NOT NULL DEFAULT 'P2',
	`customerExplanation` text NOT NULL,
	`recommendedCorrection` text NOT NULL,
	`verificationQuestionIds` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `understanding_dimension_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_dimension_evaluation_unique` UNIQUE(`evaluationId`,`dimension`)
);
--> statement-breakpoint
CREATE TABLE `understanding_evaluations` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`questionSetId` int NOT NULL,
	`questionId` int NOT NULL,
	`sourceAiTestRunId` varchar(36),
	`testRoundId` varchar(36),
	`testedModel` varchar(128) NOT NULL,
	`testedChannel` varchar(64) NOT NULL,
	`testedAt` timestamp NOT NULL,
	`rawAnswer` text NOT NULL,
	`extractedFacts` json NOT NULL,
	`uncertainStatements` json NOT NULL,
	`ruleResults` json NOT NULL,
	`semanticJudgement` json,
	`evidenceReferences` json NOT NULL,
	`evaluationVersion` varchar(32) NOT NULL,
	`truthProfileVersion` int NOT NULL,
	`questionSetVersion` int NOT NULL,
	`extractionVersion` varchar(32) NOT NULL,
	`extractorModel` varchar(128),
	`evaluatorModel` varchar(128),
	`manualReviewStatus` enum('not_required','pending','approved','overridden') NOT NULL DEFAULT 'not_required',
	`finalStatus` enum('accurate','mostly_accurate','partially_accurate','missing','inaccurate','outdated','conflicting','hallucinated','unverifiable') NOT NULL,
	`severity` enum('P0','P1','P2') NOT NULL DEFAULT 'P2',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `understanding_evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `understanding_question_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`validFrom` timestamp,
	`validTo` timestamp,
	`fixedAcrossPeriods` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `understanding_question_sets_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_question_sets_project_version_unique` UNIQUE(`projectId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `understanding_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`questionSetId` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`questionType` enum('system_default','project_custom','high_risk','name_collision','outdated_info','competitor_confusion') NOT NULL,
	`questionText` text NOT NULL,
	`verificationFactKeys` json NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`fixedAcrossPeriods` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `understanding_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `brand_truth_conflicts_project_status_idx` ON `brand_truth_conflicts` (`projectId`,`resolutionStatus`);--> statement-breakpoint
CREATE INDEX `brand_truth_evidence_project_idx` ON `brand_truth_evidence` (`projectId`);--> statement-breakpoint
CREATE INDEX `brand_truth_facts_project_key_idx` ON `brand_truth_facts` (`projectId`,`factKey`);--> statement-breakpoint
CREATE INDEX `brand_truth_facts_profile_idx` ON `brand_truth_facts` (`profileId`);--> statement-breakpoint
CREATE INDEX `understanding_correction_tasks_project_status_idx` ON `understanding_correction_tasks` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `understanding_evaluations_project_tested_idx` ON `understanding_evaluations` (`projectId`,`testedAt`);--> statement-breakpoint
CREATE INDEX `understanding_questions_set_idx` ON `understanding_questions` (`questionSetId`);

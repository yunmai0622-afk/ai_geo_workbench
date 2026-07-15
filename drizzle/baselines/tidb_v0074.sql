CREATE TABLE `ai_citation_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`extractionId` varchar(36) NOT NULL,
	`citationStatus` enum('detected','not_detected','unsupported','unknown','extraction_failed') NOT NULL,
	`rawCitationText` text,
	`normalizedUrl` varchar(2000),
	`sourceTitle` varchar(500),
	`sourceOwner` varchar(255),
	`sourcePosition` int,
	`accessibilityStatus` enum('accessible','inaccessible','unknown','not_checked') NOT NULL,
	`confidence` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_citation_results_id` PRIMARY KEY(`id`)
);

CREATE TABLE `ai_extracted_brand_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`extractionId` varchar(36) NOT NULL,
	`brandId` varchar(128),
	`factKey` varchar(128) NOT NULL,
	`extractedValue` text NOT NULL,
	`normalizedValue` text,
	`sourceTextSpan` text,
	`confidence` int,
	`uncertaintyType` enum('none','explicit_uncertainty','ambiguous','inferred','unavailable') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_extracted_brand_facts_id` PRIMARY KEY(`id`)
);

CREATE TABLE `ai_observation_answers` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`observationRunId` varchar(36) NOT NULL,
	`questionId` int,
	`questionKey` varchar(128) NOT NULL,
	`questionVersionSnapshot` int NOT NULL,
	`questionTextSnapshot` text NOT NULL,
	`scenarioSnapshot` text,
	`attemptNumber` int NOT NULL,
	`providerResponseId` varchar(255),
	`rawAnswer` mediumtext,
	`rawProviderMetadata` json,
	`answerContentHash` varchar(128),
	`receivedAt` timestamp,
	`latencyMs` int,
	`inputTokens` int,
	`outputTokens` int,
	`totalTokens` int,
	`finishReason` varchar(128),
	`answerStatus` enum('received','empty','provider_error','blocked','incomplete') NOT NULL,
	`citationCapability` enum('supported','unsupported','unknown') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_observation_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_observation_answers_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `ai_observation_answers_run_question_attempt_unique` UNIQUE(`observationRunId`,`questionKey`,`attemptNumber`)
);

CREATE TABLE `ai_observation_extractions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`observationAnswerId` varchar(36) NOT NULL,
	`attemptNumber` int NOT NULL,
	`extractorKey` varchar(128) NOT NULL,
	`extractorVersion` varchar(64) NOT NULL,
	`extractionPromptVersion` varchar(64) NOT NULL,
	`extractionPromptHash` varchar(128) NOT NULL,
	`extractionModelProvider` varchar(64),
	`extractionModelName` varchar(128),
	`extractionModelChannel` varchar(128),
	`extractionStatus` enum('succeeded','partially_succeeded','failed','insufficient_content') NOT NULL,
	`structuredPayload` json,
	`extractionCoverage` int,
	`extractionConfidence` int,
	`citationExtractionStatus` enum('detected','not_detected','unsupported','unknown','extraction_failed') NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`errorCode` varchar(128),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_observation_extractions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_observation_extractions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `ai_observation_extractions_answer_attempt_unique` UNIQUE(`observationAnswerId`,`extractorKey`,`extractorVersion`,`attemptNumber`)
);

CREATE TABLE `ai_observation_run_events` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`observationRunId` varchar(36) NOT NULL,
	`eventType` enum('queued','running','succeeded','partially_succeeded','failed','cancelled') NOT NULL,
	`eventSequence` int NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`errorCode` varchar(128),
	`errorMessage` text,
	`eventMetadata` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_observation_run_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_observation_run_events_run_sequence_unique` UNIQUE(`observationRunId`,`eventSequence`)
);

CREATE TABLE `ai_observation_runs` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`questionSetId` int,
	`questionSetVersionSnapshot` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`modelName` varchar(128) NOT NULL,
	`modelVersion` varchar(128),
	`modelChannel` varchar(128),
	`runPurpose` varchar(64) NOT NULL,
	`locale` varchar(32) NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`runStatus` enum('queued','running','succeeded','partially_succeeded','failed','cancelled') NOT NULL,
	`providerRequestId` varchar(255),
	`systemPromptVersion` varchar(64) NOT NULL,
	`systemPromptHash` varchar(128) NOT NULL,
	`systemPromptSnapshot` text,
	`samplingParameters` json,
	`applicationVersion` varchar(128) NOT NULL,
	`errorCode` varchar(128),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `ai_observation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_observation_runs_id_project_unique` UNIQUE(`id`,`projectId`)
);

CREATE TABLE `ai_recommendation_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`extractionId` varchar(36) NOT NULL,
	`targetBrand` varchar(255) NOT NULL,
	`competitorIdentity` varchar(255),
	`mentionStatus` enum('detected','not_detected','unknown') NOT NULL,
	`candidateStatus` enum('entered','not_entered','unknown') NOT NULL,
	`recommendationStatus` enum('recommended','not_recommended','unknown') NOT NULL,
	`recommendationRank` int,
	`recommendationReasonText` text,
	`confidence` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_recommendation_results_id` PRIMARY KEY(`id`)
);

CREATE TABLE `ai_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`questionId` int,
	`questionText` text NOT NULL,
	`aiPlatform` enum('ChatGPT','DeepSeek','豆包','Kimi','通义','文心','Perplexity','其他') NOT NULL,
	`rawAnswer` text NOT NULL,
	`checkedAt` timestamp NOT NULL,
	`extractedMentioned` boolean,
	`extractedRecommended` boolean,
	`extractedCitations` json,
	`extractedCompetitors` json,
	`extractedSentiment` varchar(16),
	`extractionMethod` varchar(16),
	`extractedAt` timestamp,
	`questionPoolType` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_responses_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `analysis_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`aiResponseId` int NOT NULL,
	`mentionsEnterprise` int NOT NULL DEFAULT 0,
	`recommendsEnterprise` int NOT NULL DEFAULT 0,
	`mentionsCompetitors` int NOT NULL DEFAULT 0,
	`recommendedCompetitors` json NOT NULL,
	`enterpriseWins` int NOT NULL DEFAULT 0,
	`recommendationReason` text,
	`notRecommendedReason` text,
	`hasMisconception` int NOT NULL DEFAULT 0,
	`contentGap` text,
	`optimizationSuggestion` text,
	`rawJson` json NOT NULL,
	`manual_override_json` json,
	`manually_reviewed` int NOT NULL DEFAULT 0,
	`reviewed_at` timestamp,
	`review_note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysis_results_id` PRIMARY KEY(`id`)
);

CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`action` varchar(64) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `brand_fact_definition_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`definitionId` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`description` text,
	`requirement` enum('required','optional','not_applicable') NOT NULL,
	`valueType` enum('text','integer','decimal','boolean','date','datetime','url','enum','json') NOT NULL,
	`cardinality` enum('one','many') NOT NULL,
	`temporalSemantics` enum('timeless','effective_period','point_in_time','event_stream') NOT NULL,
	`validationSchema` json,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `brand_fact_definition_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_fact_definition_versions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `brand_fact_definition_versions_definition_version_unique` UNIQUE(`definitionId`,`version`)
);

CREATE TABLE `brand_fact_definitions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`definitionKey` varchar(128) NOT NULL,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `brand_fact_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_fact_definitions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `brand_fact_definitions_project_key_unique` UNIQUE(`projectId`,`definitionKey`)
);

CREATE TABLE `brand_fact_industry_template_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`templateVersionId` varchar(36) NOT NULL,
	`definitionVersionId` varchar(36) NOT NULL,
	`requirementOverride` enum('required','optional','not_applicable'),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_fact_industry_template_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_fact_industry_template_item_unique` UNIQUE(`templateVersionId`,`definitionVersionId`)
);

CREATE TABLE `brand_fact_industry_template_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`industryKey` varchar(128) NOT NULL,
	`version` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `brand_fact_industry_template_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_fact_industry_templates_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `brand_fact_industry_templates_project_industry_version_unique` UNIQUE(`projectId`,`industryKey`,`version`)
);

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
	CONSTRAINT `brand_truth_fact_versions_fact_version_unique` UNIQUE(`factId`,`version`),
	CONSTRAINT `brand_truth_fact_versions_id_project_unique` UNIQUE(`id`,`projectId`)
);

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

CREATE TABLE `brand_truth_profile_version_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`truthProfileVersionId` varchar(36) NOT NULL,
	`factVersionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_truth_profile_version_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_truth_profile_version_fact_unique` UNIQUE(`truthProfileVersionId`,`factVersionId`)
);

CREATE TABLE `brand_truth_profile_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`profileId` int NOT NULL,
	`version` int NOT NULL,
	`statusSnapshot` enum('draft','active','needs_review','archived') NOT NULL,
	`completenessScoreSnapshot` int NOT NULL,
	`verifiedFactRateSnapshot` int NOT NULL,
	`conflictCountSnapshot` int NOT NULL,
	`outdatedFactCountSnapshot` int NOT NULL,
	`lastReviewedAtSnapshot` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `brand_truth_profile_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_truth_profile_versions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `brand_truth_profile_versions_profile_version_unique` UNIQUE(`profileId`,`version`,`projectId`)
);

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
	CONSTRAINT `brand_truth_profiles_project_unique` UNIQUE(`projectId`),
	CONSTRAINT `brand_truth_profiles_id_project_unique` UNIQUE(`id`,`projectId`)
);

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

CREATE TABLE `competitor_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`competitorName` varchar(255) NOT NULL,
	`website` varchar(500),
	`positioning` text,
	`strengths` text,
	`weaknesses` text,
	`priceInfo` text,
	`contentAssets` text,
	`aiRecommendationSignals` text,
	`aiMentionCount` int NOT NULL DEFAULT 0,
	`comparisonNotes` text,
	`sourceAssetIds` json NOT NULL,
	`canReference` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitor_profiles_id` PRIMARY KEY(`id`)
);

CREATE TABLE `compliance_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ruleName` varchar(255) NOT NULL,
	`forbiddenClaims` text,
	`forbiddenWords` json NOT NULL,
	`requiredDisclaimers` text,
	`dataUsageRules` text,
	`caseUsageRules` text,
	`priceUsageRules` text,
	`competitorMentionRules` text,
	`reviewRequiredTopics` json NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compliance_rules_id` PRIMARY KEY(`id`)
);

CREATE TABLE `content_plan_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`topicId` int,
	`articleId` int,
	`targetPlatform` varchar(255) NOT NULL,
	`contentType` varchar(255) NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT '待生成',
	`differentiationAngle` text,
	`duplicateRisk` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_plan_items_id` PRIMARY KEY(`id`)
);

CREATE TABLE `content_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`planName` varchar(255) NOT NULL,
	`weekStartDate` varchar(32) NOT NULL,
	`weeklyArticleCount` int NOT NULL DEFAULT 3,
	`targetPlatforms` json NOT NULL,
	`contentTypes` json NOT NULL,
	`linkedOptimizationTaskIds` json NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT '已配置',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_plans_id` PRIMARY KEY(`id`)
);

CREATE TABLE `content_style_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`profileName` varchar(255) NOT NULL,
	`tone` varchar(255) NOT NULL,
	`writingStyle` text,
	`terminology` json NOT NULL,
	`forbiddenTone` text,
	`exampleTitles` json NOT NULL,
	`exampleParagraphs` json NOT NULL,
	`targetReader` text,
	`preferredLength` varchar(255),
	`ctaStyle` text,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_style_profiles_id` PRIMARY KEY(`id`)
);

CREATE TABLE `content_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`optimization_task_id` int,
	`templateType` enum('官网首页模板','FAQ 模板','竞品对比页模板','客户案例页模板','行业选型文章模板') NOT NULL,
	`title` varchar(255) NOT NULL,
	`markdownContent` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_templates_id` PRIMARY KEY(`id`)
);

CREATE TABLE `customer_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`caseType` enum('真实案例','待补充案例线索') NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerIndustry` varchar(255),
	`customerBackground` text,
	`originalProblem` text,
	`chosenReason` text,
	`usedProductService` text,
	`executionProcess` text,
	`resultData` text,
	`customerFeedback` text,
	`allowPublic` int NOT NULL DEFAULT 0,
	`publicVersion` text,
	`sensitiveNotes` text,
	`sourceAssetIds` json NOT NULL,
	`verificationStatus` enum('待确认','已确认','不可公开','信息不足') NOT NULL DEFAULT '待确认',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_cases_id` PRIMARY KEY(`id`)
);

CREATE TABLE `customer_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int,
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

CREATE TABLE `delivery_report_share_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`projectId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`isEnabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `delivery_report_share_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_report_share_tokens_token_unique` UNIQUE(`token`)
);

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
	`detectedSignals` json NOT NULL,
	`status` enum('pending','accepted','ignored') NOT NULL DEFAULT 'pending',
	`acceptedRecordId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discovery_candidates_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `enterprise_geo_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`enterpriseName` varchar(255) NOT NULL,
	`shortName` varchar(255),
	`officialWebsite` varchar(500),
	`industry` varchar(255),
	`region` varchar(255),
	`productServiceIntro` text,
	`targetCustomers` text,
	`coreSellingPoints` text,
	`servicePriceRange` varchar(255),
	`serviceModel` text,
	`fitCustomers` text,
	`unfitCustomers` text,
	`salesChannels` json NOT NULL,
	`commonQuestions` json NOT NULL,
	`purchaseDecisionFactors` json NOT NULL,
	`productIntro` text,
	`featureNotes` text,
	`serviceProcess` text,
	`deliveryPlan` text,
	`afterSalesService` text,
	`competitorDifference` text,
	`priceExplanation` text,
	`salesTalkTracks` text,
	`commonObjections` text,
	`brandName` text,
	`industryTag` text,
	`productDesc` text,
	`mainChannel` text,
	`targetCustomer` text,
	`customerPains` json,
	`competitors` json,
	`hasCases` boolean,
	`oneLiner` text,
	`keyPoints` json,
	`keywords` json,
	`completionScore` int NOT NULL DEFAULT 0,
	`wizardStep` int NOT NULL DEFAULT 0,
	`wizardCompletedAt` timestamp,
	`targetMentionRate` int,
	`targetRecommendationRate` int,
	`targetPlatforms` json NOT NULL,
	`targetQuestionCategories` json NOT NULL,
	`targetCompetitorsToBeat` json NOT NULL,
	`monthlyContentCapacity` int,
	`internalOwnerName` varchar(255),
	`geoGoalNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enterprise_geo_profiles_id` PRIMARY KEY(`id`)
);

CREATE TABLE `entity_anchors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`brandName` varchar(255),
	`companyName` varchar(255),
	`coreBusiness` text,
	`targetCustomer` text,
	`coreKeywords` json NOT NULL,
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

CREATE TABLE `entity_consistency_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`entity_anchor_type` enum('brand_name','company_name','main_business','target_customer','core_product','official_url','target_keywords','customer_proof') NOT NULL,
	`standardValue` text,
	`observedValues` json NOT NULL,
	`entity_consistency_status` enum('consistent','partial','missing','conflict') NOT NULL,
	`score` int NOT NULL,
	`issueSummary` text,
	`suggestion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_consistency_checks_id` PRIMARY KEY(`id`),
	CONSTRAINT `entity_consistency_checks_project_anchor_unique` UNIQUE(`projectId`,`entity_anchor_type`)
);

CREATE TABLE `geo_article_quality_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`problemMatchScore` int NOT NULL DEFAULT 0,
	`evidenceScore` int NOT NULL DEFAULT 0,
	`structureScore` int NOT NULL DEFAULT 0,
	`originalityScore` int NOT NULL DEFAULT 0,
	`geoCitableScore` int NOT NULL DEFAULT 0,
	`complianceScore` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 0,
	`blocked` int NOT NULL DEFAULT 0,
	`blockReasons` json NOT NULL,
	`reviewSummary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_article_quality_scores_id` PRIMARY KEY(`id`)
);

CREATE TABLE `geo_article_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`optimizationTaskId` int,
	`sourceAnalysisIds` json NOT NULL,
	`sourceQuestionIds` json NOT NULL,
	`title` varchar(255) NOT NULL,
	`articleType` enum('官网版 GEO 文章','问答型 GEO 文章','竞品对比型 GEO 文章','行业选型型 GEO 文章') NOT NULL,
	`contentGap` text NOT NULL,
	`businessReason` text NOT NULL,
	`status` enum('待生成','已生成','待质检','质检通过','待审核','审核通过','已发布','待复测','质检未通过','需人工审核','审核未通过') NOT NULL DEFAULT '待生成',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_article_topics_id` PRIMARY KEY(`id`)
);

CREATE TABLE `geo_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`topicId` int NOT NULL,
	`optimizationTaskId` int,
	`title` varchar(255) NOT NULL,
	`articleType` enum('官网版 GEO 文章','问答型 GEO 文章','竞品对比型 GEO 文章','行业选型型 GEO 文章') NOT NULL,
	`markdownContent` text NOT NULL,
	`generationBasis` json,
	`targetQuestionId` varchar(36),
	`targetGapType` varchar(64),
	`citableSnippets` json,
	`geoStructure` json,
	`thirdPartyMaterials` json NOT NULL,
	`factTraceability` json,
	`consistencyCheck` json,
	`optimizationVersions` json,
	`status` enum('待生成','已生成','待质检','质检通过','待审核','审核通过','已发布','待复测','质检未通过','需人工审核','审核未通过') NOT NULL DEFAULT '待质检',
	`lifecycleStatus` varchar(32) DEFAULT 'generated',
	`lifecycleEvents` json,
	`publicPath` varchar(1000),
	`coverTemplate` varchar(32),
	`coverImageUrl` varchar(2000),
	`coverBase64` mediumtext,
	`geoQualityScore` int,
	`geoQualityDetail` json,
	`geoQualityReviewedAt` timestamp,
	`geoQualityModel` varchar(50),
	`geoQualityRecommendation` varchar(20),
	`geoQualityStale` int DEFAULT 0,
	`contentStrategyType` varchar(50),
	`publishIdentity` varchar(50),
	`recommendedAccountGroup` varchar(50),
	`contentEditedAt` timestamp,
	`contentTags` json,
	`contentReviewStatus` varchar(32) NOT NULL DEFAULT '待审核',
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_articles_id` PRIMARY KEY(`id`)
);

CREATE TABLE `geo_asset_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceType` enum('企业基础资料','产品服务资料','客户案例资料','竞品资料','合规资料','内容风格资料','发布策略资料','通用资料') NOT NULL,
	`inputMode` enum('文件上传','文本粘贴','人工录入') NOT NULL,
	`title` varchar(255) NOT NULL,
	`originalFileName` varchar(500),
	`fileKey` varchar(1000),
	`fileUrl` varchar(1000),
	`mimeType` varchar(255),
	`contentDigest` text,
	`structuredSummary` json NOT NULL,
	`trustLevel` enum('高','中','低') NOT NULL DEFAULT '中',
	`parseStatus` enum('待解析','已解析','解析失败','人工确认') NOT NULL DEFAULT '待解析',
	`isPublic` int NOT NULL DEFAULT 0,
	`canUseForGeneration` int NOT NULL DEFAULT 0,
	`manuallyConfirmed` int NOT NULL DEFAULT 0,
	`parsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_asset_sources_id` PRIMARY KEY(`id`)
);

CREATE TABLE `geo_inclusion_monitoring_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`publishRecordId` int NOT NULL,
	`publicUrl` varchar(1000) NOT NULL,
	`inclusionMonitorStatus` enum('未检测','检测中','已收录','未收录','检测失败') NOT NULL DEFAULT '未检测',
	`aiMentionMonitorStatus` enum('未检测','检测中','已提及','未提及','检测失败') NOT NULL DEFAULT '未检测',
	`aiRecommendMonitorStatus` enum('未检测','检测中','已推荐','未推荐','检测失败') NOT NULL DEFAULT '未检测',
	`lastCheckedAt` timestamp,
	`currentSuggestion` text NOT NULL,
	`optimizationSuggestions` json NOT NULL,
	`rawJson` json NOT NULL,
	`aiTestResults` json,
	`lastAiTestedAt` timestamp,
	`effectInclusionStatus` varchar(32),
	`inclusionVerifiedAt` timestamp,
	`inclusionKeywords` json,
	`readCount` int,
	`impressionCount` int,
	`interactionCount` int,
	`searchTriggerKeywords` json,
	`effectDataSource` varchar(32),
	`evidenceScreenshotUrl` varchar(2000),
	`evidenceNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geo_inclusion_monitoring_records_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `geo_publish_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`optimizationTaskId` int,
	`publishChannel` enum('系统内置 GEO 内容页','自有内容站 / 企业官网 GEO 页面','微信公众号','知乎','百家号','头条号','小红书','搜狐号','网易号','CSDN / 掘金') NOT NULL,
	`publishTitle` varchar(500),
	`publishUrl` varchar(1000) NOT NULL,
	`publishStatus` varchar(64) NOT NULL DEFAULT '已发布',
	`qualityScore` int NOT NULL DEFAULT 0,
	`needRetest` int NOT NULL DEFAULT 1,
	`notes` text,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_publish_records_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `geo_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`aiVisibilityScore` int NOT NULL DEFAULT 0,
	`aiRecommendationScore` int NOT NULL DEFAULT 0,
	`competitorWinScore` int NOT NULL DEFAULT 0,
	`cognitionAccuracyScore` int NOT NULL DEFAULT 0,
	`contentAssetScore` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 0,
	`visibilityLevel` enum('弱可见','初步可见','良好可见','强势推荐') NOT NULL,
	`calculationDetail` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geo_scores_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `optimization_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`taskType` enum('官网首页','产品页','竞品对比页','FAQ','客户案例','行业文章','社媒内容') NOT NULL,
	`taskName` varchar(255) NOT NULL,
	`taskPriority` enum('P0','P1','P2') NOT NULL,
	`generationReason` text NOT NULL,
	`executionSuggestion` text NOT NULL,
	`expectedImpact` text NOT NULL,
	`status` enum('todo','doing','done','retest') NOT NULL DEFAULT 'todo',
	`published_url` varchar(1000),
	`completed_at` timestamp,
	`need_retest` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `optimization_tasks_id` PRIMARY KEY(`id`)
);

CREATE TABLE `platform_authorization_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`platformName` varchar(255) NOT NULL,
	`accountAlias` varchar(255),
	`authorizationStatus` enum('未配置','待人工授权','已授权','已失效','无需授权') NOT NULL DEFAULT '未配置',
	`credentialStorageMode` varchar(255) NOT NULL DEFAULT '不保存明文凭证',
	`secureCredentialRef` varchar(500),
	`authorizationNotes` text,
	`authorizedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_authorization_configs_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`enterpriseName` varchar(255) NOT NULL,
	`industry` varchar(255) NOT NULL,
	`website` varchar(500) NOT NULL,
	`region` varchar(255) NOT NULL,
	`productIntro` text NOT NULL,
	`targetCustomers` text NOT NULL,
	`coreSellingPoints` text NOT NULL,
	`competitorNames` json NOT NULL,
	`coreKeywords` json NOT NULL,
	`status` enum('created','questions_ready','responses_imported','analysis_done','score_done','tasks_ready','report_ready') NOT NULL DEFAULT 'created',
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);

CREATE TABLE `publish_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`strategyName` varchar(255) NOT NULL,
	`reviewMode` enum('全人工审核','高分自动发布','全自动发布') NOT NULL DEFAULT '全人工审核',
	`dailyLimit` int,
	`minQualityScore` int NOT NULL DEFAULT 80,
	`preferredPlatforms` json NOT NULL,
	`bannedPlatforms` json NOT NULL,
	`platformNotes` text,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publish_strategies_id` PRIMARY KEY(`id`)
);

CREATE TABLE `publish_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`articleId` int NOT NULL,
	`platform` varchar(50) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`projectName` varchar(255),
	`platformAccountId` int,
	`expectedAccountName` varchar(255),
	`detectedAccountName` varchar(255),
	`accountVerificationStatus` varchar(32) DEFAULT 'pending',
	`articleTitle` text NOT NULL,
	`articleContent` text NOT NULL,
	`coverImageUrl` text,
	`resultUrl` varchar(500),
	`draftUrl` varchar(500),
	`publishedUrl` varchar(500),
	`localAgentId` varchar(100),
	`localProfileId` varchar(100),
	`agentPickedAt` timestamp,
	`agentFinishedAt` timestamp,
	`agentErrorType` varchar(50),
	`agentErrorMessage` text,
	`agentLog` json,
	`retryCount` int NOT NULL DEFAULT 0,
	`retryLog` json,
	`errorMessage` text,
	`apiKey` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publish_tasks_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`questionText` text NOT NULL,
	`questionType` enum('品牌认知','行业推荐','竞品对比','痛点解决','价格选型','高意向成交','指定问题','scenario_need','long_tail_conversion') NOT NULL,
	`targetKeyword` varchar(255),
	`intentLevel` varchar(64) NOT NULL DEFAULT '中',
	`businessValue` int NOT NULL DEFAULT 3,
	`source` enum('ai_generated','manual','csv','onboarding_wizard') NOT NULL DEFAULT 'ai_generated',
	`enabled` int NOT NULL DEFAULT 1,
	`contentGapTags` json,
	`searchPoolType` varchar(64),
	`targetKeywords` json,
	`targetCustomerScene` text,
	`relatedGeoGap` text,
	`relatedContentTask` boolean NOT NULL DEFAULT false,
	`requiredSourceTypes` json,
	`requiredEntityAnchors` json,
	`priorityLevel` varchar(16),
	`lastTestResult` varchar(32),
	`lastTestedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`geoScoreId` int,
	`oneSentenceConclusion` text NOT NULL,
	`totalScore` int NOT NULL DEFAULT 0,
	`mentionRecommendationSummary` text NOT NULL,
	`competitorAnalysis` text NOT NULL,
	`coreProblems` text NOT NULL,
	`contentGaps` text NOT NULL,
	`thirtyDayActions` text NOT NULL,
	`markdownContent` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `round_questions` (
	`id` varchar(36) NOT NULL,
	`roundId` varchar(36) NOT NULL,
	`questionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `round_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `round_questions_round_question_unique` UNIQUE(`roundId`,`questionId`)
);

CREATE TABLE `source_enhancement_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`suggestionTitle` varchar(255) NOT NULL,
	`gapType` varchar(64) NOT NULL,
	`targetPlatform` varchar(64),
	`targetKeywords` json NOT NULL,
	`contentDirection` text NOT NULL,
	`taskPriority` enum('P0','P1','P2') NOT NULL,
	`source_enhancement_status` enum('pending','accepted','content_task_created','ignored','verified') NOT NULL DEFAULT 'pending',
	`linkedTaskId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_enhancement_suggestions_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `understanding_assessment_dimension_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`assessmentId` varchar(36) NOT NULL,
	`dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty') NOT NULL,
	`scoreBasisPoints` int,
	`coverageBasisPoints` int NOT NULL,
	`confidenceBasisPoints` int NOT NULL,
	`resultPayload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `understanding_assessment_dimension_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_assessment_dimension_unique` UNIQUE(`assessmentId`,`dimension`)
);

CREATE TABLE `understanding_assessment_manual_reviews` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`assessmentId` varchar(36) NOT NULL,
	`action` enum('confirmed','rejected','overridden') NOT NULL,
	`overriddenOutcome` enum('accurate','mostly_accurate','partially_accurate','missing','inaccurate','outdated','conflicting','hallucinated','unverifiable'),
	`reason` text NOT NULL,
	`evidenceSnapshot` json NOT NULL,
	`reviewedBy` int NOT NULL,
	`reviewedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `understanding_assessment_manual_reviews_id` PRIMARY KEY(`id`)
);

CREATE TABLE `understanding_assessment_rule_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`assessmentId` varchar(36) NOT NULL,
	`ruleVersionId` varchar(36) NOT NULL,
	`matched` boolean NOT NULL,
	`severity` enum('P0','P1','P2') NOT NULL,
	`resultPayload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `understanding_assessment_rule_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_assessment_rule_result_unique` UNIQUE(`assessmentId`,`ruleVersionId`)
);

CREATE TABLE `understanding_assessments` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`observationRunId` varchar(36),
	`observationAnswerId` varchar(36),
	`extractionId` varchar(36) NOT NULL,
	`truthProfileVersionId` varchar(36) NOT NULL,
	`questionVersionId` varchar(36) NOT NULL,
	`extractionVersionId` varchar(36) NOT NULL,
	`methodologyVersionId` varchar(36) NOT NULL,
	`primaryRuleVersionId` varchar(36) NOT NULL,
	`assessmentStatus` enum('completed','partial','insufficient_data','failed') NOT NULL,
	`automaticOutcome` enum('accurate','mostly_accurate','partially_accurate','missing','inaccurate','outdated','conflicting','hallucinated','unverifiable') NOT NULL,
	`coverageBasisPoints` int NOT NULL,
	`confidenceBasisPoints` int NOT NULL,
	`assessmentPayload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_assessments_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_assessments_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_assessments_extraction_governance_unique` UNIQUE(`extractionId`,`truthProfileVersionId`,`questionVersionId`,`extractionVersionId`,`methodologyVersionId`,`primaryRuleVersionId`)
);

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
	`severity` enum('P0','P1','P2'),
	`customerExplanation` text NOT NULL,
	`recommendedCorrection` text NOT NULL,
	`verificationQuestionIds` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `understanding_dimension_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_dimension_evaluation_unique` UNIQUE(`evaluationId`,`dimension`)
);

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
	`methodologyVersion` varchar(64) NOT NULL,
	`dimensionWeights` json NOT NULL,
	`ruleVersion` varchar(64) NOT NULL,
	`truthProfileVersion` int NOT NULL,
	`questionSetVersion` int NOT NULL,
	`extractionVersion` varchar(32) NOT NULL,
	`extractorModel` varchar(128),
	`evaluatorModel` varchar(128),
	`manualReviewStatus` enum('not_required','pending','approved','overridden') NOT NULL DEFAULT 'not_required',
	`finalStatus` enum('accurate','mostly_accurate','partially_accurate','missing','inaccurate','outdated','conflicting','hallucinated','unverifiable') NOT NULL,
	`severity` enum('P0','P1','P2'),
	`assessmentStatus` enum('not_measured','insufficient_data','unknown','no_issue_detected','issue_detected') NOT NULL,
	`plannedQuestionCount` int NOT NULL,
	`runQuestionCount` int NOT NULL,
	`verifiedFactCount` int NOT NULL,
	`extractionCoverage` int NOT NULL,
	`assessmentCoverage` int NOT NULL,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `understanding_evaluations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `understanding_extraction_version_registry` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`extractorKey` varchar(128) NOT NULL,
	`version` int NOT NULL,
	`implementationVersion` varchar(128) NOT NULL,
	`promptHash` varchar(128) NOT NULL,
	`outputSchema` json NOT NULL,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_extraction_version_registry_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_extraction_versions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_extraction_versions_project_key_version_unique` UNIQUE(`projectId`,`extractorKey`,`version`)
);

CREATE TABLE `understanding_methodology_dimension_weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`methodologyVersionId` varchar(36) NOT NULL,
	`dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty') NOT NULL,
	`weightBasisPoints` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `understanding_methodology_dimension_weights_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_methodology_dimension_unique` UNIQUE(`methodologyVersionId`,`dimension`)
);

CREATE TABLE `understanding_methodology_registry` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`methodologyKey` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_methodology_registry_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_methodology_registry_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_methodology_registry_project_key_unique` UNIQUE(`projectId`,`methodologyKey`)
);

CREATE TABLE `understanding_methodology_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`methodologyId` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`description` text,
	`coveragePolicy` json NOT NULL,
	`confidencePolicy` json NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_methodology_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_methodology_versions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_methodology_versions_methodology_version_unique` UNIQUE(`methodologyId`,`version`)
);

CREATE TABLE `understanding_question_set_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`questionSetKey` varchar(128) NOT NULL,
	`legacyQuestionSetId` int,
	`version` int NOT NULL,
	`nameSnapshot` varchar(255) NOT NULL,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_question_set_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_question_set_versions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_question_set_versions_project_key_version_unique` UNIQUE(`projectId`,`questionSetKey`,`version`)
);

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

CREATE TABLE `understanding_question_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`questionSetVersionId` varchar(36) NOT NULL,
	`questionKey` varchar(128) NOT NULL,
	`legacyQuestionId` int,
	`version` int NOT NULL,
	`questionTextSnapshot` text NOT NULL,
	`scenarioSnapshot` text,
	`targetAudienceSnapshot` text,
	`importance` enum('critical','high','medium','low') NOT NULL,
	`purchaseIntent` enum('none','informational','consideration','transactional') NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_question_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_question_versions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_question_versions_set_key_version_unique` UNIQUE(`questionSetVersionId`,`questionKey`,`version`)
);

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

CREATE TABLE `understanding_rule_sets` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`ruleSetKey` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_rule_sets_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_rule_sets_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_rule_sets_project_key_unique` UNIQUE(`projectId`,`ruleSetKey`)
);

CREATE TABLE `understanding_rule_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` int NOT NULL,
	`ruleSetId` varchar(36) NOT NULL,
	`ruleKey` varchar(128) NOT NULL,
	`version` int NOT NULL,
	`severity` enum('P0','P1','P2') NOT NULL,
	`conditionJson` json NOT NULL,
	`outcomeJson` json NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `understanding_rule_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `understanding_rule_versions_id_project_unique` UNIQUE(`id`,`projectId`),
	CONSTRAINT `understanding_rule_versions_set_key_version_unique` UNIQUE(`ruleSetId`,`ruleKey`,`version`)
);

CREATE TABLE `user_feedbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`feedbackType` enum('bug','suggestion','other') NOT NULL,
	`description` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_feedbacks_id` PRIMARY KEY(`id`)
);

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`passwordHash` varchar(255),
	`loginMethod` varchar(64),
	`role` enum('user','admin','operator') NOT NULL DEFAULT 'user',
	`operatorCompanyName` varchar(255),
	`companyId` int,
	`userStatus` enum('pending_review','active','rejected','disabled') NOT NULL DEFAULT 'active',
	`customerRole` enum('customer_admin','customer_member'),
	`applicationNote` text,
	`reviewedAt` timestamp,
	`reviewedBy` int,
	`subscriptionPlanId` enum('basic','professional','enterprise') NOT NULL DEFAULT 'basic',
	`extensionApiKey` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

ALTER TABLE `ai_citation_results` ADD CONSTRAINT `ai_citation_results_extraction_project_fk` FOREIGN KEY (`extractionId`,`projectId`) REFERENCES `ai_observation_extractions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ai_extracted_brand_facts` ADD CONSTRAINT `ai_extracted_brand_facts_extraction_project_fk` FOREIGN KEY (`extractionId`,`projectId`) REFERENCES `ai_observation_extractions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ai_observation_answers` ADD CONSTRAINT `ai_observation_answers_run_project_fk` FOREIGN KEY (`observationRunId`,`projectId`) REFERENCES `ai_observation_runs`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ai_observation_extractions` ADD CONSTRAINT `ai_observation_extractions_answer_project_fk` FOREIGN KEY (`observationAnswerId`,`projectId`) REFERENCES `ai_observation_answers`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ai_observation_run_events` ADD CONSTRAINT `ai_observation_run_events_run_project_fk` FOREIGN KEY (`observationRunId`,`projectId`) REFERENCES `ai_observation_runs`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ai_recommendation_results` ADD CONSTRAINT `ai_recommendation_results_extraction_project_fk` FOREIGN KEY (`extractionId`,`projectId`) REFERENCES `ai_observation_extractions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `brand_fact_definition_versions` ADD CONSTRAINT `brand_fact_definition_versions_definition_project_fk` FOREIGN KEY (`definitionId`,`projectId`) REFERENCES `brand_fact_definitions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `brand_fact_industry_template_items` ADD CONSTRAINT `brand_fact_industry_items_template_project_fk` FOREIGN KEY (`templateVersionId`,`projectId`) REFERENCES `brand_fact_industry_template_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `brand_fact_industry_template_items` ADD CONSTRAINT `brand_fact_industry_items_definition_project_fk` FOREIGN KEY (`definitionVersionId`,`projectId`) REFERENCES `brand_fact_definition_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `brand_truth_profile_version_facts` ADD CONSTRAINT `brand_truth_profile_version_facts_profile_project_fk` FOREIGN KEY (`truthProfileVersionId`,`projectId`) REFERENCES `brand_truth_profile_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `brand_truth_profile_version_facts` ADD CONSTRAINT `brand_truth_profile_version_facts_fact_project_fk` FOREIGN KEY (`factVersionId`,`projectId`) REFERENCES `brand_truth_fact_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `brand_truth_profile_versions` ADD CONSTRAINT `brand_truth_profile_versions_profile_project_fk` FOREIGN KEY (`profileId`,`projectId`) REFERENCES `brand_truth_profiles`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessment_dimension_results` ADD CONSTRAINT `understanding_assessment_dimensions_assessment_project_fk` FOREIGN KEY (`assessmentId`,`projectId`) REFERENCES `understanding_assessments`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessment_manual_reviews` ADD CONSTRAINT `understanding_assessment_reviews_assessment_project_fk` FOREIGN KEY (`assessmentId`,`projectId`) REFERENCES `understanding_assessments`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessment_rule_results` ADD CONSTRAINT `understanding_assessment_rule_results_assessment_project_fk` FOREIGN KEY (`assessmentId`,`projectId`) REFERENCES `understanding_assessments`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessment_rule_results` ADD CONSTRAINT `understanding_assessment_rule_results_rule_project_fk` FOREIGN KEY (`ruleVersionId`,`projectId`) REFERENCES `understanding_rule_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessments` ADD CONSTRAINT `understanding_assessments_observation_extraction_project_fk` FOREIGN KEY (`extractionId`,`projectId`) REFERENCES `ai_observation_extractions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessments` ADD CONSTRAINT `understanding_assessments_truth_profile_version_project_fk` FOREIGN KEY (`truthProfileVersionId`,`projectId`) REFERENCES `brand_truth_profile_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessments` ADD CONSTRAINT `understanding_assessments_question_project_fk` FOREIGN KEY (`questionVersionId`,`projectId`) REFERENCES `understanding_question_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessments` ADD CONSTRAINT `understanding_assessments_extraction_version_project_fk` FOREIGN KEY (`extractionVersionId`,`projectId`) REFERENCES `understanding_extraction_version_registry`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessments` ADD CONSTRAINT `understanding_assessments_methodology_project_fk` FOREIGN KEY (`methodologyVersionId`,`projectId`) REFERENCES `understanding_methodology_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_assessments` ADD CONSTRAINT `understanding_assessments_rule_project_fk` FOREIGN KEY (`primaryRuleVersionId`,`projectId`) REFERENCES `understanding_rule_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_methodology_dimension_weights` ADD CONSTRAINT `understanding_methodology_weights_version_project_fk` FOREIGN KEY (`methodologyVersionId`,`projectId`) REFERENCES `understanding_methodology_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_methodology_versions` ADD CONSTRAINT `understanding_methodology_versions_registry_project_fk` FOREIGN KEY (`methodologyId`,`projectId`) REFERENCES `understanding_methodology_registry`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_question_versions` ADD CONSTRAINT `understanding_question_versions_set_project_fk` FOREIGN KEY (`questionSetVersionId`,`projectId`) REFERENCES `understanding_question_set_versions`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `understanding_rule_versions` ADD CONSTRAINT `understanding_rule_versions_set_project_fk` FOREIGN KEY (`ruleSetId`,`projectId`) REFERENCES `understanding_rule_sets`(`id`,`projectId`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `ai_citation_results_project_extraction_idx` ON `ai_citation_results` (`projectId`,`extractionId`);
CREATE INDEX `ai_extracted_brand_facts_project_extraction_idx` ON `ai_extracted_brand_facts` (`projectId`,`extractionId`);
CREATE INDEX `ai_observation_answers_project_run_idx` ON `ai_observation_answers` (`projectId`,`observationRunId`);
CREATE INDEX `ai_observation_extractions_project_answer_idx` ON `ai_observation_extractions` (`projectId`,`observationAnswerId`);
CREATE INDEX `ai_observation_run_events_project_run_idx` ON `ai_observation_run_events` (`projectId`,`observationRunId`);
CREATE INDEX `ai_observation_runs_project_started_idx` ON `ai_observation_runs` (`projectId`,`startedAt`);
CREATE INDEX `ai_recommendation_results_project_extraction_idx` ON `ai_recommendation_results` (`projectId`,`extractionId`);
CREATE INDEX `brand_truth_conflicts_project_status_idx` ON `brand_truth_conflicts` (`projectId`,`resolutionStatus`);
CREATE INDEX `brand_truth_evidence_project_idx` ON `brand_truth_evidence` (`projectId`);
CREATE INDEX `brand_truth_facts_project_key_idx` ON `brand_truth_facts` (`projectId`,`factKey`);
CREATE INDEX `brand_truth_facts_profile_idx` ON `brand_truth_facts` (`profileId`);
CREATE INDEX `company_projects_company_idx` ON `company_projects` (`companyId`);
CREATE INDEX `customer_companies_owner_user_idx` ON `customer_companies` (`ownerUserId`);
CREATE INDEX `geo_maturity_scores_project_calculated_idx` ON `geo_maturity_scores` (`projectId`,`calculatedAt`);
CREATE INDEX `monthly_optimization_plans_project_status_idx` ON `monthly_optimization_plans` (`projectId`,`monthlyOptimizationPlanStatus`);
CREATE INDEX `monthly_optimization_tasks_plan_idx` ON `monthly_optimization_tasks` (`planId`);
CREATE INDEX `monthly_optimization_tasks_project_idx` ON `monthly_optimization_tasks` (`projectId`);
CREATE INDEX `understanding_assessment_reviews_project_assessment_idx` ON `understanding_assessment_manual_reviews` (`projectId`,`assessmentId`,`reviewedAt`);
CREATE INDEX `understanding_assessments_project_created_idx` ON `understanding_assessments` (`projectId`,`createdAt`);
CREATE INDEX `understanding_correction_tasks_project_status_idx` ON `understanding_correction_tasks` (`projectId`,`status`);
CREATE INDEX `understanding_evaluations_project_tested_idx` ON `understanding_evaluations` (`projectId`,`testedAt`);
CREATE INDEX `understanding_questions_set_idx` ON `understanding_questions` (`questionSetId`);

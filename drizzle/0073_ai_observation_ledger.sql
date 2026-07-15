CREATE TABLE `ai_observation_runs` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `questionSetId` int NULL, `questionSetVersionSnapshot` int NOT NULL,
  `provider` varchar(64) NOT NULL, `modelName` varchar(128) NOT NULL, `modelVersion` varchar(128) NULL, `modelChannel` varchar(128) NULL,
  `runPurpose` varchar(64) NOT NULL, `locale` varchar(32) NOT NULL, `startedAt` timestamp NOT NULL, `completedAt` timestamp NULL,
  `runStatus` enum('queued','running','succeeded','partially_succeeded','failed','cancelled') NOT NULL,
  `providerRequestId` varchar(255) NULL, `systemPromptVersion` varchar(64) NOT NULL, `systemPromptHash` varchar(128) NOT NULL,
  `systemPromptSnapshot` text NULL, `samplingParameters` json NULL, `applicationVersion` varchar(128) NOT NULL,
  `errorCode` varchar(128) NULL, `errorMessage` text NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `ai_observation_runs_id_project_unique` (`id`,`projectId`),
  KEY `ai_observation_runs_project_started_idx` (`projectId`,`startedAt`)
);
--> statement-breakpoint
CREATE TABLE `ai_observation_run_events` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `observationRunId` varchar(36) NOT NULL,
  `eventType` enum('queued','running','succeeded','partially_succeeded','failed','cancelled') NOT NULL,
  `eventSequence` int NOT NULL, `occurredAt` timestamp NOT NULL, `errorCode` varchar(128) NULL, `errorMessage` text NULL,
  `eventMetadata` json NULL, `createdBy` int NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_observation_run_events_run_sequence_unique` (`observationRunId`,`eventSequence`),
  KEY `ai_observation_run_events_project_run_idx` (`projectId`,`observationRunId`),
  CONSTRAINT `ai_observation_run_events_run_project_fk` FOREIGN KEY (`observationRunId`,`projectId`) REFERENCES `ai_observation_runs` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `ai_observation_answers` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `observationRunId` varchar(36) NOT NULL, `questionId` int NULL,
  `questionKey` varchar(128) NOT NULL, `questionVersionSnapshot` int NOT NULL, `questionTextSnapshot` text NOT NULL, `scenarioSnapshot` text NULL,
  `attemptNumber` int NOT NULL, `providerResponseId` varchar(255) NULL, `rawAnswer` mediumtext NULL, `rawProviderMetadata` json NULL,
  `answerContentHash` varchar(128) NULL, `receivedAt` timestamp NULL, `latencyMs` int NULL, `inputTokens` int NULL, `outputTokens` int NULL,
  `totalTokens` int NULL, `finishReason` varchar(128) NULL, `answerStatus` enum('received','empty','provider_error','blocked','incomplete') NOT NULL,
  `citationCapability` enum('supported','unsupported','unknown') NOT NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `ai_observation_answers_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `ai_observation_answers_run_question_attempt_unique` (`observationRunId`,`questionKey`,`attemptNumber`),
  KEY `ai_observation_answers_project_run_idx` (`projectId`,`observationRunId`),
  CONSTRAINT `ai_observation_answers_run_project_fk` FOREIGN KEY (`observationRunId`,`projectId`) REFERENCES `ai_observation_runs` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `ai_observation_extractions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `observationAnswerId` varchar(36) NOT NULL, `attemptNumber` int NOT NULL,
  `extractorKey` varchar(128) NOT NULL, `extractorVersion` varchar(64) NOT NULL, `extractionPromptVersion` varchar(64) NOT NULL,
  `extractionPromptHash` varchar(128) NOT NULL, `extractionModelProvider` varchar(64) NULL, `extractionModelName` varchar(128) NULL,
  `extractionModelChannel` varchar(128) NULL, `extractionStatus` enum('succeeded','partially_succeeded','failed','insufficient_content') NOT NULL,
  `structuredPayload` json NULL, `extractionCoverage` int NULL, `extractionConfidence` int NULL,
  `citationExtractionStatus` enum('detected','not_detected','unsupported','unknown','extraction_failed') NOT NULL,
  `startedAt` timestamp NOT NULL, `completedAt` timestamp NULL, `errorCode` varchar(128) NULL, `errorMessage` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `ai_observation_extractions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `ai_observation_extractions_answer_attempt_unique` (`observationAnswerId`,`extractorKey`,`extractorVersion`,`attemptNumber`),
  KEY `ai_observation_extractions_project_answer_idx` (`projectId`,`observationAnswerId`),
  CONSTRAINT `ai_observation_extractions_answer_project_fk` FOREIGN KEY (`observationAnswerId`,`projectId`) REFERENCES `ai_observation_answers` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `ai_extracted_brand_facts` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL, `extractionId` varchar(36) NOT NULL, `brandId` varchar(128) NULL,
  `factKey` varchar(128) NOT NULL, `extractedValue` text NOT NULL, `normalizedValue` text NULL, `sourceTextSpan` text NULL,
  `confidence` int NULL, `uncertaintyType` enum('none','explicit_uncertainty','ambiguous','inferred','unavailable') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  KEY `ai_extracted_brand_facts_project_extraction_idx` (`projectId`,`extractionId`),
  CONSTRAINT `ai_extracted_brand_facts_extraction_project_fk` FOREIGN KEY (`extractionId`,`projectId`) REFERENCES `ai_observation_extractions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `ai_recommendation_results` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL, `extractionId` varchar(36) NOT NULL, `targetBrand` varchar(255) NOT NULL,
  `competitorIdentity` varchar(255) NULL, `mentionStatus` enum('detected','not_detected','unknown') NOT NULL,
  `candidateStatus` enum('entered','not_entered','unknown') NOT NULL, `recommendationStatus` enum('recommended','not_recommended','unknown') NOT NULL,
  `recommendationRank` int NULL, `recommendationReasonText` text NULL, `confidence` int NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `ai_recommendation_results_project_extraction_idx` (`projectId`,`extractionId`),
  CONSTRAINT `ai_recommendation_results_extraction_project_fk` FOREIGN KEY (`extractionId`,`projectId`) REFERENCES `ai_observation_extractions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `ai_citation_results` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL, `extractionId` varchar(36) NOT NULL,
  `citationStatus` enum('detected','not_detected','unsupported','unknown','extraction_failed') NOT NULL, `rawCitationText` text NULL,
  `normalizedUrl` varchar(2000) NULL, `sourceTitle` varchar(500) NULL, `sourceOwner` varchar(255) NULL, `sourcePosition` int NULL,
  `accessibilityStatus` enum('accessible','inaccessible','unknown','not_checked') NOT NULL, `confidence` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  KEY `ai_citation_results_project_extraction_idx` (`projectId`,`extractionId`),
  CONSTRAINT `ai_citation_results_extraction_project_fk` FOREIGN KEY (`extractionId`,`projectId`) REFERENCES `ai_observation_extractions` (`id`,`projectId`)
);

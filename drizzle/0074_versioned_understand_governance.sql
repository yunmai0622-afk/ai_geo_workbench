CREATE TABLE `brand_fact_definitions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `definitionKey` varchar(128) NOT NULL,
  `status` enum('draft','active','retired') NOT NULL DEFAULT 'draft', `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `brand_fact_definitions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `brand_fact_definitions_project_key_unique` (`projectId`,`definitionKey`)
);
--> statement-breakpoint
CREATE TABLE `brand_fact_definition_versions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `definitionId` varchar(36) NOT NULL, `version` int NOT NULL,
  `displayName` varchar(255) NOT NULL, `description` text NULL,
  `requirement` enum('required','optional','not_applicable') NOT NULL,
  `valueType` enum('text','integer','decimal','boolean','date','datetime','url','enum','json') NOT NULL,
  `cardinality` enum('one','many') NOT NULL, `temporalSemantics` enum('timeless','effective_period','point_in_time','event_stream') NOT NULL,
  `validationSchema` json NULL, `effectiveFrom` timestamp NOT NULL, `effectiveTo` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `brand_fact_definition_versions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `brand_fact_definition_versions_definition_version_unique` (`definitionId`,`version`),
  CONSTRAINT `brand_fact_definition_versions_definition_project_fk` FOREIGN KEY (`definitionId`,`projectId`) REFERENCES `brand_fact_definitions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `brand_fact_industry_template_versions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `industryKey` varchar(128) NOT NULL, `version` int NOT NULL,
  `name` varchar(255) NOT NULL, `status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
  `effectiveFrom` timestamp NOT NULL, `effectiveTo` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `brand_fact_industry_templates_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `brand_fact_industry_templates_project_industry_version_unique` (`projectId`,`industryKey`,`version`)
);
--> statement-breakpoint
CREATE TABLE `brand_fact_industry_template_items` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL, `templateVersionId` varchar(36) NOT NULL, `definitionVersionId` varchar(36) NOT NULL,
  `requirementOverride` enum('required','optional','not_applicable') NULL, `sortOrder` int NOT NULL DEFAULT 0, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `brand_fact_industry_template_item_unique` (`templateVersionId`,`definitionVersionId`),
  CONSTRAINT `brand_fact_industry_items_template_project_fk` FOREIGN KEY (`templateVersionId`,`projectId`) REFERENCES `brand_fact_industry_template_versions` (`id`,`projectId`),
  CONSTRAINT `brand_fact_industry_items_definition_project_fk` FOREIGN KEY (`definitionVersionId`,`projectId`) REFERENCES `brand_fact_definition_versions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_question_set_versions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `questionSetKey` varchar(128) NOT NULL, `legacyQuestionSetId` int NULL, `version` int NOT NULL,
  `nameSnapshot` varchar(255) NOT NULL, `status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
  `effectiveFrom` timestamp NOT NULL, `effectiveTo` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_question_set_versions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_question_set_versions_project_key_version_unique` (`projectId`,`questionSetKey`,`version`)
);
--> statement-breakpoint
CREATE TABLE `understanding_question_versions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `questionSetVersionId` varchar(36) NOT NULL, `questionKey` varchar(128) NOT NULL,
  `legacyQuestionId` int NULL, `version` int NOT NULL, `questionTextSnapshot` text NOT NULL, `scenarioSnapshot` text NULL,
  `targetAudienceSnapshot` text NULL, `importance` enum('critical','high','medium','low') NOT NULL,
  `purchaseIntent` enum('none','informational','consideration','transactional') NOT NULL,
  `effectiveFrom` timestamp NOT NULL, `effectiveTo` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_question_versions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_question_versions_set_key_version_unique` (`questionSetVersionId`,`questionKey`,`version`),
  CONSTRAINT `understanding_question_versions_set_project_fk` FOREIGN KEY (`questionSetVersionId`,`projectId`) REFERENCES `understanding_question_set_versions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_methodology_registry` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `methodologyKey` varchar(128) NOT NULL, `name` varchar(255) NOT NULL,
  `status` enum('draft','active','retired') NOT NULL DEFAULT 'draft', `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_methodology_registry_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_methodology_registry_project_key_unique` (`projectId`,`methodologyKey`)
);
--> statement-breakpoint
CREATE TABLE `understanding_methodology_versions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `methodologyId` varchar(36) NOT NULL, `version` int NOT NULL,
  `description` text NULL, `coveragePolicy` json NOT NULL, `confidencePolicy` json NOT NULL,
  `effectiveFrom` timestamp NOT NULL, `effectiveTo` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_methodology_versions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_methodology_versions_methodology_version_unique` (`methodologyId`,`version`),
  CONSTRAINT `understanding_methodology_versions_registry_project_fk` FOREIGN KEY (`methodologyId`,`projectId`) REFERENCES `understanding_methodology_registry` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_methodology_dimension_weights` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL, `methodologyVersionId` varchar(36) NOT NULL,
  `dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty') NOT NULL,
  `weightBasisPoints` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_methodology_dimension_unique` (`methodologyVersionId`,`dimension`),
  CONSTRAINT `understanding_methodology_weights_version_project_fk` FOREIGN KEY (`methodologyVersionId`,`projectId`) REFERENCES `understanding_methodology_versions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_extraction_version_registry` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `extractorKey` varchar(128) NOT NULL, `version` int NOT NULL,
  `implementationVersion` varchar(128) NOT NULL, `promptHash` varchar(128) NOT NULL, `outputSchema` json NOT NULL,
  `status` enum('draft','active','retired') NOT NULL DEFAULT 'draft', `effectiveFrom` timestamp NOT NULL, `effectiveTo` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_extraction_versions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_extraction_versions_project_key_version_unique` (`projectId`,`extractorKey`,`version`)
);
--> statement-breakpoint
CREATE TABLE `understanding_rule_sets` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `ruleSetKey` varchar(128) NOT NULL, `name` varchar(255) NOT NULL,
  `status` enum('draft','active','retired') NOT NULL DEFAULT 'draft', `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_rule_sets_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_rule_sets_project_key_unique` (`projectId`,`ruleSetKey`)
);
--> statement-breakpoint
CREATE TABLE `understanding_rule_versions` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `ruleSetId` varchar(36) NOT NULL, `ruleKey` varchar(128) NOT NULL, `version` int NOT NULL,
  `severity` enum('P0','P1','P2') NOT NULL, `conditionJson` json NOT NULL, `outcomeJson` json NOT NULL,
  `effectiveFrom` timestamp NOT NULL, `effectiveTo` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_rule_versions_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_rule_versions_set_key_version_unique` (`ruleSetId`,`ruleKey`,`version`),
  CONSTRAINT `understanding_rule_versions_set_project_fk` FOREIGN KEY (`ruleSetId`,`projectId`) REFERENCES `understanding_rule_sets` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_assessments` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `observationRunId` varchar(36) NULL, `observationAnswerId` varchar(36) NULL,
  `extractionId` varchar(36) NOT NULL, `truthProfileId` int NOT NULL, `truthProfileVersion` int NOT NULL,
  `questionVersionId` varchar(36) NOT NULL, `extractionVersionId` varchar(36) NOT NULL, `methodologyVersionId` varchar(36) NOT NULL,
  `primaryRuleVersionId` varchar(36) NOT NULL, `assessmentStatus` enum('completed','partial','insufficient_data','failed') NOT NULL,
  `automaticOutcome` enum('accurate','mostly_accurate','partially_accurate','missing','inaccurate','outdated','conflicting','hallucinated','unverifiable') NOT NULL,
  `coverageBasisPoints` int NOT NULL, `confidenceBasisPoints` int NOT NULL, `assessmentPayload` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `createdBy` int NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_assessments_id_project_unique` (`id`,`projectId`),
  UNIQUE KEY `understanding_assessments_extraction_governance_unique` (`extractionId`,`questionVersionId`,`extractionVersionId`,`methodologyVersionId`,`primaryRuleVersionId`),
  KEY `understanding_assessments_project_created_idx` (`projectId`,`createdAt`),
  CONSTRAINT `understanding_assessments_question_project_fk` FOREIGN KEY (`questionVersionId`,`projectId`) REFERENCES `understanding_question_versions` (`id`,`projectId`),
  CONSTRAINT `understanding_assessments_extraction_version_project_fk` FOREIGN KEY (`extractionVersionId`,`projectId`) REFERENCES `understanding_extraction_version_registry` (`id`,`projectId`),
  CONSTRAINT `understanding_assessments_methodology_project_fk` FOREIGN KEY (`methodologyVersionId`,`projectId`) REFERENCES `understanding_methodology_versions` (`id`,`projectId`),
  CONSTRAINT `understanding_assessments_rule_project_fk` FOREIGN KEY (`primaryRuleVersionId`,`projectId`) REFERENCES `understanding_rule_versions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_assessment_dimension_results` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL, `assessmentId` varchar(36) NOT NULL,
  `dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty') NOT NULL,
  `scoreBasisPoints` int NULL, `coverageBasisPoints` int NOT NULL, `confidenceBasisPoints` int NOT NULL, `resultPayload` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  UNIQUE KEY `understanding_assessment_dimension_unique` (`assessmentId`,`dimension`),
  CONSTRAINT `understanding_assessment_dimensions_assessment_project_fk` FOREIGN KEY (`assessmentId`,`projectId`) REFERENCES `understanding_assessments` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_assessment_rule_results` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL, `assessmentId` varchar(36) NOT NULL, `ruleVersionId` varchar(36) NOT NULL,
  `matched` boolean NOT NULL, `severity` enum('P0','P1','P2') NOT NULL, `resultPayload` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  UNIQUE KEY `understanding_assessment_rule_result_unique` (`assessmentId`,`ruleVersionId`),
  CONSTRAINT `understanding_assessment_rule_results_assessment_project_fk` FOREIGN KEY (`assessmentId`,`projectId`) REFERENCES `understanding_assessments` (`id`,`projectId`),
  CONSTRAINT `understanding_assessment_rule_results_rule_project_fk` FOREIGN KEY (`ruleVersionId`,`projectId`) REFERENCES `understanding_rule_versions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_assessment_manual_reviews` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `assessmentId` varchar(36) NOT NULL,
  `action` enum('confirmed','rejected','overridden') NOT NULL, `overriddenOutcome` enum('accurate','mostly_accurate','partially_accurate','missing','inaccurate','outdated','conflicting','hallucinated','unverifiable') NULL,
  `reason` text NOT NULL, `evidenceSnapshot` json NOT NULL, `reviewedBy` int NOT NULL, `reviewedAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  KEY `understanding_assessment_reviews_project_assessment_idx` (`projectId`,`assessmentId`,`reviewedAt`),
  CONSTRAINT `understanding_assessment_reviews_assessment_project_fk` FOREIGN KEY (`assessmentId`,`projectId`) REFERENCES `understanding_assessments` (`id`,`projectId`)
);

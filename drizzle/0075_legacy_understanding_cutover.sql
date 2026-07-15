CREATE TABLE `legacy_understanding_migration_runs` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL,
  `mode` enum('dry_run','execute') NOT NULL, `migrationVersion` varchar(64) NOT NULL,
  `status` enum('running','completed','partially_completed','failed','cancelled') NOT NULL DEFAULT 'running',
  `resumeAfterLegacyEvaluationId` varchar(36) NULL, `scannedCount` int NOT NULL DEFAULT 0,
  `migratedCount` int NOT NULL DEFAULT 0, `partialCount` int NOT NULL DEFAULT 0,
  `skippedCount` int NOT NULL DEFAULT 0, `failedCount` int NOT NULL DEFAULT 0,
  `report` json NULL, `startedAt` timestamp NOT NULL, `completedAt` timestamp NULL,
  `createdBy` int NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `legacy_understanding_migration_runs_id_project_unique` (`id`,`projectId`),
  KEY `legacy_understanding_migration_runs_project_started_idx` (`projectId`,`startedAt`),
  CONSTRAINT `legacy_understanding_migration_runs_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`)
);
--> statement-breakpoint
CREATE TABLE `legacy_understanding_migration_items` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `migrationRunId` varchar(36) NULL,
  `legacyEvaluationId` varchar(36) NOT NULL, `sourceChecksum` varchar(71) NOT NULL,
  `migrationVersion` varchar(64) NOT NULL,
  `migrationStatus` enum('pending','migratable','partially_migratable','migrated','skipped','failed','legacy_non_reproducible') NOT NULL,
  `provenance` enum('legacy_import') NOT NULL DEFAULT 'legacy_import',
  `reproducibilityStatus` enum('fully_reproducible','observation_reproducible','partially_reproducible','legacy_non_reproducible') NOT NULL,
  `targetRunId` varchar(36) NULL, `targetAnswerId` varchar(36) NULL,
  `targetExtractionId` varchar(36) NULL, `targetAssessmentId` varchar(36) NULL,
  `missingFields` json NULL, `legacyPayloadSnapshot` json NULL, `failureReason` text NULL, `migratedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `legacy_understanding_migration_items_source_unique` (`projectId`,`legacyEvaluationId`,`migrationVersion`),
  KEY `legacy_understanding_migration_items_run_status_idx` (`projectId`,`migrationRunId`,`migrationStatus`),
  KEY `legacy_understanding_migration_items_checksum_idx` (`sourceChecksum`),
  CONSTRAINT `legacy_understanding_migration_items_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`),
  CONSTRAINT `legacy_understanding_migration_items_run_project_fk` FOREIGN KEY (`migrationRunId`,`projectId`) REFERENCES `legacy_understanding_migration_runs` (`id`,`projectId`),
  CONSTRAINT `legacy_understanding_migration_items_target_run_project_fk` FOREIGN KEY (`targetRunId`,`projectId`) REFERENCES `ai_observation_runs` (`id`,`projectId`),
  CONSTRAINT `legacy_understanding_migration_items_target_answer_project_fk` FOREIGN KEY (`targetAnswerId`,`projectId`) REFERENCES `ai_observation_answers` (`id`,`projectId`),
  CONSTRAINT `legacy_understanding_migration_items_target_extraction_project_fk` FOREIGN KEY (`targetExtractionId`,`projectId`) REFERENCES `ai_observation_extractions` (`id`,`projectId`),
  CONSTRAINT `legacy_understanding_migration_items_target_assessment_project_fk` FOREIGN KEY (`targetAssessmentId`,`projectId`) REFERENCES `understanding_assessments` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `understanding_rollout_configs` (
  `id` int NOT NULL AUTO_INCREMENT, `projectId` int NOT NULL,
  `readMode` enum('legacy_only','shadow_read','v2_primary','v2_only') NOT NULL DEFAULT 'legacy_only',
  `writePath` enum('legacy','v2') NOT NULL DEFAULT 'legacy',
  `reason` text NULL, `updatedBy` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `understanding_rollout_configs_project_unique` (`projectId`),
  CONSTRAINT `understanding_rollout_configs_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`)
);

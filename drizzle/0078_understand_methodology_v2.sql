ALTER TABLE `understanding_methodology_dimension_weights`
  MODIFY COLUMN `dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty','category','products_services','customers','scenarios','capability_differentiation','boundary_temporal','product_service','target_customer','scenario') NOT NULL;
--> statement-breakpoint
ALTER TABLE `understanding_assessment_dimension_results`
  MODIFY COLUMN `dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty','category','products_services','customers','scenarios','capability_differentiation','boundary_temporal','product_service','target_customer','scenario') NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `understanding_methodology_dimension_definitions` (
  `id` int AUTO_INCREMENT NOT NULL, `projectId` int NOT NULL, `methodologyVersionId` varchar(36) NOT NULL,
  `dimension` enum('identity','category','business','product_service','target_customer','scenario','capability_differentiation','boundary_temporal') NOT NULL,
  `displayName` varchar(128) NOT NULL, `weightBasisPoints` int NOT NULL, `factKeys` json NOT NULL, `questionTypes` json NOT NULL,
  `extractionFields` json NOT NULL, `judgmentRules` json NOT NULL, `coverageThresholdBasisPoints` int NOT NULL,
  `unverifiableConditions` json NOT NULL, `confidencePolicy` json NOT NULL, `severityRules` json NOT NULL, `subdimensions` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()), PRIMARY KEY (`id`),
  UNIQUE KEY `understanding_methodology_definition_dimension_unique` (`methodologyVersionId`,`dimension`),
  CONSTRAINT `understanding_methodology_defs_version_project_fk` FOREIGN KEY (`methodologyVersionId`,`projectId`) REFERENCES `understanding_methodology_versions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `understanding_question_dimension_bindings` (
  `id` int AUTO_INCREMENT NOT NULL, `projectId` int NOT NULL, `questionVersionId` varchar(36) NOT NULL,
  `primaryDimension` enum('identity','category','business','product_service','target_customer','scenario','capability_differentiation','boundary_temporal') NOT NULL,
  `secondaryDimensions` json NOT NULL, `subdimension` varchar(64), `createdAt` timestamp NOT NULL DEFAULT (now()), PRIMARY KEY (`id`),
  UNIQUE KEY `understanding_question_dimension_question_unique` (`questionVersionId`),
  CONSTRAINT `understanding_question_dimension_question_project_fk` FOREIGN KEY (`questionVersionId`,`projectId`) REFERENCES `understanding_question_versions` (`id`,`projectId`)
);
--> statement-breakpoint
ALTER TABLE `brand_truth_facts`
  ADD COLUMN `temporalStatus` enum('current','historical','discontinued','unknown') NOT NULL DEFAULT 'unknown' AFTER `validTo`,
  ADD COLUMN `companyEntityChange` boolean NOT NULL DEFAULT false AFTER `temporalStatus`,
  ADD COLUMN `productServiceStatus` enum('current','historical','discontinued','unknown') NOT NULL DEFAULT 'unknown' AFTER `companyEntityChange`;

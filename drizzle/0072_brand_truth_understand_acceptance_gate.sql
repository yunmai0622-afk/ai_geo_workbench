-- Forward-only acceptance hardening. Existing observations and evaluations are preserved.
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `methodologyVersion` varchar(64) NULL AFTER `evaluationVersion`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `dimensionWeights` json NULL AFTER `methodologyVersion`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `ruleVersion` varchar(64) NULL AFTER `dimensionWeights`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  MODIFY COLUMN IF EXISTS `severity` enum('P0','P1','P2') NULL;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `assessmentStatus` enum('not_measured','insufficient_data','unknown','no_issue_detected','issue_detected') NULL AFTER `severity`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `plannedQuestionCount` int NULL AFTER `assessmentStatus`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `runQuestionCount` int NULL AFTER `plannedQuestionCount`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `verifiedFactCount` int NULL AFTER `runQuestionCount`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `extractionCoverage` int NULL AFTER `verifiedFactCount`;
--> statement-breakpoint
ALTER TABLE `understanding_evaluations`
  ADD COLUMN IF NOT EXISTS `assessmentCoverage` int NULL AFTER `extractionCoverage`;
--> statement-breakpoint
ALTER TABLE `understanding_dimension_results`
  MODIFY COLUMN IF EXISTS `severity` enum('P0','P1','P2') NULL;

-- Columns are nullable only for rows written before this migration. New application writes require all snapshot fields.
-- Do not backfill invented methodology metadata into historical rows.

-- Forward-only acceptance hardening. Existing observations and evaluations are preserved.
ALTER TABLE `understanding_evaluations`
  ADD COLUMN `methodologyVersion` varchar(64) NULL AFTER `evaluationVersion`,
  ADD COLUMN `dimensionWeights` json NULL AFTER `methodologyVersion`,
  ADD COLUMN `ruleVersion` varchar(64) NULL AFTER `dimensionWeights`,
  MODIFY COLUMN `severity` enum('P0','P1','P2') NULL,
  ADD COLUMN `assessmentStatus` enum('not_measured','insufficient_data','unknown','no_issue_detected','issue_detected') NULL AFTER `severity`,
  ADD COLUMN `plannedQuestionCount` int NULL AFTER `assessmentStatus`,
  ADD COLUMN `runQuestionCount` int NULL AFTER `plannedQuestionCount`,
  ADD COLUMN `verifiedFactCount` int NULL AFTER `runQuestionCount`,
  ADD COLUMN `extractionCoverage` int NULL AFTER `verifiedFactCount`,
  ADD COLUMN `assessmentCoverage` int NULL AFTER `extractionCoverage`;
--> statement-breakpoint
ALTER TABLE `understanding_dimension_results`
  MODIFY COLUMN `severity` enum('P0','P1','P2') NULL;

-- Columns are nullable only for rows written before this migration. New application writes require all snapshot fields.
-- Do not backfill invented methodology metadata into historical rows.

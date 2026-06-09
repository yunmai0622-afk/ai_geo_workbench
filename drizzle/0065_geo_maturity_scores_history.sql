ALTER TABLE `geo_maturity_scores` DROP INDEX `geo_maturity_scores_project_unique`;
--> statement-breakpoint
CREATE INDEX `geo_maturity_scores_project_calculated_idx` ON `geo_maturity_scores` (`projectId`, `calculatedAt`);

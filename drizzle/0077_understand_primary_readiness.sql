ALTER TABLE `understanding_methodology_dimension_weights`
  MODIFY COLUMN `dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty','category','products_services','customers','scenarios','capability_differentiation','boundary_temporal') NOT NULL;
--> statement-breakpoint
ALTER TABLE `understanding_assessment_dimension_results`
  MODIFY COLUMN `dimension` enum('identity','business','capability','boundary','temporal','evidence','consistency','uncertainty','category','products_services','customers','scenarios','capability_differentiation','boundary_temporal') NOT NULL;
--> statement-breakpoint
ALTER TABLE `understanding_assessment_manual_reviews`
  MODIFY COLUMN `action` enum('confirmed','rejected','overridden','request_evidence','mark_insufficient_data') NOT NULL;

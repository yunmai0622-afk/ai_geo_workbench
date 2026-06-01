-- GEO V1.1 Phase 2: prevent duplicate T0 run rows per (round, question, platform, runIndex)

ALTER TABLE `ai_test_runs` ADD CONSTRAINT `ai_test_runs_round_question_platform_run_unique` UNIQUE(`roundId`,`questionId`,`platform`,`runIndex`);

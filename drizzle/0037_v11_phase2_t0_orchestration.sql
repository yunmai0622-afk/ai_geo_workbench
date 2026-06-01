-- GEO V1.1 Phase 2: round_questions + questionType enum extension

CREATE TABLE `round_questions` (
	`id` varchar(36) NOT NULL,
	`roundId` varchar(36) NOT NULL,
	`questionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `round_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `round_questions_round_question_unique` UNIQUE(`roundId`,`questionId`)
);
--> statement-breakpoint
ALTER TABLE `questions` MODIFY COLUMN `questionType` enum('品牌认知','行业推荐','竞品对比','痛点解决','价格选型','高意向成交','指定问题','scenario_need','long_tail_conversion') NOT NULL;

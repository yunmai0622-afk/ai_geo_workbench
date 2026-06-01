-- GEO-V1.1-Feedback-Entry: 用户反馈
CREATE TABLE `user_feedbacks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `projectId` int,
  `type` enum('bug','suggestion','other') NOT NULL,
  `description` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `user_feedbacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_user_feedbacks_user_id` ON `user_feedbacks` (`userId`);

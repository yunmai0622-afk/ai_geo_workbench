CREATE TABLE `system_notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `projectId` int,
  `type` enum('t0_complete','publish_success','publish_failed','t1_retest_complete') NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `readAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `system_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_system_notifications_user_id` ON `system_notifications` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_system_notifications_user_read` ON `system_notifications` (`userId`,`readAt`);

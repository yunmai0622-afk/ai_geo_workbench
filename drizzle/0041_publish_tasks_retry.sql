ALTER TABLE `publish_tasks`
  ADD COLUMN `retryCount` int NOT NULL DEFAULT 0,
  ADD COLUMN `retryLog` json NULL;

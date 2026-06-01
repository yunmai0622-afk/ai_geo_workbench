ALTER TABLE `publish_tasks`
  ADD COLUMN `localAgentId` varchar(100) NULL,
  ADD COLUMN `localProfileId` varchar(100) NULL,
  ADD COLUMN `agentPickedAt` timestamp NULL,
  ADD COLUMN `agentFinishedAt` timestamp NULL,
  ADD COLUMN `agentErrorType` varchar(50) NULL,
  ADD COLUMN `agentErrorMessage` text NULL,
  ADD COLUMN `agentLog` json NULL,
  ADD COLUMN `draftUrl` varchar(500) NULL,
  ADD COLUMN `publishedUrl` varchar(500) NULL;

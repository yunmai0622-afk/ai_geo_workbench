ALTER TABLE `project_platform_accounts`
  ADD COLUMN `localAgentId` varchar(100) NULL,
  ADD COLUMN `localProfileId` varchar(100) NULL,
  ADD COLUMN `sessionStatus` varchar(30) NULL,
  ADD COLUMN `lastSessionCheckedAt` timestamp NULL,
  ADD COLUMN `lastLoginAt` timestamp NULL;

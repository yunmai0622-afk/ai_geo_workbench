-- P2: 同平台多账号 — 唯一约束改为 (projectId, platform, accountName)
DROP INDEX `project_platform_accounts_project_platform` ON `project_platform_accounts`;
--> statement-breakpoint
CREATE UNIQUE INDEX `project_platform_accounts_project_platform_name` ON `project_platform_accounts` (`projectId`,`platform`,`accountName`);

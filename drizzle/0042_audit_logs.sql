-- GEO-V1.1-Audit-Log: 关键操作审计日志
CREATE TABLE `audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `projectId` int,
  `action` varchar(64) NOT NULL,
  `detail` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user_id` ON `audit_logs` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_project_id` ON `audit_logs` (`projectId`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (`action`);

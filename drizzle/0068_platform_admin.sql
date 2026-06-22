-- GEO-V2.1-P0-Platform-Admin: 平台运营后台数据模型
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `companyId` int NULL,
  ADD COLUMN IF NOT EXISTS `userStatus` enum('pending_review','active','rejected','disabled') NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS `customerRole` enum('customer_admin','customer_member') NULL,
  ADD COLUMN IF NOT EXISTS `applicationNote` text NULL,
  ADD COLUMN IF NOT EXISTS `reviewedAt` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `reviewedBy` int NULL;

CREATE TABLE IF NOT EXISTS `customer_companies` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyName` varchar(255) NOT NULL,
  `contactName` varchar(120) NULL,
  `contactPhone` varchar(64) NULL,
  `contactEmail` varchar(320) NULL,
  `industry` varchar(255) NULL,
  `sourceChannel` varchar(120) NULL,
  `status` enum('pending','active','rejected','disabled') NOT NULL DEFAULT 'pending',
  `notes` text NULL,
  `approvedAt` timestamp NULL,
  `approvedBy` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `customer_companies_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `company_subscriptions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `planType` enum('trial','basic','pro','agency','custom') NOT NULL,
  `planName` varchar(120) NOT NULL,
  `status` enum('trial','active','expired','paused','cancelled') NOT NULL DEFAULT 'trial',
  `startedAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NULL,
  `maxProjects` int NOT NULL DEFAULT 1,
  `monthlyAiTests` int NOT NULL DEFAULT 10,
  `monthlyContentTasks` int NOT NULL DEFAULT 20,
  `monthlyReports` int NOT NULL DEFAULT 1,
  `maxTeamMembers` int NOT NULL DEFAULT 5,
  `enabledFeatures` json NOT NULL,
  `notes` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `company_subscriptions_id` PRIMARY KEY(`id`),
  CONSTRAINT `company_subscriptions_company_unique` UNIQUE(`companyId`)
);

CREATE TABLE IF NOT EXISTS `company_projects` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `projectId` int NOT NULL,
  `projectName` varchar(255) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `company_projects_id` PRIMARY KEY(`id`),
  CONSTRAINT `company_projects_project_unique` UNIQUE(`projectId`)
);

CREATE INDEX IF NOT EXISTS `company_projects_company_idx` ON `company_projects` (`companyId`);

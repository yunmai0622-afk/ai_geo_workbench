-- P1-B: 内容策略字段与平台账号组
ALTER TABLE `geo_articles` ADD COLUMN `contentStrategyType` varchar(50) NULL;
ALTER TABLE `geo_articles` ADD COLUMN `publishIdentity` varchar(50) NULL;
ALTER TABLE `geo_articles` ADD COLUMN `recommendedAccountGroup` varchar(50) NULL;
ALTER TABLE `project_platform_accounts` ADD COLUMN `accountGroup` varchar(50) NULL;
ALTER TABLE `project_platform_accounts` ADD COLUMN `accountRole` varchar(50) NULL;

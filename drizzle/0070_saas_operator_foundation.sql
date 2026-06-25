-- GEO-V2.3-P0: 代运营注册与客户创建数据隔离
ALTER TABLE `users`
  MODIFY COLUMN `role` enum('user','admin','operator') NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS `operatorCompanyName` varchar(255) NULL;

ALTER TABLE `customer_companies`
  ADD COLUMN IF NOT EXISTS `ownerUserId` int NULL;

CREATE INDEX IF NOT EXISTS `customer_companies_owner_user_idx` ON `customer_companies` (`ownerUserId`);

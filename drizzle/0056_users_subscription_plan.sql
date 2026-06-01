-- GEO-V1.1-AdminBypass: 用户订阅套餐档位（管理员可手动升级）
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `subscriptionPlanId` enum('basic','professional','enterprise') NOT NULL DEFAULT 'basic';

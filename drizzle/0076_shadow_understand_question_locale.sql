ALTER TABLE `understanding_question_versions`
  ADD COLUMN `locale` varchar(32) NOT NULL DEFAULT 'zh-CN' AFTER `purchaseIntent`;

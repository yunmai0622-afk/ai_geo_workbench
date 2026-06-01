-- GEO-V1.1-Content-Gap-Link: 内容关联检测轮次问题
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `targetQuestionId` varchar(36),
  ADD COLUMN IF NOT EXISTS `targetGapType` varchar(64);

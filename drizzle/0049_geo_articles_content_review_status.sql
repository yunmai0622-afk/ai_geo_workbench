-- GEO-V1.1-Content-Review-Status: 内容卡片人工审核状态
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `contentReviewStatus` varchar(32) NOT NULL DEFAULT '待审核';

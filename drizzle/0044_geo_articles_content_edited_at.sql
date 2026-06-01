-- GEO-V1.1-Content-Version: 用户编辑保存内容的最后修改时间
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `contentEditedAt` timestamp NULL;

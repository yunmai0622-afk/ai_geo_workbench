-- GEO-V1.1-Content-Tags: 内容自定义标签（JSON 字符串数组）
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `contentTags` json NULL;

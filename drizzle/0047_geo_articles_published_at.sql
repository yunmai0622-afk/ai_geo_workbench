-- GEO-V1.1-Post-Publish-QC: 记录内容首次/最近发布时间
ALTER TABLE `geo_articles`
  ADD COLUMN IF NOT EXISTS `publishedAt` timestamp NULL;

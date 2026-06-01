-- 文章状态枚举增加「需人工审核」（与 drizzle/schema.ts articleStatusEnum 对齐）
ALTER TABLE `geo_articles` MODIFY COLUMN `status` ENUM(
  '待生成',
  '已生成',
  '待质检',
  '质检通过',
  '待审核',
  '审核通过',
  '已发布',
  '待复测',
  '质检未通过',
  '需人工审核',
  '审核未通过'
) NOT NULL DEFAULT '待质检';

ALTER TABLE `geo_article_topics` MODIFY COLUMN `status` ENUM(
  '待生成',
  '已生成',
  '待质检',
  '质检通过',
  '待审核',
  '审核通过',
  '已发布',
  '待复测',
  '质检未通过',
  '需人工审核',
  '审核未通过'
) NOT NULL DEFAULT '待生成';

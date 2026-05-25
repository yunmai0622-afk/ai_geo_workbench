-- GEO-P0-C：复测队列与重写池（幂等建表）
CREATE TABLE IF NOT EXISTS `geo_review_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `articleId` int NOT NULL,
  `projectId` int NOT NULL,
  `triggerStatus` varchar(32) NOT NULL,
  `reviewType` varchar(32) NOT NULL,
  `scheduledAt` timestamp NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `result` json NULL,
  `publishTaskId` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_review_queue_project_status` (`projectId`, `status`),
  KEY `idx_review_queue_article` (`articleId`)
);

CREATE TABLE IF NOT EXISTS `geo_rewrite_pool` (
  `id` int NOT NULL AUTO_INCREMENT,
  `articleId` int NOT NULL,
  `projectId` int NOT NULL,
  `triggerStatus` varchar(32) NOT NULL,
  `source` varchar(64) NOT NULL,
  `reason` text NOT NULL,
  `publishTaskId` int NULL,
  `status` varchar(32) NOT NULL DEFAULT 'open',
  `suggestionText` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rewrite_pool_project_status` (`projectId`, `status`),
  KEY `idx_rewrite_pool_article` (`articleId`)
);

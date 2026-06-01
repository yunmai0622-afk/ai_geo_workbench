-- GEO-V1.1-System-Config: 全局系统配置（单行）
CREATE TABLE `geo_system_config` (
  `id` int NOT NULL DEFAULT 1,
  `contentGenerationPerMinuteLimit` int NOT NULL,
  `t0DetectionPerHourLimit` int NOT NULL,
  `qualityMinPassScore` int NOT NULL,
  `defaultPublishPlatforms` json NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `updatedByUserId` int,
  CONSTRAINT `geo_system_config_id` PRIMARY KEY(`id`)
);

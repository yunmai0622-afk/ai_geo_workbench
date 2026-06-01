-- GEO-V1.1-Project-Archive: 项目归档时间（NULL = 活跃）
ALTER TABLE `projects` ADD COLUMN `archivedAt` timestamp NULL;
CREATE INDEX `idx_projects_archived_at` ON `projects` (`archivedAt`);

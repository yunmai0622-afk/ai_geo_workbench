-- GEO-V1-H: projects.ownerUserId（P0 租户隔离）
-- 回填请运行: node scripts/ensure_project_owner_user_id.mjs
-- 确认无 NULL 后再执行下方 NOT NULL（ensure 脚本可代为执行）

ALTER TABLE `projects` ADD COLUMN `ownerUserId` int NULL;
CREATE INDEX `idx_projects_owner_user_id` ON `projects` (`ownerUserId`);

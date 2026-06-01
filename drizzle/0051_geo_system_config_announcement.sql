-- GEO-V1.1-System-Announcement: 系统公告（geo_system_config 单行扩展）
ALTER TABLE `geo_system_config`
  ADD COLUMN `systemAnnouncementEnabled` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN `systemAnnouncementBody` text,
  ADD COLUMN `systemAnnouncementUpdatedAt` timestamp NULL;

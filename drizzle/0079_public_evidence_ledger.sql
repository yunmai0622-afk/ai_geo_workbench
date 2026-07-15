CREATE TABLE IF NOT EXISTS `trust_evidence_sources` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `sourceUrl` varchar(2000) NOT NULL, `sourceOwner` varchar(255),
  `ownership` enum('owned','third_party') NOT NULL, `independentSource` boolean NOT NULL DEFAULT false,
  `accessStatus` enum('accessible','inaccessible','redirected','blocked','unknown') NOT NULL DEFAULT 'unknown',
  `firstCheckedAt` timestamp, `lastCheckedAt` timestamp, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `trust_evidence_sources_id_project_unique` (`id`,`projectId`), UNIQUE KEY `trust_evidence_sources_project_url_unique` (`projectId`,`sourceUrl`),
  CONSTRAINT `trust_evidence_sources_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trust_source_snapshots` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `sourceId` varchar(36) NOT NULL, `snapshotVersion` int NOT NULL, `sourceUrlSnapshot` varchar(2000) NOT NULL,
  `statusCode` int, `accessedAt` timestamp NOT NULL, `contentHash` varchar(128), `titleSnapshot` varchar(500), `ownerSnapshot` varchar(255), `canonicalUrl` varchar(2000), `redirectUrl` varchar(2000),
  `robotsStatus` enum('allowed','disallowed','unknown','not_checked') NOT NULL DEFAULT 'not_checked', `publicationTime` timestamp, `updatedTime` timestamp, `contentExcerpt` text, `metadata` json, `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`), UNIQUE KEY `trust_source_snapshots_id_project_unique` (`id`,`projectId`), UNIQUE KEY `trust_source_snapshots_source_version_unique` (`sourceId`,`snapshotVersion`),
  CONSTRAINT `trust_source_snapshots_source_project_fk` FOREIGN KEY (`sourceId`,`projectId`) REFERENCES `trust_evidence_sources` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trust_evidence_ledger_items` (
  `id` varchar(36) NOT NULL, `evidenceId` varchar(64) NOT NULL, `projectId` int NOT NULL, `sourceId` varchar(36) NOT NULL, `latestSnapshotId` varchar(36),
  `evidenceType` enum('official_homepage','brand_definition','product_page','faq','help_center','team','company','organization_schema','brand_schema','product_schema','media','industry_platform','customer_case','partner','certification','industry_report','github','zhihu','wechat_official_account','interview','video','product_screenshot','service_process','verifiable_data','customer_review','demo') NOT NULL,
  `reviewStatus` enum('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified', `confidence` int, `archivedAt` timestamp, `createdAt` timestamp NOT NULL DEFAULT (now()), `createdBy` int,
  PRIMARY KEY (`id`), UNIQUE KEY `trust_evidence_ledger_items_id_project_unique` (`id`,`projectId`), UNIQUE KEY `trust_evidence_ledger_items_project_evidence_unique` (`projectId`,`evidenceId`),
  CONSTRAINT `trust_evidence_items_source_project_fk` FOREIGN KEY (`sourceId`,`projectId`) REFERENCES `trust_evidence_sources` (`id`,`projectId`),
  CONSTRAINT `trust_evidence_items_snapshot_project_fk` FOREIGN KEY (`latestSnapshotId`,`projectId`) REFERENCES `trust_source_snapshots` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trust_evidence_fact_links` (
  `id` int AUTO_INCREMENT NOT NULL, `projectId` int NOT NULL, `evidenceItemId` varchar(36) NOT NULL, `factId` int NOT NULL,
  `relationship` enum('supports','contradicts','context_only') NOT NULL DEFAULT 'supports', `createdAt` timestamp NOT NULL DEFAULT (now()), PRIMARY KEY (`id`),
  UNIQUE KEY `trust_evidence_fact_links_unique` (`evidenceItemId`,`factId`,`relationship`),
  CONSTRAINT `trust_evidence_fact_links_item_project_fk` FOREIGN KEY (`evidenceItemId`,`projectId`) REFERENCES `trust_evidence_ledger_items` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trust_evidence_question_links` (
  `id` int AUTO_INCREMENT NOT NULL, `projectId` int NOT NULL, `evidenceItemId` varchar(36) NOT NULL, `questionVersionId` varchar(36) NOT NULL,
  `relationship` enum('primary','supporting','context_only') NOT NULL DEFAULT 'supporting', `createdAt` timestamp NOT NULL DEFAULT (now()), PRIMARY KEY (`id`),
  UNIQUE KEY `trust_evidence_question_links_unique` (`evidenceItemId`,`questionVersionId`),
  CONSTRAINT `trust_evidence_question_links_item_project_fk` FOREIGN KEY (`evidenceItemId`,`projectId`) REFERENCES `trust_evidence_ledger_items` (`id`,`projectId`),
  CONSTRAINT `trust_evidence_question_links_question_project_fk` FOREIGN KEY (`questionVersionId`,`projectId`) REFERENCES `understanding_question_versions` (`id`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trust_evidence_quality_checks` (
  `id` varchar(36) NOT NULL, `projectId` int NOT NULL, `evidenceItemId` varchar(36) NOT NULL, `snapshotId` varchar(36) NOT NULL,
  `accessibility` enum('pass','warning','fail','unknown') NOT NULL, `authority` enum('pass','warning','fail','unknown') NOT NULL,
  `independence` enum('pass','warning','fail','unknown') NOT NULL, `consistency` enum('pass','warning','fail','unknown') NOT NULL,
  `freshness` enum('pass','warning','fail','unknown') NOT NULL, `relevance` enum('pass','warning','fail','unknown') NOT NULL,
  `details` json, `checkedAt` timestamp NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), PRIMARY KEY (`id`),
  UNIQUE KEY `trust_evidence_quality_item_snapshot_unique` (`evidenceItemId`,`snapshotId`),
  CONSTRAINT `trust_evidence_quality_item_project_fk` FOREIGN KEY (`evidenceItemId`,`projectId`) REFERENCES `trust_evidence_ledger_items` (`id`,`projectId`),
  CONSTRAINT `trust_evidence_quality_snapshot_project_fk` FOREIGN KEY (`snapshotId`,`projectId`) REFERENCES `trust_source_snapshots` (`id`,`projectId`)
);

CREATE TABLE `delivery_report_share_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `token` varchar(64) NOT NULL,
  `projectId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp,
  `isEnabled` boolean NOT NULL DEFAULT true,
  CONSTRAINT `delivery_report_share_tokens_id` PRIMARY KEY(`id`),
  CONSTRAINT `delivery_report_share_tokens_token_unique` UNIQUE(`token`)
);

ALTER TABLE `users` ADD `extensionApiKey` varchar(100);

--> statement-breakpoint

CREATE TABLE `publish_tasks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `projectId` int NOT NULL,
  `articleId` int NOT NULL,
  `platform` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `articleTitle` text NOT NULL,
  `articleContent` text NOT NULL,
  `resultUrl` varchar(500),
  `errorMessage` text,
  `apiKey` varchar(100),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `publish_tasks_id` PRIMARY KEY(`id`)
);

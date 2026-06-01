ALTER TABLE `geo_publish_records` MODIFY COLUMN `publishChannel` enum('系统内置 GEO 内容页','自有内容站 / 企业官网 GEO 页面','微信公众号','知乎','百家号','头条号','小红书','搜狐号','网易号','CSDN / 掘金') NOT NULL;

--> statement-breakpoint

ALTER TABLE `geo_publish_records` ADD `publishTitle` varchar(500);

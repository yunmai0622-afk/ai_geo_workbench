ALTER TABLE `geo_inclusion_monitoring_records`
  ADD COLUMN `aiTestResults` json,
  ADD COLUMN `lastAiTestedAt` timestamp;

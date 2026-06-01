-- P2-B-Verify-Fix: 补齐收录监测 AI 实测字段（幂等：已存在时请用 ensure 脚本跳过）
ALTER TABLE `geo_inclusion_monitoring_records`
  ADD COLUMN `aiTestResults` json,
  ADD COLUMN `lastAiTestedAt` timestamp;

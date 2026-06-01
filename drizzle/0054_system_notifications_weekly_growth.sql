-- GEO-V1.1-Weekly-Growth-Report: 系统通知类型扩展
ALTER TABLE `system_notifications`
  MODIFY `type` enum(
    't0_complete',
    'publish_success',
    'publish_failed',
    't1_retest_complete',
    'weekly_growth_report'
  ) NOT NULL;

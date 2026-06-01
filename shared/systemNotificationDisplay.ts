export const SYSTEM_NOTIFICATION_TYPES = ["t0_complete","publish_success","publish_failed","t1_retest_complete"] as const;
export type SystemNotificationType = (typeof SYSTEM_NOTIFICATION_TYPES)[number];
export const SYSTEM_NOTIFICATION_TYPE_LABELS: Record<SystemNotificationType, string> = {
  t0_complete: "T0 检测完成",
  publish_success: "内容发布成功",
  publish_failed: "发布失败",
  t1_retest_complete: "T1 复测完成",
};
export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;
export function formatNotificationTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

/** 写入 audit_logs.action 的固定取值 */
export const AUDIT_LOG_ACTIONS = {
  userLogin: "user.login",
  userLogout: "user.logout",
  projectCreate: "project.create",
  t0Start: "t0.start",
  contentPublish: "content.publish",
  deliveryReportGenerate: "delivery_report.generate",
} as const;

export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[keyof typeof AUDIT_LOG_ACTIONS];

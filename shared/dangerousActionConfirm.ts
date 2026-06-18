/** 危险操作二次确认：操作名称（用于弹窗文案） */
export const DANGEROUS_ACTION_LABELS = {
  deleteContent: "删除内容",
  archiveProject: "归档项目",
  resetT0Detection: "重置优化前检测",
} as const;

export type DangerousActionLabelKey = keyof typeof DANGEROUS_ACTION_LABELS;

export function buildDangerousActionConfirmMessage(operationName: string): string {
  return `确认要${operationName}吗？此操作无法撤销。`;
}

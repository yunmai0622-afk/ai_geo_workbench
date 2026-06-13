/** 工作台风险提醒：质检未通过内容（原「重写池」对客户化表述） */
export function buildQualityRewriteRiskHint(count: number): string {
  return `有 ${count} 篇内容质检未通过，建议重新生成`;
}

export const WEEKLY_PENDING_CONTENT_TAB_NEEDS_MODIFY = "needs_modify" as const;

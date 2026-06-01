export type PublishLinkAccessSnapshot = {
  accessible: boolean;
  checkedAt: string;
  statusCode?: number | null;
  errorMessage?: string | null;
};

/** 收录 / AI 监测状态：英文与历史值 → 客户可读中文 */
export const MONITOR_STATUS_LABEL_CN: Record<string, string> = {
  unchecked: "未检测",
  checking: "检测中",
  included: "已收录",
  not_included: "未收录",
  ai_tested: "AI已实测",
  failed: "检测失败",
  check_failed: "检测失败",
  mentioned: "已提及",
  not_mentioned: "未提及",
  recommended: "已推荐",
  not_recommended: "未推荐",
  未检测: "未检测",
  检测中: "检测中",
  已收录: "已收录",
  未收录: "未收录",
  检测失败: "检测失败",
  已提及: "已提及",
  未提及: "未提及",
  已推荐: "已推荐",
  未推荐: "未推荐",
};

export function monitorStatusLabelCn(status: string | null | undefined): string {
  const raw = (status ?? "").trim();
  if (!raw) return "未检测";
  const mapped = MONITOR_STATUS_LABEL_CN[raw] ?? MONITOR_STATUS_LABEL_CN[raw.toLowerCase()];
  return mapped ?? raw;
}

export function isMonitoringAiTested(input: {
  lastAiTestedAt?: Date | string | null;
  aiTestResults?: unknown[] | null;
}): boolean {
  if (input.lastAiTestedAt) return true;
  return Array.isArray(input.aiTestResults) && input.aiTestResults.length > 0;
}

/** 每条监测记录的下一步建议操作（客户语言） */
export function buildMonitoringNextAction(input: {
  inclusionStatus?: string | null;
  lastAiTestedAt?: Date | string | null;
  aiTestResults?: unknown[] | null;
}): string {
  if (isMonitoringAiTested(input)) return "查看实测结果";
  const inclusion = monitorStatusLabelCn(input.inclusionStatus);
  if (inclusion === "未检测" || inclusion === "已收录") return "执行AI实测";
  if (!isMonitoringAiTested(input)) return "执行AI实测";
  return "查看实测结果";
}

export function parsePublishLinkAccess(rawJson: unknown): PublishLinkAccessSnapshot | null {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) return null;
  const linkAccess = (rawJson as Record<string, unknown>).linkAccess;
  if (!linkAccess || typeof linkAccess !== "object" || Array.isArray(linkAccess)) return null;
  const row = linkAccess as Record<string, unknown>;
  if (typeof row.accessible !== "boolean") return null;
  const checkedAt = typeof row.checkedAt === "string" ? row.checkedAt : null;
  if (!checkedAt) return null;
  return {
    accessible: row.accessible,
    checkedAt,
    statusCode: typeof row.statusCode === "number" ? row.statusCode : null,
    errorMessage: typeof row.errorMessage === "string" ? row.errorMessage : null,
  };
}

export function publishLinkAccessLabel(snapshot: PublishLinkAccessSnapshot | null | undefined): string {
  if (!snapshot) return "未检测";
  return snapshot.accessible ? "可公开访问" : "不可访问";
}

export function mergeLinkAccessIntoRawJson(
  rawJson: Record<string, unknown> | null | undefined,
  linkAccess: PublishLinkAccessSnapshot,
): Record<string, unknown> {
  return {
    ...(rawJson && typeof rawJson === "object" ? rawJson : {}),
    linkAccess,
  };
}

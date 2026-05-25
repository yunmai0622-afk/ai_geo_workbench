/**
 * GEO-P0-C：发布后复测队列与重写池（最小闭环）
 */

export const REVIEW_TYPES = [
  "link_check",
  "inclusion_check",
  "ai_test",
  "rewrite_review",
] as const;

export type ReviewType = (typeof REVIEW_TYPES)[number];

export const REVIEW_QUEUE_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

export type ReviewQueueStatus = (typeof REVIEW_QUEUE_STATUSES)[number];

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  link_check: "链接与草稿复核",
  inclusion_check: "收录复测",
  ai_test: "AI 提及复测",
  rewrite_review: "人工确认后复测",
};

export const REVIEW_QUEUE_STATUS_LABELS: Record<ReviewQueueStatus, string> = {
  pending: "待复测",
  in_progress: "复测进行中",
  completed: "已完成",
  cancelled: "已取消",
};

/** manual_required 超过该小时未处理 → 可进入重写池（仅记录，无定时任务） */
export const MANUAL_REQUIRED_STALE_HOURS = 72;

export type ReviewQueueResult = {
  note?: string;
  checkedAt?: string;
  /** 禁止 mock：不得写入 indexed / ai_cited 等假成功字段 */
  outcome?: "pending_manual" | "needs_followup" | "passed" | "failed";
};

export const REWRITE_POOL_SOURCES = [
  "quality_reject",
  "geo_quality_reject",
  "publish_failed",
  "session_expired",
  "manual_required_stale",
  "ai_test_no_brand",
  "inclusion_failed",
  "quality_check_fail",
] as const;

export type RewritePoolSource = (typeof REWRITE_POOL_SOURCES)[number];

export const REWRITE_POOL_STATUSES = ["open", "resolved"] as const;

export type RewritePoolStatus = (typeof REWRITE_POOL_STATUSES)[number];

export function isReviewType(value: string): value is ReviewType {
  return (REVIEW_TYPES as readonly string[]).includes(value);
}

export function reviewTypeForTriggerStatus(triggerStatus: string): ReviewType {
  switch (triggerStatus) {
    case "manual_required":
      return "rewrite_review";
    case "draft_saved":
      return "link_check";
    case "published":
      return "inclusion_check";
    default:
      return "rewrite_review";
  }
}

export function defaultScheduledAt(hoursFromNow = 24): Date {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000);
}

/** 检测结果 JSON 不得包含 mock 成功标记 */
export function assertNoMockReviewResult(result: unknown): void {
  if (!result || typeof result !== "object") return;
  const o = result as Record<string, unknown>;
  const forbidden = ["indexed", "ai_cited", "mock_indexed", "mock_ai_cited"];
  for (const key of forbidden) {
    if (key in o && o[key] === true) {
      throw new Error(`禁止 mock 复测结果字段: ${key}`);
    }
  }
}

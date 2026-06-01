/** GEO-V1.1-Content-Review-Status：内容卡片人工审核状态 */

export const CONTENT_REVIEW_STATUSES = ["待审核", "已审核可发布", "需要修改"] as const;

export type ContentReviewStatus = (typeof CONTENT_REVIEW_STATUSES)[number];

export const DEFAULT_CONTENT_REVIEW_STATUS: ContentReviewStatus = "待审核";

export const CONTENT_REVIEW_PENDING_ENQUEUE_HINT =
  "该内容尚未标记为「已审核可发布」，确认后可继续加入发布队列。";

export function normalizeContentReviewStatus(value: unknown): ContentReviewStatus {
  if (typeof value === "string" && (CONTENT_REVIEW_STATUSES as readonly string[]).includes(value)) {
    return value as ContentReviewStatus;
  }
  return DEFAULT_CONTENT_REVIEW_STATUS;
}

export function isContentReviewPending(value: unknown): boolean {
  return normalizeContentReviewStatus(value) === DEFAULT_CONTENT_REVIEW_STATUS;
}

export function contentReviewStatusBadgeClass(status: ContentReviewStatus): string {
  switch (status) {
    case "已审核可发布":
      return "bg-emerald-100 text-emerald-800";
    case "需要修改":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

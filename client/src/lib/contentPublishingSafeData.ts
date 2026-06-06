/** 发布页 API 数组字段安全标准化，避免 null/非数组导致渲染崩溃 */

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export type PublishQueueTabKey = "pending" | "active" | "failed" | "completed";

export const PUBLISH_QUEUE_EMPTY_LABELS: Record<PublishQueueTabKey, string> = {
  pending: "暂无待发布任务",
  active: "暂无发布中任务",
  failed: "暂无失败任务",
  completed: "暂无已完成任务",
};

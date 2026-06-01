/** 同文章 + 同平台禁止重复加入发布队列（GEO-V1.1-Content-Dedup） */

export const PUBLISH_QUEUE_DUPLICATE_MESSAGE = "该内容已在发布队列中";

/** 已有这些状态的任务时，publishTasks.create 应拒绝（failed 可走重试，不阻断新建） */
export const PUBLISH_QUEUE_BLOCKING_STATUSES = [
  "pending",
  "pending_agent",
  "pending_publish",
  "copied",
  "agent_processing",
  "processing",
  "session_expired",
  "manual_required",
  "draft_saved",
  "completed",
] as const;

export type PublishQueueBlockingStatus = (typeof PUBLISH_QUEUE_BLOCKING_STATUSES)[number];

export function isPublishQueueBlockingStatus(status: string): boolean {
  return (PUBLISH_QUEUE_BLOCKING_STATUSES as readonly string[]).includes(status);
}

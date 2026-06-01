/** 同文章 + 同平台 + 同发布账号禁止重复加入发布队列（GEO-V1.1-Content-Dedup / AgentTaskFix） */

export const PUBLISH_QUEUE_DUPLICATE_MESSAGE =
  "该内容已在发布队列中（同一篇文章、同一平台、同一账号仅允许一条任务）";

export const PUBLISH_QUEUE_DUPLICATE_RETRY_MESSAGE =
  "该内容已有失败的发布任务，请在 GEO Web 发布中心对该任务点击「重试」，勿重复加入队列";

/** 已有这些状态的任务时，publishTasks.create 应拒绝（失败任务请走 publishTasks.retry） */
export const PUBLISH_QUEUE_BLOCKING_STATUSES = [
  "pending",
  "pending_agent",
  "pending_publish",
  "copied",
  "agent_processing",
  "processing",
  "failed",
  "session_expired",
  "manual_required",
  "draft_saved",
  "completed",
] as const;

export type PublishQueueDedupKey = {
  articleId: number;
  platform: string;
  platformAccountId: number;
};

export function publishQueueDedupKey(input: PublishQueueDedupKey): string {
  return `${input.articleId}:${input.platform}:${input.platformAccountId}`;
}

export type PublishQueueBlockingStatus = (typeof PUBLISH_QUEUE_BLOCKING_STATUSES)[number];

export function isPublishQueueBlockingStatus(status: string): boolean {
  return (PUBLISH_QUEUE_BLOCKING_STATUSES as readonly string[]).includes(status);
}

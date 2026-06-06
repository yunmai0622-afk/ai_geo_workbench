/** 发布页 API 数组字段安全标准化，避免 null/非数组导致渲染崩溃 */

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export type PublishQueueTabKey =
  | "pending"
  | "active"
  | "needs_attention"
  | "failed"
  | "completed";

export const PUBLISH_QUEUE_EMPTY_HINTS: Record<
  PublishQueueTabKey,
  { title: string; reason: string; nextStep: string }
> = {
  pending: {
    title: "暂无待发布任务",
    reason: "当前项目还没有加入发布队列的内容。",
    nextStep: "去平台化内容资产页选择内容并加入发布队列。",
  },
  active: {
    title: "暂无发布中任务",
    reason: "当前没有正在由本地客户端处理的任务。",
    nextStep: "将待发布任务发送到客户端后开始处理。",
  },
  needs_attention: {
    title: "暂无需要处理的任务",
    reason: "当前没有待人工确认或待同步账号的任务。",
    nextStep: "继续处理待发布队列或刷新账号状态。",
  },
  failed: {
    title: "暂无失败任务",
    reason: "当前没有发布失败或需重试的任务。",
    nextStep: "保持客户端连接并处理待发布任务。",
  },
  completed: {
    title: "暂无已完成任务",
    reason: "当前还没有完成发布的任务记录。",
    nextStep: "完成发布后在此回填公开链接。",
  },
};

export const PUBLISH_QUEUE_EMPTY_LABELS: Record<PublishQueueTabKey, string> = {
  pending: PUBLISH_QUEUE_EMPTY_HINTS.pending.title,
  active: PUBLISH_QUEUE_EMPTY_HINTS.active.title,
  needs_attention: PUBLISH_QUEUE_EMPTY_HINTS.needs_attention.title,
  failed: PUBLISH_QUEUE_EMPTY_HINTS.failed.title,
  completed: PUBLISH_QUEUE_EMPTY_HINTS.completed.title,
};

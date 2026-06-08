import type { PublishTaskCardModel } from "@/lib/publishCenterDisplay";
import type { PublishQueueTabKey } from "@/lib/contentPublishingSafeData";
import type { PublishExecutionTabKey } from "@/components/publishing/PublishTaskQueueTable";

export const PUBLISH_EXECUTION_TABS: Array<{
  key: PublishExecutionTabKey;
  label: string;
  testId: string;
}> = [
  { key: "pending", label: "待发布", testId: "publish-queue-tab-pending" },
  { key: "active", label: "发布中", testId: "publish-queue-tab-active" },
  { key: "failed", label: "失败", testId: "publish-queue-tab-failed" },
  { key: "published", label: "已发布", testId: "publish-queue-tab-published" },
  { key: "waiting_links", label: "待回填链接", testId: "publish-queue-tab-waiting-links" },
];

export const PUBLISH_EXECUTION_EMPTY_HINTS: Record<
  PublishExecutionTabKey,
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
  failed: {
    title: "暂无失败任务",
    reason: "当前没有发布失败或需人工处理的任务。",
    nextStep: "保持客户端连接并处理待发布任务。",
  },
  published: {
    title: "暂无已发布任务",
    reason: "当前还没有完成发布并回填链接的任务。",
    nextStep: "完成发布后在此查看已发布记录。",
  },
  waiting_links: {
    title: "暂无待回填链接",
    reason: "当前没有已发布但缺少公开链接的任务。",
    nextStep: "发布完成后回填公开链接以进入收录监测。",
  },
};

export function cardsForExecutionTab(
  key: PublishExecutionTabKey,
  queueTabs: Record<PublishQueueTabKey, PublishTaskCardModel[]>,
): PublishTaskCardModel[] {
  switch (key) {
    case "pending":
      return queueTabs.pending;
    case "active":
      return queueTabs.active;
    case "failed":
      return [...queueTabs.failed, ...queueTabs.needs_attention];
    case "published":
      return queueTabs.completed.filter(card => Boolean(card.publishedUrl?.trim()));
    case "waiting_links":
      return queueTabs.completed.filter(card => !card.publishedUrl?.trim());
    default:
      return [];
  }
}

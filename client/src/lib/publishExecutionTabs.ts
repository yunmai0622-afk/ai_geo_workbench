import type { PublishTaskCardModel } from "@/lib/publishCenterDisplay";
import { publishPlatformCustomerLabel } from "@/lib/publishCenterDisplay";
import type { PublishQueueTabKey } from "@/lib/contentPublishingSafeData";
import type { PublishExecutionTabKey } from "@/components/publishing/PublishTaskQueueTable";
import { publishTaskStatusCustomerLabel } from "@shared/publishTaskErrors";

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
    reason: "当前没有待发布任务。你可以继续生成新内容，或查看已发布内容的收录状态。",
    nextStep: "",
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

export function resolveDefaultPublishExecutionTab(input: {
  publishedCount: number;
  waitingLinksCount: number;
  hasActiveSuccessNotice?: boolean;
}): PublishExecutionTabKey {
  if (input.hasActiveSuccessNotice || input.publishedCount > 0) return "published";
  if (input.waitingLinksCount > 0) return "waiting_links";
  return "pending";
}

function parsePublishTimestamp(value: Date | string | number | null | undefined): number {
  if (value == null) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export type RecentPublishSidebarInput = {
  agentTasks: Array<{
    articleId: number;
    status: string;
    platform: string;
    resultUrl?: string | null;
    publishedUrl?: string | null;
    agentFinishedAt?: Date | string | number | null;
    createdAt?: Date | string | number | null;
  }>;
  publishRecords: Array<{
    articleId?: number | null;
    publishChannel?: string | null;
    publishStatus?: string | null;
    publishUrl?: string | null;
    publicUrl?: string | null;
    publishedAt?: Date | string | number | null;
  }>;
  autoInclusionByArticleAndUrl?: Set<string>;
};

export function resolveRecentPublishSidebarSummary(
  input: RecentPublishSidebarInput,
): { recentLabel: string; nextStepLabel: string } | null {
  type Candidate = {
    platformLabel: string;
    statusLabel: string;
    timestamp: number;
    hasPublicLink: boolean;
    inInclusionMonitoring: boolean;
  };

  const candidates: Candidate[] = [];

  for (const task of input.agentTasks) {
    if (task.status !== "completed") continue;
    const publishedUrl = task.resultUrl?.trim() || task.publishedUrl?.trim() || "";
    const hasPublicLink = Boolean(publishedUrl);
    const inInclusionMonitoring = Boolean(
      hasPublicLink &&
        input.autoInclusionByArticleAndUrl?.has(`${task.articleId}:${publishedUrl}`),
    );
    candidates.push({
      platformLabel: publishPlatformCustomerLabel(task.platform),
      statusLabel: publishTaskStatusCustomerLabel({ status: task.status }),
      timestamp: parsePublishTimestamp(task.agentFinishedAt ?? task.createdAt),
      hasPublicLink,
      inInclusionMonitoring,
    });
  }

  for (const record of input.publishRecords) {
    const link = record.publicUrl?.trim() || record.publishUrl?.trim() || "";
    const hasPublicLink = Boolean(link);
    const articleId = typeof record.articleId === "number" ? record.articleId : null;
    const inInclusionMonitoring = Boolean(
      articleId && link && input.autoInclusionByArticleAndUrl?.has(`${articleId}:${link}`),
    );
    const statusRaw = record.publishStatus?.trim() || "";
    const statusLabel = hasPublicLink
      ? statusRaw || "已发布"
      : "待回填链接";
    candidates.push({
      platformLabel: record.publishChannel?.trim() || "未标注平台",
      statusLabel,
      timestamp: parsePublishTimestamp(record.publishedAt),
      hasPublicLink,
      inInclusionMonitoring,
    });
  }

  if (candidates.length === 0) return null;

  const latest = candidates.sort((a, b) => b.timestamp - a.timestamp)[0]!;
  const nextStepLabel =
    latest.inInclusionMonitoring || (latest.hasPublicLink && latest.statusLabel === "已发布")
      ? "7天后复测"
      : "收录监测";

  return {
    recentLabel: `${latest.platformLabel} · ${latest.statusLabel}`,
    nextStepLabel,
  };
}

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

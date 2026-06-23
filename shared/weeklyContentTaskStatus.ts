import { getContentQualityGateStatus, type ContentQualityGateArticle } from "./contentQualityGate";

export const WEEKLY_CONTENT_TASK_STATUSES = [
  "UNGENERATED",
  "GENERATING",
  "DRAFT",
  "QUALITY_PENDING",
  "QUALITY_PASSED",
  "PUBLISH_READY",
  "QUEUED",
  "PUBLISHED",
  "NEEDS_REWRITE",
] as const;

export type WeeklyContentTaskStatus = (typeof WEEKLY_CONTENT_TASK_STATUSES)[number];

export const WEEKLY_CONTENT_TASK_STATUS_LABELS: Record<WeeklyContentTaskStatus, string> = {
  UNGENERATED: "待生成",
  GENERATING: "生成中",
  DRAFT: "已生成",
  QUALITY_PENDING: "待质检",
  QUALITY_PASSED: "质检通过",
  PUBLISH_READY: "可入队",
  QUEUED: "已入队",
  PUBLISHED: "已发布",
  NEEDS_REWRITE: "生成失败",
};

export const WEEKLY_CONTENT_TASK_STATUS_BADGE_CLASS: Record<WeeklyContentTaskStatus, string> = {
  UNGENERATED: "bg-gray-100 text-gray-600",
  GENERATING: "bg-blue-100 text-blue-800",
  DRAFT: "bg-amber-50 text-amber-800",
  QUALITY_PENDING: "bg-orange-100 text-orange-800",
  QUALITY_PASSED: "bg-sky-100 text-sky-800",
  PUBLISH_READY: "bg-emerald-100 text-emerald-800",
  QUEUED: "bg-violet-100 text-violet-800",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  NEEDS_REWRITE: "bg-red-100 text-red-800",
};

export function weeklyContentTaskStatusLabel(status: WeeklyContentTaskStatus): string {
  return WEEKLY_CONTENT_TASK_STATUS_LABELS[status];
}

export function resolveWeeklyPlatformContentStatus(input: {
  hasArticle: boolean;
  generating?: boolean;
  published?: boolean;
  queued?: boolean;
  publishReady?: boolean;
  article?: ContentQualityGateArticle | null;
  needsRewrite?: boolean;
}): WeeklyContentTaskStatus {
  if (input.generating) return "GENERATING";
  if (!input.hasArticle) return "UNGENERATED";
  if (input.needsRewrite) return "NEEDS_REWRITE";
  if (input.published) return "PUBLISHED";
  if (input.queued) return "QUEUED";
  if (input.publishReady) return "PUBLISH_READY";

  const gate = input.article ? getContentQualityGateStatus(input.article) : null;
  if (gate?.passed) return "QUALITY_PASSED";
  if (gate?.reason === "failed") return "NEEDS_REWRITE";
  if (gate?.reason === "missing") return "QUALITY_PENDING";

  return "DRAFT";
}

export type WeeklyContentTaskProgress = {
  generatedCount: number;
  publishReadyCount: number;
  pendingReviewCount: number;
  enqueueReadyCount: number;
  queuedCount: number;
  publishedCount: number;
};

export function formatWeeklyContentTaskProgress(progress: WeeklyContentTaskProgress): string {
  return `已生成 ${progress.generatedCount} 篇 / 可入队 ${progress.publishReadyCount} 篇 / 待质检 ${progress.pendingReviewCount} 篇 / 已入队 ${progress.queuedCount} 篇 / 已发布 ${progress.publishedCount} 篇`;
}

export function buildWeeklyContentTaskNextStep(input: {
  pendingReviewCount: number;
  publishReadyCount: number;
  generatedCount: number;
}): string {
  if (input.pendingReviewCount > 0) {
    return `有 ${input.pendingReviewCount} 篇内容待质检，建议先完成质检再加入发布队列。`;
  }
  if (input.publishReadyCount > 0) {
    return `有 ${input.publishReadyCount} 篇内容可入队，可加入发布队列。`;
  }
  if (input.generatedCount === 0) {
    return "先选择推荐平台生成第一批平台稿。";
  }
  return "优先完成已生成内容的质检，再继续生成其他平台。";
}

export type WeeklyContentAssistantStats = {
  pendingReviewCount: number;
  pendingEnqueueCount: number;
  missingCoverCount: number;
  unboundAccountPlatformCount: number;
};

export function buildWeeklyContentAssistantRiskReminders(
  stats: WeeklyContentAssistantStats,
): string[] {
  const risks: string[] = [];
  if (stats.pendingReviewCount > 0) {
    risks.push(`${stats.pendingReviewCount} 篇内容尚未完成人工审核`);
  }
  if (stats.missingCoverCount > 0) {
    risks.push(`${stats.missingCoverCount} 篇内容未配置封面`);
  }
  if (stats.unboundAccountPlatformCount > 0) {
    risks.push(`${stats.unboundAccountPlatformCount} 个平台未绑定有效发布账号`);
  }
  return risks;
}

export function buildWeeklyContentAssistantBlockers(input: {
  ungeneratedPlatformCount: number;
  qualityPendingCount: number;
  publishReadyCount: number;
}): string[] {
  const blockers: string[] = [];
  if (input.ungeneratedPlatformCount > 0) {
    blockers.push(`还有 ${input.ungeneratedPlatformCount} 个平台未生成内容`);
  }
  if (input.qualityPendingCount > 0) {
    blockers.push(`${input.qualityPendingCount} 篇内容待质检`);
  }
  return blockers;
}

export function buildWeeklyContentAssistantNextSteps(input: {
  nextUngeneratedPlatformLabel?: string | null;
  qualityPendingCount: number;
  publishReadyCount: number;
}): string[] {
  const steps: string[] = [];
  if (input.nextUngeneratedPlatformLabel) {
    steps.push(`生成${input.nextUngeneratedPlatformLabel}内容`);
  }
  if (input.qualityPendingCount > 0) {
    steps.push("完成待质检内容确认");
  }
  if (input.publishReadyCount > 0) {
    steps.push(`将 ${input.publishReadyCount} 篇可发布内容加入发布队列`);
  }
  if (steps.length === 0) {
    steps.push("按平台继续生成本轮内容");
  }
  return steps;
}

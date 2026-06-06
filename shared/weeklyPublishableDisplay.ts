import type { ArticleCoverSource } from "./articleCoverReadiness";
import { articleHasPublishableCover } from "./articleCoverReadiness";
import {
  getContentQualityGateStatus,
  type ContentQualityGateArticle,
} from "./contentQualityGate";
import { isContentReviewPending } from "./contentReviewStatus";
import { shouldBlockPublishForGeoQuality } from "./geoQualityStale";
import {
  PRE_PUBLISH_COVER_OPTIONAL_PLATFORMS,
  type PrePublishChecklistPlatform,
} from "./publishPrePublishChecklist";

export type WeeklyAiQcDisplayStatus = "未质检" | "通过" | "未通过";
export type WeeklyManualReviewDisplayStatus = "未审核" | "已审核";
export type WeeklyCoverDisplayStatus = "未配置" | "已配置" | "不需要";
export type WeeklyAccountDisplayStatus = "未绑定" | "有效" | "待同步";
export type WeeklyPublishDisplayStatus = "待审核" | "待入队" | "已入队" | "已发布" | "失败";

export type WeeklyEnqueueButtonKind =
  | "blocked_qc"
  | "review_and_enqueue"
  | "enqueue"
  | "queued"
  | "published"
  | "failed";

export function resolveWeeklyAiQcDisplayStatus(
  article: ContentQualityGateArticle,
): WeeklyAiQcDisplayStatus {
  if (shouldBlockPublishForGeoQuality(article)) return "未通过";
  const gate = getContentQualityGateStatus(article);
  if (gate.reason === "missing" || gate.reason === "unknown") return "未质检";
  if (gate.passed) return "通过";
  if (gate.reason === "failed") return "未通过";
  return "未质检";
}

export function resolveWeeklyManualReviewDisplayStatus(
  contentReviewStatus: unknown,
): WeeklyManualReviewDisplayStatus {
  return isContentReviewPending(contentReviewStatus) ? "未审核" : "已审核";
}

export function resolveWeeklyCoverDisplayStatus(
  article: ArticleCoverSource,
  platformSlug?: string | null,
): WeeklyCoverDisplayStatus {
  if (
    platformSlug &&
    PRE_PUBLISH_COVER_OPTIONAL_PLATFORMS.includes(platformSlug as PrePublishChecklistPlatform)
  ) {
    return "不需要";
  }
  return articleHasPublishableCover(article) ? "已配置" : "未配置";
}

export function resolveWeeklyAccountDisplayStatus(input: {
  publishPreflightReady?: boolean;
  publishBlockHint?: string | null;
  accountSyncPending?: boolean;
}): WeeklyAccountDisplayStatus {
  if (input.accountSyncPending) return "待同步";
  if (input.publishPreflightReady && !input.publishBlockHint) return "有效";
  if (input.publishBlockHint?.includes("昵称") || input.publishBlockHint?.includes("同步")) {
    return "待同步";
  }
  return "未绑定";
}

export function resolveWeeklyPublishDisplayStatus(input: {
  published?: boolean;
  queued?: boolean;
  queueFailed?: boolean;
  manualReviewPending?: boolean;
  publishPreflightReady?: boolean;
}): WeeklyPublishDisplayStatus {
  if (input.published) return "已发布";
  if (input.queueFailed) return "失败";
  if (input.queued) return "已入队";
  if (input.manualReviewPending) return "待审核";
  return "待入队";
}

export function resolveWeeklyEnqueueButtonKind(input: {
  published?: boolean;
  queued?: boolean;
  queueFailed?: boolean;
  aiQcStatus: WeeklyAiQcDisplayStatus;
  manualReviewPending: boolean;
  publishPreflightReady?: boolean;
}): WeeklyEnqueueButtonKind {
  if (input.published) return "published";
  if (input.queueFailed) return "failed";
  if (input.queued) return "queued";
  if (input.aiQcStatus === "未通过" || input.aiQcStatus === "未质检") return "blocked_qc";
  if (input.manualReviewPending && input.publishPreflightReady) return "review_and_enqueue";
  if (input.publishPreflightReady) return "enqueue";
  return "blocked_qc";
}

export function weeklyEnqueueButtonLabel(kind: WeeklyEnqueueButtonKind): string {
  switch (kind) {
    case "review_and_enqueue":
      return "审核并加入队列";
    case "enqueue":
      return "加入发布队列";
    case "queued":
      return "已入队";
    case "published":
      return "已发布";
    case "failed":
      return "发布失败";
    default:
      return "加入发布队列";
  }
}

import {
  isArticleLifecycleStatus,
  parseLifecycleEvents,
  resolveArticleLifecycleView,
  type ArticleLifecycleStatus,
} from "./articleLifecycle";
import type { GeoQualityRecommendation } from "./geoQualityReview";
import { isGeoQualityScoreStale } from "./geoQualityStale";

export type ContentQualityGateReason = "passed" | "failed" | "missing" | "unknown";

export type ContentQualityGateStatus = {
  passed: boolean;
  reason: ContentQualityGateReason;
  message: string;
};

export type ContentQualityGateArticle = {
  geoQualityScore?: number | null;
  geoQualityRecommendation?: string | null;
  geoQualityStale?: boolean | number | null;
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  status?: string | null;
};

const LIFECYCLE_QA_PASSED: ArticleLifecycleStatus[] = [
  "quality_checked",
  "confirmed",
  "pending_publish",
  "agent_processing",
  "manual_required",
  "draft_saved",
  "published",
];

const LIFECYCLE_QA_FAILED: ArticleLifecycleStatus[] = ["needs_revision", "failed"];

const LEGACY_PASSED_STATUSES = new Set(["质检通过", "审核通过", "待审核", "已发布", "待复测"]);
const LEGACY_FAILED_STATUSES = new Set(["质检未通过", "审核未通过", "需人工审核"]);

const MESSAGES = {
  passed: "",
  failed: "当前内容未通过发布前质检，请先修改并重新质检。",
  missing: "当前内容尚未进行发布前质检，建议先质检后发布。",
  unknown: "当前内容质检状态不明确，请刷新页面或重新质检。",
} as const;

function hasStructuredGeoQualityPass(article: ContentQualityGateArticle): boolean {
  if (article.geoQualityScore == null || !article.geoQualityRecommendation) return false;
  const rec = article.geoQualityRecommendation as GeoQualityRecommendation;
  return rec === "publish" || rec === "revise";
}

function hasLifecycleQualityPass(article: ContentQualityGateArticle): boolean {
  const view = resolveArticleLifecycleView(article);
  if (LIFECYCLE_QA_PASSED.includes(view.status)) return true;
  return parseLifecycleEvents(article.lifecycleEvents).some(
    ev =>
      ev.status === "quality_checked" &&
      (ev.source === "quality_check" ||
        ev.source === "geo_quality_review" ||
        /GEO\s*质检通过/i.test(ev.message ?? "")),
  );
}

function hasLegacyQualityPass(article: ContentQualityGateArticle): boolean {
  const legacy = (article.status ?? "").trim();
  return LEGACY_PASSED_STATUSES.has(legacy);
}

function hasLifecycleQualityFail(article: ContentQualityGateArticle): boolean {
  const view = resolveArticleLifecycleView(article);
  if (LIFECYCLE_QA_FAILED.includes(view.status)) return true;
  return parseLifecycleEvents(article.lifecycleEvents).some(
    ev => ev.status === "needs_revision" && ev.source === "quality_check",
  );
}

function hasLegacyQualityFail(article: ContentQualityGateArticle): boolean {
  const legacy = (article.status ?? "").trim();
  return LEGACY_FAILED_STATUSES.has(legacy);
}

export function getContentQualityGateStatus(article: ContentQualityGateArticle | null | undefined): ContentQualityGateStatus {
  if (!article) {
    return { passed: false, reason: "unknown", message: MESSAGES.unknown };
  }

  if (
    article.geoQualityRecommendation === "reject" &&
    article.geoQualityScore != null &&
    !isGeoQualityScoreStale(article)
  ) {
    return { passed: false, reason: "failed", message: MESSAGES.failed };
  }

  if (hasStructuredGeoQualityPass(article)) {
    return { passed: true, reason: "passed", message: MESSAGES.passed };
  }

  if (hasLifecycleQualityPass(article)) {
    return { passed: true, reason: "passed", message: MESSAGES.passed };
  }

  if (hasLegacyQualityPass(article)) {
    return { passed: true, reason: "passed", message: MESSAGES.passed };
  }

  if (hasLifecycleQualityFail(article)) {
    return { passed: false, reason: "failed", message: MESSAGES.failed };
  }

  if (hasLegacyQualityFail(article)) {
    return { passed: false, reason: "failed", message: MESSAGES.failed };
  }

  const lifecycleStatus = article.lifecycleStatus?.trim();
  if (
    !lifecycleStatus ||
    lifecycleStatus === "generated" ||
    (isArticleLifecycleStatus(lifecycleStatus) && lifecycleStatus === "generated")
  ) {
    return { passed: false, reason: "missing", message: MESSAGES.missing };
  }

  if (!article.geoQualityScore && !article.geoQualityRecommendation) {
    return { passed: false, reason: "missing", message: MESSAGES.missing };
  }

  return { passed: false, reason: "unknown", message: MESSAGES.unknown };
}

export function isContentQualityPassed(article: ContentQualityGateArticle | null | undefined): boolean {
  return getContentQualityGateStatus(article).passed;
}

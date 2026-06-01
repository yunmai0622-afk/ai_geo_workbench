import { buildCoverDataUrlFromStored } from "./articleCoverBase64";
import { articleMatchesContentTagFilter } from "./geoArticleContentTags";
import { isLegacyAiGeneratedCoverUrl } from "./articleCoverTemplate";
import { getContentAssetTypeLabel, inferContentStrategyFromArticleType } from "./contentStrategy";
import {
  GEO_ARTICLE_STATUS_DRAFT_LABEL,
  GEO_ARTICLE_STATUS_PUBLISHABLE_LABEL,
  GEO_ARTICLE_STATUS_PUBLISHED,
} from "./constants";

export type PublishRecordLinkRow = {
  articleId?: number | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
};

function recordPublicLink(record: PublishRecordLinkRow): string {
  return (record.publishUrl || record.publicUrl || "").trim();
}

export type ContentCardStatusFilter = "all" | "publishable" | "draft" | "published";
export type ContentCardStatus = "publishable" | "draft" | "published";
export type ContentCardQualitySort = "none" | "desc" | "asc";

export type WeeklyContentCardView = {
  id: number;
  title?: string | null;
  platformKey?: string | null;
  targetPlatform?: string | null;
  statusFilterKey: ContentCardStatus;
  qualityScore?: number | null;
  contentTags?: string[] | null;
};

export function resolveContentCardStatus(params: {
  published: boolean;
  publishable: boolean;
}): { label: string; filterKey: ContentCardStatus; tone: "neutral" | "info" | "success" | "warning" } {
  if (params.published) {
    return { label: GEO_ARTICLE_STATUS_PUBLISHED, filterKey: "published", tone: "success" };
  }
  if (params.publishable) {
    return { label: GEO_ARTICLE_STATUS_PUBLISHABLE_LABEL, filterKey: "publishable", tone: "info" };
  }
  return { label: GEO_ARTICLE_STATUS_DRAFT_LABEL, filterKey: "draft", tone: "warning" };
}

export function resolveContentTypeLabel(article: {
  contentStrategyType?: string | null;
  articleType?: string | null;
  contentType?: string | null;
}): string {
  const fromStrategy =
    getContentAssetTypeLabel(article.contentStrategyType) ||
    getContentAssetTypeLabel(inferContentStrategyFromArticleType(article.articleType ?? article.contentType));
  if (fromStrategy) return fromStrategy;
  const raw = (article.articleType ?? article.contentType ?? "").trim();
  return raw || "未标注";
}

export function resolveArticleCoverPreviewSrc(article: {
  coverBase64?: string | null;
  coverTemplate?: string | null;
  coverImageUrl?: string | null;
}): string | null {
  const fromStored = buildCoverDataUrlFromStored(article.coverBase64);
  if (fromStored) return fromStored;
  if (article.coverTemplate && article.coverImageUrl?.trim()) {
    const url = article.coverImageUrl.trim();
    if (url.startsWith("data:")) return url;
  }
  if (isLegacyAiGeneratedCoverUrl(article.coverImageUrl) && !article.coverTemplate) return null;
  return null;
}

type PublishTaskLinkRow = {
  articleId?: number | null;
  status?: string | null;
  resultUrl?: string | null;
  publishedUrl?: string | null;
};

function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const link = (raw ?? "").trim();
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return null;
}

export function resolveArticlePublishLink(params: {
  articleId: number;
  publicPath?: string | null;
  publishRecords?: PublishRecordLinkRow[];
  publishTasks?: PublishTaskLinkRow[];
}): string | null {
  for (const record of params.publishRecords ?? []) {
    if (record.articleId !== params.articleId) continue;
    const link = normalizeExternalUrl(recordPublicLink(record));
    if (link) return link;
  }
  for (const task of params.publishTasks ?? []) {
    if (task.articleId !== params.articleId) continue;
    if (task.status !== "completed" && task.status !== "published" && task.status !== "link_backfilled") continue;
    const link = normalizeExternalUrl(task.publishedUrl ?? task.resultUrl);
    if (link) return link;
  }
  const publicPath = (params.publicPath ?? "").trim();
  if (publicPath.startsWith("http://") || publicPath.startsWith("https://")) return publicPath;
  return null;
}

export function filterWeeklyContentCards<T extends WeeklyContentCardView>(
  cards: T[],
  filters: {
    platform?: string;
    status?: ContentCardStatusFilter;
    titleQuery?: string;
    contentTag?: string;
  },
): T[] {
  const platform = (filters.platform ?? "all").trim();
  const status = filters.status ?? "all";
  const titleQuery = (filters.titleQuery ?? "").trim().toLowerCase();
  const contentTag = (filters.contentTag ?? "all").trim();
  return cards.filter(card => {
    if (platform !== "all") {
      const key = (card.platformKey ?? "").trim();
      const label = (card.targetPlatform ?? "").trim();
      if (key !== platform && label !== platform) return false;
    }
    if (status !== "all" && card.statusFilterKey !== status) return false;
    if (!articleMatchesContentTagFilter({ contentTags: card.contentTags }, contentTag)) return false;
    if (titleQuery) {
      const title = (card.title ?? "").trim().toLowerCase();
      if (!title.includes(titleQuery)) return false;
    }
    return true;
  });
}

export function sortWeeklyContentCardsByQuality<T extends WeeklyContentCardView>(
  cards: T[],
  order: ContentCardQualitySort,
): T[] {
  if (order === "none") return cards;
  const sorted = [...cards];
  sorted.sort((a, b) => {
    const av = a.qualityScore ?? -1;
    const bv = b.qualityScore ?? -1;
    if (av === bv) return a.id - b.id;
    return order === "desc" ? bv - av : av - bv;
  });
  return sorted;
}

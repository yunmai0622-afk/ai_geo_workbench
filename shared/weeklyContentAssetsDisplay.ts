import { isLegacyAiGeneratedCoverUrl } from "./articleCoverTemplate";
import { getContentAssetTypeLabel, inferContentStrategyFromArticleType } from "./contentStrategy";

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
  platformKey?: string | null;
  targetPlatform?: string | null;
  statusFilterKey: ContentCardStatus;
  qualityScore?: number | null;
};

export function resolveContentCardStatus(params: {
  published: boolean;
  publishable: boolean;
}): { label: string; filterKey: ContentCardStatus; tone: "neutral" | "info" | "success" | "warning" } {
  if (params.published) return { label: "已发布", filterKey: "published", tone: "success" };
  if (params.publishable) return { label: "可发布", filterKey: "publishable", tone: "info" };
  return { label: "草稿", filterKey: "draft", tone: "warning" };
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
  if (article.coverBase64?.trim()) {
    const raw = article.coverBase64.trim();
    return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
  }
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
  filters: { platform?: string; status?: ContentCardStatusFilter },
): T[] {
  const platform = (filters.platform ?? "all").trim();
  const status = filters.status ?? "all";
  return cards.filter(card => {
    if (platform !== "all") {
      const key = (card.platformKey ?? "").trim();
      const label = (card.targetPlatform ?? "").trim();
      if (key !== platform && label !== platform) return false;
    }
    if (status !== "all" && card.statusFilterKey !== status) return false;
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

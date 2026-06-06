/** 统一封面就绪判定：合并文章顶层字段与 generationBasis 内嵌封面字段 */

import { isValidStoredCoverBase64 } from "./articleCoverBase64";

export type ArticleCoverSource = {
  coverBase64?: string | null;
  coverImageUrl?: string | null;
  coverUrl?: string | null;
  coverAssetId?: string | null;
  coverImage?: string | null;
  coverTemplate?: string | null;
  generationBasis?: Record<string, unknown> | null;
  retainedCoverUrl?: string | null;
  manualCoverUrl?: string | null;
};

function hasNonEmptyString(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function readNestedCoverFromRecord(record: Record<string, unknown> | null | undefined): string | null {
  if (!record) return null;
  const keys = [
    "coverImageUrl",
    "coverUrl",
    "coverImage",
    "retainedCoverUrl",
    "manualCoverUrl",
    "coverAssetId",
  ] as const;
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function readGenerationBasisCover(basis?: Record<string, unknown> | null): string | null {
  if (!basis || typeof basis !== "object") return null;
  const direct = readNestedCoverFromRecord(basis);
  if (direct) return direct;
  const strategy = basis.platformContentStrategy;
  if (strategy && typeof strategy === "object") {
    return readNestedCoverFromRecord(strategy as Record<string, unknown>);
  }
  return null;
}

/** 文章是否已有可发布封面（任一有效字段即通过） */
export function articleHasPublishableCover(article: ArticleCoverSource): boolean {
  if (isValidStoredCoverBase64(article.coverBase64)) return true;
  if (hasNonEmptyString(article.coverBase64)) return true;
  const topLevel = [
    article.coverImageUrl,
    article.coverUrl,
    article.coverImage,
    article.retainedCoverUrl,
    article.manualCoverUrl,
    article.coverAssetId != null ? String(article.coverAssetId) : null,
  ];
  if (topLevel.some(hasNonEmptyString)) return true;
  return Boolean(readGenerationBasisCover(article.generationBasis));
}

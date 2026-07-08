/** 发布任务封面载荷：优先使用文章已保存的模板封面 base64 */

import { buildCoverDataUrlFromStored } from "./articleCoverBase64";

/** MySQL TEXT is about 64KB; keep a small buffer for data URLs. */
export const PUBLISH_TASK_COVER_IMAGE_URL_MAX_CHARS = 60_000;

export function buildPublishCoverImageUrl(coverBase64?: string | null, coverImageUrl?: string | null): string | null {
  const fromStored = buildCoverDataUrlFromStored(coverBase64);
  if (fromStored) return fromStored;
  const b64 = coverBase64?.trim();
  if (b64?.startsWith("data:")) return b64;
  const url = coverImageUrl?.trim();
  return url || null;
}

export type PublishTaskCoverPayload = {
  coverImageUrl: string | null;
  source: "stored" | "fallback" | "external" | "none";
  originalTooLarge: boolean;
};

function isDbSafeDataUrl(value: string): boolean {
  return !value.startsWith("data:") || value.length <= PUBLISH_TASK_COVER_IMAGE_URL_MAX_CHARS;
}

export function buildPublishTaskCoverImageUrl(input: {
  coverBase64?: string | null;
  coverImageUrl?: string | null;
  fallbackCoverBase64?: string | null;
}): PublishTaskCoverPayload {
  const primary = buildPublishCoverImageUrl(input.coverBase64, input.coverImageUrl);
  if (!primary) return { coverImageUrl: null, source: "none", originalTooLarge: false };
  if (isDbSafeDataUrl(primary)) {
    return {
      coverImageUrl: primary,
      source: primary.startsWith("data:") ? "stored" : "external",
      originalTooLarge: false,
    };
  }

  const fallback = buildPublishCoverImageUrl(input.fallbackCoverBase64, null);
  if (fallback && isDbSafeDataUrl(fallback)) {
    return { coverImageUrl: fallback, source: "fallback", originalTooLarge: true };
  }
  return { coverImageUrl: null, source: "none", originalTooLarge: true };
}

export function parseDataUrlCover(resolvedUrl: string): {
  coverImageUrl: string;
  coverImageBase64: string;
  coverImageMime: string;
} | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(resolvedUrl);
  if (!match?.[2]) return null;
  return {
    coverImageUrl: resolvedUrl,
    coverImageMime: match[1] || "image/png",
    coverImageBase64: match[2],
  };
}

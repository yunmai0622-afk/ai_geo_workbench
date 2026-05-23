/** 发布任务封面载荷：优先使用文章已保存的模板封面 base64 */

export function buildPublishCoverImageUrl(coverBase64?: string | null, coverImageUrl?: string | null): string | null {
  const b64 = coverBase64?.trim();
  if (b64) {
    if (b64.startsWith("data:")) return b64;
    return `data:image/png;base64,${b64}`;
  }
  const url = coverImageUrl?.trim();
  return url || null;
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

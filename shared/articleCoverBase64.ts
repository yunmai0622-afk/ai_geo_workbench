/** 文章封面 base64 存储格式：默认 PNG raw base64；Canvas 失败时存 svg: 前缀的 SVG UTF-8 base64 */

import { buildArticleCoverSvg, normalizeArticleCoverTemplateId, type ArticleCoverTemplateId } from "./articleCoverTemplate";

export const COVER_SVG_STORED_PREFIX = "svg:";

export type StoredCoverMime = "image/png" | "image/svg+xml";

export function encodeSvgStringToBase64(svg: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(svg, "utf-8").toString("base64");
  }
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function encodeStoredCoverBase64(params: { mime: StoredCoverMime; base64: string }): string {
  const payload = params.base64.trim();
  if (!payload) return "";
  if (params.mime === "image/svg+xml") return `${COVER_SVG_STORED_PREFIX}${payload}`;
  return payload;
}

export function parseStoredCoverBase64(
  stored: string | null | undefined,
): { mime: StoredCoverMime; base64: string } | null {
  const raw = stored?.trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(raw);
    if (!match?.[2]) return null;
    const mime = match[1]?.includes("svg") ? "image/svg+xml" : "image/png";
    return { mime, base64: match[2] };
  }
  if (raw.startsWith(COVER_SVG_STORED_PREFIX)) {
    const base64 = raw.slice(COVER_SVG_STORED_PREFIX.length).trim();
    return base64 ? { mime: "image/svg+xml", base64 } : null;
  }
  return { mime: "image/png", base64: raw };
}

export function isValidStoredCoverBase64(stored: string | null | undefined): boolean {
  const parsed = parseStoredCoverBase64(stored);
  if (!parsed?.base64) return false;
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(parsed.base64, "base64").length > 0;
    }
    const bin = atob(parsed.base64);
    return bin.length > 0;
  } catch {
    return false;
  }
}

export function buildCoverDataUrlFromStored(stored: string | null | undefined): string | null {
  const parsed = parseStoredCoverBase64(stored);
  if (!parsed?.base64) return null;
  return `data:${parsed.mime};base64,${parsed.base64}`;
}

export function synthesizeSvgCoverBase64(params: {
  template?: string | null;
  title: string;
  brandName?: string;
}): string {
  const template = normalizeArticleCoverTemplateId(params.template) as ArticleCoverTemplateId;
  const svg = buildArticleCoverSvg({ template, title: params.title.trim(), brandName: params.brandName });
  return encodeStoredCoverBase64({
    mime: "image/svg+xml",
    base64: encodeSvgStringToBase64(svg),
  });
}

/** 发布入队：优先已保存封面；缺失时用 SVG 模板在服务端即时合成 */
export function resolveArticleCoverBase64ForPublish(
  article: {
    coverBase64?: string | null;
    coverTemplate?: string | null;
    title?: string | null;
  },
  brandName?: string,
): string | null {
  if (isValidStoredCoverBase64(article.coverBase64)) return article.coverBase64!.trim();
  const title = article.title?.trim();
  if (!title) return null;
  return synthesizeSvgCoverBase64({
    template: article.coverTemplate,
    title,
    brandName,
  });
}

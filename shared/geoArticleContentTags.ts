/** GEO-V1.1-Content-Tags：geo_articles.contentTags JSON 字符串数组 */

export const CONTENT_TAG_MAX_COUNT = 10;
export const CONTENT_TAG_MAX_LENGTH = 32;

export const CONTENT_TAG_PRESETS = ["主推产品", "竞品对比", "品牌故事", "案例证据", "行业洞察", "FAQ"] as const;

export function normalizeContentTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim();
    if (!tag || tag.length > CONTENT_TAG_MAX_LENGTH) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= CONTENT_TAG_MAX_COUNT) break;
  }
  return out;
}

export function parseContentTagsInput(text: string): string[] {
  const parts = text
    .split(/[,，、;；\n]/)
    .map(s => s.trim())
    .filter(Boolean);
  return normalizeContentTags(parts);
}

export function formatContentTagsInput(tags: string[]): string {
  return normalizeContentTags(tags).join("、");
}

export type ContentTagStatRow = { tag: string; count: number };

export function computeContentTagStats(
  articles: Array<{ contentTags?: unknown }>,
): ContentTagStatRow[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const article of articles) {
    const tags = normalizeContentTags(article.contentTags);
    for (const tag of tags) {
      const key = tag.toLowerCase();
      const row = counts.get(key);
      if (row) row.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
}

export function articleMatchesContentTagFilter(
  article: { contentTags?: unknown },
  filterTag: string | undefined,
): boolean {
  const tag = (filterTag ?? "").trim();
  if (!tag || tag === "all") return true;
  const tags = normalizeContentTags(article.contentTags);
  return tags.some(t => t === tag || t.toLowerCase() === tag.toLowerCase());
}

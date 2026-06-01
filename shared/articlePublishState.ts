export function parseArticlePublishedAt(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** 内容卡片：已发布于 YYYY/MM/DD HH:mm */
export function formatArticlePublishedAtSentence(value: Date | string | number | null | undefined): string | null {
  const d = parseArticlePublishedAt(value);
  if (!d) return null;
  const label = d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `已发布于${label}`;
}

export function resolveArticlePublishedAtForDisplay(input: {
  publishedAt?: Date | string | number | null;
  lastPublishRecordAt?: Date | string | number | null;
}): Date | null {
  return parseArticlePublishedAt(input.publishedAt) ?? parseArticlePublishedAt(input.lastPublishRecordAt);
}

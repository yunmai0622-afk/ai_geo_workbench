import { parseLifecycleEvents, type ArticleLifecycleEvent } from "@shared/articleLifecycle";

export const CONTENT_MODIFIED_AFTER_PUBLISH_MESSAGE = "内容已在发布后修改，建议重新发布";

export function parseContentEditTimestamp(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

export function formatContentEditedAtLabel(value: Date | string | null | undefined): string | null {
  const t = parseContentEditTimestamp(value);
  if (t == null) return null;
  return new Date(t).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function resolveContentLastModifiedAt(input: {
  contentEditedAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): Date | null {
  const edited = parseContentEditTimestamp(input.contentEditedAt);
  if (edited != null) return new Date(edited);
  const updated = parseContentEditTimestamp(input.updatedAt);
  if (updated != null) return new Date(updated);
  return null;
}

export function latestPublishedLifecycleAt(events: ArticleLifecycleEvent[]): number | null {
  let max: number | null = null;
  for (const event of events) {
    if (event.status !== "published") continue;
    const t = parseContentEditTimestamp(event.at);
    if (t == null) continue;
    if (max == null || t > max) max = t;
  }
  return max;
}

export function resolveLastPublishedAt(input: {
  lifecycleEvents?: unknown;
  lastPublishRecordAt?: Date | string | null;
}): Date | null {
  const fromEvents = latestPublishedLifecycleAt(parseLifecycleEvents(input.lifecycleEvents));
  const fromRecord = parseContentEditTimestamp(input.lastPublishRecordAt);
  const candidates = [fromEvents, fromRecord].filter((t): t is number => t != null);
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates));
}

export function isContentModifiedAfterPublish(input: {
  contentEditedAt?: Date | string | null;
  lifecycleEvents?: unknown;
  lastPublishRecordAt?: Date | string | null;
}): boolean {
  const lastPublishedAt = resolveLastPublishedAt(input);
  if (!lastPublishedAt) return false;
  const editedAt = parseContentEditTimestamp(input.contentEditedAt);
  if (editedAt == null) return false;
  return editedAt > lastPublishedAt.getTime();
}

import {
  CONTENT_MODIFIED_AFTER_PUBLISH_MESSAGE,
  formatContentEditedAtLabel,
  isContentModifiedAfterPublish,
  resolveContentLastModifiedAt,
} from "@shared/articleContentEditMeta";

type Props = {
  contentEditedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  lifecycleEvents?: unknown;
  lastPublishRecordAt?: Date | string | null;
};

export function ArticleContentEditMeta({
  contentEditedAt,
  updatedAt,
  lifecycleEvents,
  lastPublishRecordAt,
}: Props) {
  const lastModified = resolveContentLastModifiedAt({ contentEditedAt, updatedAt });
  const lastModifiedLabel = formatContentEditedAtLabel(lastModified);
  const showRepublishHint = isContentModifiedAfterPublish({
    contentEditedAt,
    lifecycleEvents,
    lastPublishRecordAt,
  });

  if (!lastModifiedLabel && !showRepublishHint) return null;

  return (
    <div
      className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm"
      data-testid="article-content-edit-meta"
    >
      {lastModifiedLabel ? (
        <p className="text-gray-600" data-testid="article-last-modified">
          最后修改：{lastModifiedLabel}
        </p>
      ) : null}
      {showRepublishHint ? (
        <p className="text-amber-800" data-testid="article-modified-after-publish-hint">
          {CONTENT_MODIFIED_AFTER_PUBLISH_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}

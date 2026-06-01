import { normalizeArticleCoverTemplateId, type ArticleCoverTemplateId } from "./articleCoverTemplate";

/** 未保存时点击发布的提示文案 */
export const ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE =
  "当前内容有未保存修改，请先点击「保存修改」后再发布，避免发布旧版本内容。";

export const ARTICLE_SAVED_PUBLISH_HINT_MESSAGE =
  "内容已保存，发布时将使用最新标题、正文和封面。";

/** 文章尚无 coverBase64 时，加入发布队列前的提示（不阻断） */
export const ARTICLE_MISSING_COVER_PUBLISH_HINT_MESSAGE =
  "当前文章封面尚未写入数据库，请先打开「编辑内容」并点击「保存修改」，再发布。";

export type ArticleAssetDraftSnapshot = {
  title: string;
  content: string;
  template: ArticleCoverTemplateId;
  coverBase64: string | null;
};

export function buildArticleAssetSnapshot(input: {
  title?: string | null;
  content?: string | null;
  coverTemplate?: string | null;
  coverBase64?: string | null;
}): ArticleAssetDraftSnapshot {
  return {
    title: (input.title ?? "").trim(),
    content: (input.content ?? "").trim(),
    template: normalizeArticleCoverTemplateId(input.coverTemplate),
    coverBase64: input.coverBase64?.trim() || null,
  };
}

export function serializeArticleAssetSnapshot(snapshot: ArticleAssetDraftSnapshot): string {
  return JSON.stringify(snapshot);
}

export function isArticleAssetDraftDirty(
  saved: ArticleAssetDraftSnapshot,
  draft: ArticleAssetDraftSnapshot,
): boolean {
  return serializeArticleAssetSnapshot(saved) !== serializeArticleAssetSnapshot(draft);
}

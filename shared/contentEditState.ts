import {
  isPlatformDraftInFlight,
  PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN,
  readPlatformDraftGeneration,
} from "./platformDraftGeneration";

export type ContentEditStateArticle = {
  status?: string | null;
  markdownContent?: string | null;
  generationBasis?: Record<string, unknown> | null;
};

export type ArticleContentEditState =
  | {
      editable: true;
      body: string;
      reason: null;
      state: "ready";
    }
  | {
      editable: false;
      body: "";
      reason: string;
      state: "pending" | "generating" | "failed" | "empty";
    };

export const CONTENT_NOT_GENERATED_EDIT_REASON =
  "内容尚未生成完成，不能修改；请先等待生成完成或重新生成。";

export const CONTENT_GENERATION_FAILED_EDIT_REASON =
  "内容生成失败，不能进入修改质检流程；请先重新生成内容。";

export function isPlatformDraftPlaceholderMarkdown(value: string | null | undefined): boolean {
  return (value ?? "").trim() === PLATFORM_DRAFT_PLACEHOLDER_MARKDOWN;
}

export function resolveArticleContentEditState(
  article: ContentEditStateArticle | null | undefined,
): ArticleContentEditState {
  if (!article) {
    return {
      editable: false,
      body: "",
      reason: CONTENT_NOT_GENERATED_EDIT_REASON,
      state: "empty",
    };
  }

  const draft = readPlatformDraftGeneration(article.generationBasis ?? null);
  if (draft?.status === "failed") {
    return {
      editable: false,
      body: "",
      reason: CONTENT_GENERATION_FAILED_EDIT_REASON,
      state: "failed",
    };
  }
  if (isPlatformDraftInFlight(draft?.status)) {
    return {
      editable: false,
      body: "",
      reason: CONTENT_NOT_GENERATED_EDIT_REASON,
      state: "generating",
    };
  }

  const status = (article.status ?? "").trim();
  const rawBody = article.markdownContent ?? "";
  const body = isPlatformDraftPlaceholderMarkdown(rawBody) ? "" : rawBody.trim();
  if (status === "待生成" || !body) {
    return {
      editable: false,
      body: "",
      reason: CONTENT_NOT_GENERATED_EDIT_REASON,
      state: status === "待生成" ? "pending" : "empty",
    };
  }

  return {
    editable: true,
    body,
    reason: null,
    state: "ready",
  };
}

export function hasEditableArticleBody(article: ContentEditStateArticle | null | undefined): boolean {
  return resolveArticleContentEditState(article).editable;
}

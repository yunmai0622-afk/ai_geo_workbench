import { describe, expect, it } from "vitest";
import {
  ARTICLE_SAVED_PUBLISH_HINT_MESSAGE,
  ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE,
  buildArticleAssetSnapshot,
  isArticleAssetDraftDirty,
} from "./articleAssetDraft";

describe("articleAssetDraft", () => {
  it("detects unsaved title changes", () => {
    const saved = buildArticleAssetSnapshot({ title: "原标题", content: "正文" });
    const draft = buildArticleAssetSnapshot({ title: "新标题", content: "正文" });
    expect(isArticleAssetDraftDirty(saved, draft)).toBe(true);
  });

  it("detects unsaved content changes", () => {
    const saved = buildArticleAssetSnapshot({ title: "标题", content: "旧正文" });
    const draft = buildArticleAssetSnapshot({ title: "标题", content: "新正文" });
    expect(isArticleAssetDraftDirty(saved, draft)).toBe(true);
  });

  it("detects unsaved cover template or base64 changes", () => {
    const saved = buildArticleAssetSnapshot({
      title: "标题",
      content: "正文",
      coverTemplate: "ai-tech",
      coverBase64: "abc",
    });
    const templateDraft = buildArticleAssetSnapshot({
      title: "标题",
      content: "正文",
      coverTemplate: "business",
      coverBase64: "abc",
    });
    const coverDraft = buildArticleAssetSnapshot({
      title: "标题",
      content: "正文",
      coverTemplate: "ai-tech",
      coverBase64: "xyz",
    });
    expect(isArticleAssetDraftDirty(saved, templateDraft)).toBe(true);
    expect(isArticleAssetDraftDirty(saved, coverDraft)).toBe(true);
  });

  it("clears dirty after matching saved snapshot", () => {
    const snap = buildArticleAssetSnapshot({ title: "A", content: "B", coverTemplate: "compare" });
    expect(isArticleAssetDraftDirty(snap, snap)).toBe(false);
  });

  it("exposes publish block and saved hint messages", () => {
    expect(ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE).toContain("未保存修改");
    expect(ARTICLE_SAVED_PUBLISH_HINT_MESSAGE).toContain("最新标题");
  });
});

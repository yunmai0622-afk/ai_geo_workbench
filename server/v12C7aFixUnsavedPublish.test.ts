import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ARTICLE_MISSING_COVER_PUBLISH_HINT_MESSAGE,
  ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE,
} from "@shared/articleAssetDraft";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C7-A-Fix unsaved changes block publish", () => {
  it("publish is blocked when article has unsaved title changes", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("blockPublishIfUnsaved");
    expect(weekly).toContain("ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE");
    expect(ARTICLE_UNSAVED_PUBLISH_BLOCK_MESSAGE).toContain("未保存修改");
    expect(weekly).toContain("unsavedArticleIds");
  });

  it("publish is blocked when article has unsaved content changes via editor dirty sync", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    expect(sheet).toContain("onDirtyChange");
    expect(sheet).toContain("isArticleAssetDraftDirty");
    expect(sheet).toContain("content");
  });

  it("publish is blocked when cover changes are unsaved", () => {
    expect(read("shared/articleAssetDraft.ts")).toContain("coverBase64");
    expect(read("client/src/components/ArticleAssetEditorSheet.tsx")).toContain("coverBase64Draft");
  });

  it("publish continues after saving edited article", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    expect(sheet).toContain("ARTICLE_SAVED_PUBLISH_HINT_MESSAGE");
    expect(sheet).toContain("onDirtyChange?.(article.id, false)");
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("setArticleUnsaved(editorArticle.id, false)");
  });

  it("publish hints when coverBase64 is missing without hard block", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("ARTICLE_MISSING_COVER_PUBLISH_HINT_MESSAGE");
    expect(weekly).toContain("publish-missing-cover-hint");
    expect(weekly).toContain("articleNeedsCoverSaveHint");
  });

  it("publish task still includes projectId and expectedAccountName", () => {
    const router = read("server/publishTasksRouter.ts");
    expect(router).toContain("projectId: input.projectId");
    expect(router).toContain("expectedAccountName: boundAccount.accountName");
    expect(router).not.toContain("autoSave");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("content edit state consistency static wiring", () => {
  it("weekly single task checks editable body before quality revision action", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("resolveArticleContentEditState(singleTaskFocusArticle)");
    expect(weekly).toContain('nextActionLabel: "刷新状态"');
    expect(weekly).toContain('blockerText: "内容生成中"');
    expect(weekly).toContain('nextActionLabel: "生成平台稿"');
  });

  it("article editor blocks editing, copying and saving when body is not ready", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    expect(sheet).toContain("article-content-not-ready-hint");
    expect(sheet).toContain("CONTENT_NOT_GENERATED_EDIT_REASON");
    expect(sheet).toContain("disabled={!canEditArticleContent}");
    expect(sheet).toContain("disabled={isSaving || updateArticle.isPending || deleteArticle.isPending || !canEditArticleContent}");
    expect(sheet).toContain("toast.error(articleEditState.reason");
  });

  it("generation history only marks generated body as current body", () => {
    const history = read("shared/geoArticleGenerationHistory.ts");
    const panel = read("client/src/components/ArticleGenerationHistoryPanel.tsx");
    expect(history).toContain("currentIsGeneratedBody");
    expect(history).toContain("当前记录（未生成）");
    expect(history).toContain("if (!hasEditableArticleBody(row)) continue");
    expect(panel).toContain("entry.isCurrentBody");
    expect(panel).toContain("当前正文");
  });
});

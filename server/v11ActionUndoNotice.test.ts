import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-Action-Undo-Notice", () => {
  it("shared copy matches irreversible confirm template", () => {
    const shared = read("shared/dangerousActionConfirm.ts");
    expect(shared).toContain("删除内容");
    expect(shared).toContain("归档项目");
    expect(shared).toContain("重置T0检测");
    expect(shared).toContain("此操作无法撤销");
  });

  it("dangerous action dialog uses confirm and cancel labels", () => {
    const dialog = read("client/src/components/DangerousActionConfirmDialog.tsx");
    expect(dialog).toContain("DangerousActionConfirmDialog");
    expect(dialog).toContain("确认");
    expect(dialog).toContain("取消");
    expect(dialog).toContain("buildDangerousActionConfirmMessage");
  });

  it("archive project requires confirmation on client dashboard", () => {
    const page = read("client/src/pages/ClientDashboardPage.tsx");
    expect(page).toContain("useDangerousActionConfirm");
    expect(page).toContain("DANGEROUS_ACTION_LABELS.archiveProject");
    expect(page).toContain("DangerousActionConfirmDialog");
  });

  it("delete content requires confirmation in asset editor", () => {
    const sheet = read("client/src/components/ArticleAssetEditorSheet.tsx");
    expect(sheet).toContain("article-asset-delete-button");
    expect(sheet).toContain("DANGEROUS_ACTION_LABELS.deleteContent");
    expect(sheet).toContain("articles.deleteContent");
  });

  it("reset T0 requires confirmation on AI diagnosis page", () => {
    const page = read("client/src/pages/V12FlowPages.tsx");
    expect(page).toContain("ai-diagnosis-reset-t0");
    expect(page).toContain("DANGEROUS_ACTION_LABELS.resetT0Detection");
    expect(page).toContain("resetT0Baseline");
  });

  it("backend mutations exist for delete content and reset T0", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("deleteGeoArticleCascade");
    expect(router).toContain("resetProjectT0Baseline");
    expect(router).toContain("resetT0Baseline: protectedProcedure");
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("GEO-V1.1-Content-Templates", () => {
  it("route and router", () => {
    expect(read("client/src/App.tsx")).toContain('path="/templates"');
    expect(read("server/routers.ts")).toContain("questionTemplates: router({");
    expect(read("server/routers.ts")).toContain("buildQuestionTemplatePreview");
  });
  it("builtin templates", () => {
    expect(read("shared/questionContentTemplates.ts")).toContain("zhihu-brand-awareness");
  });
  it("modal not toast for template preview", () => {
    expect(read("client/src/pages/TemplatesPage.tsx")).toContain("TemplateFillPreviewDialog");
    expect(read("client/src/pages/TemplatesPage.tsx")).not.toMatch(/toast\.success\([^)]*预览/);
    expect(read("client/src/components/templates/TemplateFillPreviewDialog.tsx")).toContain("模板填充预览");
  });
});

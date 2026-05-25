import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C6-A enterprise profile AI intake", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const panel = read("client/src/components/enterpriseProfile/ProfileIntakePanel.tsx");
  const router = read("server/routers.ts");
  const analyze = read("server/enterpriseProfileAnalyze.ts");

  it("renders AI document upload entry", () => {
    expect(page).toContain("ProfileIntakePanel");
    expect(page).toContain("上传企业资料");
    expect(panel).toContain("AI 解析并填充档案");
    expect(panel).toContain("先上传企业资料");
    expect(panel).toContain("拖拽文件到此处");
  });

  it("industry pain point options change by industry", () => {
    expect(page).toContain("getPainOptionsForIndustry");
    expect(page).toContain("ENTERPRISE_INDUSTRY_OPTIONS");
    expect(read("shared/enterpriseProfileIndustry.ts")).toContain("industryPainPointOptions");
  });

  it("AI analysis preview does not auto-save", () => {
    expect(panel).toContain("analyzeDocument");
    expect(panel).toContain("应用到企业档案");
    expect(panel).not.toContain("upsertProfile");
    expect(router).toContain("analyzeDocument");
    expect(analyze).not.toContain("upsertProfile");
    expect(analyze).not.toContain("insert(");
  });

  it("apply AI analysis only fills empty fields by default", () => {
    expect(panel).toContain("只应用空字段");
    expect(panel).toContain('applyMode === "empty"');
    expect(panel).toContain("覆盖已有内容");
  });

  it("does not expose raw prompt provider json to customers", () => {
    expect(panel).not.toContain("rawAnswer");
    expect(panel).not.toMatch(/JSON\.stringify\(analysis/);
    expect(page).not.toContain("SYSTEM_PROMPT");
    expect(page).toContain("AiFilledMark");
    expect(panel).toContain("AI 已填充");
  });
});

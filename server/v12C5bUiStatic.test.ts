import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-B content production page product UI", () => {
  const page = read("client/src/pages/WeeklyContentPage.tsx");
  const css = read("client/src/index.css");

  it("uses production console with segmented count and progress strip", () => {
    expect(page).toContain("AI 内容资产生产控制台");
    expect(page).toContain("ai-segmented");
    expect(page).toContain("本轮生产进度");
    expect(page).toContain("本轮内容资产已生成完成");
    expect(page).toContain("ai-progress-strip");
    expect(page).not.toContain("本周 ${topics.length} 篇文章已生成");
    expect(page).not.toMatch(/fixed inset-x-0 bottom-0/);
  });

  it("uses asset cards and collapsible publish tools at bottom", () => {
    expect(page).toContain("内容资产卡片区");
    expect(page).toContain("AiStatusBadge");
    expect(page).toContain("目标问题");
    expect(page).toContain("发布辅助工具");
    expect(page).toContain("<details");
    expect(page).not.toMatch(/浏览器发布插件/);
  });

  it("defines segmented control styles", () => {
    expect(css).toContain(".ai-segmented");
    expect(css).toContain(".ai-progress-strip");
  });
});

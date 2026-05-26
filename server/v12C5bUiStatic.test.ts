import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-B content production page product UI", () => {
  const page = read("client/src/pages/WeeklyContentPage.tsx");

  it("uses platform production first screen", () => {
    expect(page).toContain("平台化内容生产");
    expect(page).toContain("PlatformContentBoard");
    expect(page).toContain("生成本轮平台化内容");
    expect(page).not.toMatch(/AI 内容资产生产控制台|生成内容资产|ai-segmented/);
  });

  it("uses platform article cards and publish queue", () => {
    expect(page).toContain("WeeklyPlatformArticleCard");
    expect(page).toContain("weekly-content-cards");
    expect(page).toContain("加入发布队列");
    expect(page).toContain("local-agent-publish-hint");
    expect(page).not.toMatch(/浏览器发布插件|发布辅助工具/);
  });
});

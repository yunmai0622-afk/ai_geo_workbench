import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("weekly content page configurable generation (C4-A)", () => {
  const page = read("client/src/pages/WeeklyContentPage.tsx");
  const routers = read("server/routers.ts");

  it("renders generation count options", () => {
    for (const text of ["生成数量", "自定义", "生成内容资产", "正在生成", "篇内容", "AI 内容资产生产控制台"]) {
      expect(page).toContain(text);
    }
    expect(page).toContain('["7", "14", "21", "custom"]');
    expect(page).toContain("${key} 篇");
    expect(page).toMatch(/generationCount:\s*targetCount/);
  });

  it("router accepts generationCount with 1-50 bounds", () => {
    expect(routers).toContain("generationCount: z.number().int().min(1).max(50).optional()");
    expect(routers).toContain("targetCount: generationCount");
  });
});

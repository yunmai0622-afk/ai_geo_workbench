import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Platform matrix generation isolation static", () => {
  it("weeklyPlatformBoard defines full platform matrix", () => {
    const defs = read("client/src/lib/weeklyPlatformBoard.ts");
    for (const token of [
      "key: \"xiaohongshu\"",
      "key: \"zhihu\"",
      "key: \"sohu\"",
      "key: \"netease\"",
      "key: \"wechat\"",
      "key: \"baijiahao\"",
      "key: \"toutiao\"",
      "key: \"other\"",
    ]) {
      expect(defs).toContain(token);
    }
    // Ensure xiaohongshu/wechat/other are not null publishPlatformId anymore
    expect(defs).toContain("publishPlatformId: \"xiaohongshu\"");
    expect(defs).toContain("publishPlatformId: \"wechat\"");
    expect(defs).toContain("publishPlatformId: \"other\"");
  });

  it("WeeklyContentPage uses platform click as highest-priority payload source", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");
    expect(weekly).toContain("handlePlatformGenerate");
    expect(weekly).toContain("resolvePublishSlugForWeeklyPlatform");
    expect(weekly).toContain("strategyOverride.targetPublishPlatform");
  });
});


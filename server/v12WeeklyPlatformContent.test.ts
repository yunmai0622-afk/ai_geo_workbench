import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1-UI-P1-B Weekly-Platform-Content", () => {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");

  it("首屏平台化内容生产结构", () => {
    expect(weekly).toContain("weekly-platform-content-page");
    expect(weekly).toContain("平台化内容生产");
    expect(weekly).not.toContain("当前企业：");
    expect(weekly).toContain("weekly-round-goal");
    expect(weekly).toContain("weekly-strategy-source");
    expect(weekly).toContain("最近一次 AI 诊断");
    expect(weekly).toContain("PlatformContentBoard");
  });

  it("无诊断空状态", () => {
    expect(weekly).toContain("weekly-no-diagnosis");
    expect(weekly).toContain("暂无 AI 实测诊断结果");
    expect(weekly).toContain("去 AI 实测诊断");
  });

  it("平台看板与禁止一稿多发", () => {
    const defs = read("client/src/lib/weeklyPlatformBoard.ts");
    for (const label of ["小红书", "知乎", "搜狐号", "网易号", "公众号", "其他平台"]) {
      expect(defs).toContain(label);
    }
    expect(board).toContain("生成本轮平台化内容");
    expect(board).toContain("不支持一稿多发");
    expect(weekly).toContain("不支持一稿多发");
    expect(weekly).not.toMatch(/批量生成|生成内容资产|生成数量/);
  });

  it("内容卡片与真实质检分", () => {
    expect(weekly).toContain("WeeklyPlatformArticleCard");
    expect(weekly).toContain("resolveQualityDisplay");
    expect(weekly).toContain("加入发布队列");
    expect(weekly).not.toContain("rawAnswer");
  });
});

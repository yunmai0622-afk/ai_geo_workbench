import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C5-B content production page product UI", () => {
  const page = read("client/src/pages/WeeklyContentPage.tsx");

  it("uses platform production first screen", () => {
    expect(page).toContain("内容任务推进");
    expect(page).toContain("CurrentContentTaskCard");
    expect(page).toContain("PlatformTaskBoard");
    expect(read("shared/weeklyContentTaskBoard.ts")).toContain("生成平台稿");
    expect(page).not.toMatch(/AI 内容资产生产控制台|生成内容资产|ai-segmented/);
  });

  it("uses advanced sections and compact local agent status", () => {
    expect(read("client/src/components/weekly/WeeklyPublishableContentList.tsx")).toContain(
      "待处理内容",
    );
    expect(page).toContain("WeeklyAdvancedInfoSections");
    expect(page).toContain("requestEnqueuePublish");
    expect(page).toContain("WeeklyLocalAgentStatusBar");
    expect(page).not.toMatch(/浏览器发布插件|发布辅助工具/);
  });
});

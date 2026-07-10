import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(__dirname, "../client/src/pages/SourceGraphPage.tsx"), "utf-8");

describe("GEO V2.3 source recommendation copy simplification", () => {
  it("presents source recommendations as understandable operator tasks", () => {
    expect(page).toContain("待补强的公开证据");
    expect(page).toContain("这些内容用于补齐 AI 识别品牌时缺少的公开证据");
    expect(page).not.toContain("根据信源缺口与问题池提及情况生成");
    for (const label of ["要补什么", "为什么要补", "建议怎么做", "完成标准"]) {
      expect(page).toContain(label);
    }
    expect(page).toContain("查看运营细节");
    expect(page).toContain("最高优先级（P0）");
  });

  it("uses task-state actions without changing the existing handoff routes", () => {
    for (const label of ["生成内容任务", "查看已有内容任务", "去内容生产与发布", "查看发布记录"]) {
      expect(page).toContain(label);
    }
    expect(page).toContain("buildWeeklyContentEntryUrl");
    expect(page).toContain('buildProjectUrl("/content-publishing"');
    expect(page).toContain("请先选择企业项目，再生成内容任务。");
  });
});

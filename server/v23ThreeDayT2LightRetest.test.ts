import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(
  resolve(import.meta.dirname, "../client/src/pages/DeliveryReportsCenterPage.tsx"),
  "utf-8",
);

describe("GEO V2.3 project 210001 early three-day check and T2 light retest", () => {
  it("shows the verified inclusion check without claiming inclusion", () => {
    expect(page).toContain("delivery-report-three-day-t2-check");
    expect(page).toContain("3 天收录初查（提前检查）");
    expect(page).toContain("尚未满 3 天");
    expect(page).toContain("当前状态：待观察");
    expect(page).toContain("没有证据证明该 URL 已被搜索引擎收录");
  });

  it("records all four T2 questions and the limited T1/T2 comparison", () => {
    for (const question of [
      "海豚知道是什么？",
      "海豚知道主要解决什么问题？",
      "知识付费 SaaS 系统有哪些推荐？",
      "知识付费团队如何做系统化经营？",
    ]) {
      expect(page).toContain(question);
    }
    expect(page).toContain("3/4 题提及、1/4 题列入场景推荐");
    expect(page).toContain("不能直接写成整体推荐率提升");
    expect(page).toContain("均未引用本次知乎文章 URL");
  });

  it("limits the special report to project 210001", () => {
    expect(page).toContain("selectedProjectId === 210001");
  });
});

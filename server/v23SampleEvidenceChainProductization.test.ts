import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3 sample AI question occupancy evidence chain", () => {
  it("shows the five-step evidence chain in project 210001 delivery report", () => {
    const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    for (const marker of [
      "delivery-report-sample-evidence-chain",
      "目标问题",
      "海豚知道是什么？",
      "围绕该问题发布知乎公开内容，补充品牌解释和业务定位。",
      "07/12 已补跑",
      "进入 07/16 正式 T2 与 07/23 T3",
      "不代表文章已经收录",
    ]) {
      expect(page).toContain(marker);
    }
    expect(page).toContain("selectedProjectId === 210001");
  });

  it("tracks the question occupancy state in inclusion monitoring", () => {
    const page = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    for (const marker of [
      "inclusion-question-occupancy-tracking",
      "问题占位追踪",
      "知乎文章已发布",
      "待观察",
      "07/12 补跑",
    ]) {
      expect(page).toContain(marker);
    }
  });

  it("explains the published weekly task as question evidence construction", () => {
    const page = read("client/src/pages/WeeklyContentPage.tsx");
    expect(page).toContain("weekly-question-occupancy-evidence");
    expect(page).toContain("已围绕“海豚知道是什么？”完成知乎公开内容建设，等待收录和 AI 复测。");
    expect(page).toMatch(/不代表已收录或 AI\s*提及已经提升/);
  });
});

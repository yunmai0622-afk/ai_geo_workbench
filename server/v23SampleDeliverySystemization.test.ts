import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3 sample delivery systemization", () => {
  const report = read("client/src/pages/DeliveryReportsCenterPage.tsx");

  it("shows an honest sample project status only for project 210001", () => {
    expect(report).toContain("delivery-report-sample-project-status");
    expect(report).toContain("第一轮公开证据建设已完成，进入收录观察与 AI 复测阶段");
    expect(report).toContain("收录待观察；T1 未稳定提及、未形成推荐，也未引用本次知乎文章");
    expect(report).toContain("selectedProjectId === 210001");
  });

  it("renders the three pending retest milestones without inventing results", () => {
    for (const value of ["07/12", "07/16", "07/23", "复查目标：", "验证内容：", "后续判断：", "scheduledRetestStatusLabel"]) {
      expect(report).toContain(value);
    }
  });

  it("provides a sales-ready evidence chain and service actions", () => {
    for (const value of [
      "不是简单发布文章",
      "不代表已产生效果提升",
      "delivery-report-sample-service-playbook",
      "继续观察",
      "信源补强",
      "内容补强",
      "这个样板案例怎么讲给客户听？",
      "GEO 代运营和普通发稿的区别",
    ]) expect(report).toContain(value);
  });

  it("shows the compact pending timeline in inclusion monitoring", () => {
    const monitoring = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    expect(monitoring).toContain("inclusion-sample-retest-timeline");
    for (const value of ["07/12", "07/16", "07/23", "scheduledRetestStatusLabel"]) expect(monitoring).toContain(value);
  });
});

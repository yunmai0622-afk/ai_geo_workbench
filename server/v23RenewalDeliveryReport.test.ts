import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO V2.3 P0-D renewal delivery report", () => {
  const page = read("client/src/pages/DeliveryReportsCenterPage.tsx");

  it("turns /delivery-reports into a renewal-oriented customer report", () => {
    for (const marker of [
      "交付报告",
      "本月报告结论",
      "delivery-report-renewal-conclusion",
      "delivery-report-completed-items",
      "delivery-report-effect-changes",
      "delivery-report-open-issues",
      "delivery-report-next-month-renewal",
      "delivery-report-primary-cta",
    ]) {
      expect(page).toContain(marker);
    }
  });

  it("explains renewal value without hiding unresolved issues", () => {
    for (const label of [
      "本月完成事项",
      "效果变化",
      "仍需优化的问题",
      "下月建议 / 续费理由",
      "为什么影响推荐",
      "下月怎么做",
      "为什么继续做",
      "做完怎么看效果",
      "客户价值",
    ]) {
      expect(page).toContain(label);
    }
  });

  it("keeps detailed evidence behind an expandable section", () => {
    expect(page).toContain("证据详情与完整月报");
    expect(page).toContain("delivery-report-evidence-details");
    expect(page).toContain("原始数据、历史记录和详细证明已降级展示");
    expect(page).toContain("MonthlyMaturityReportSections");
  });

  it("keeps suggestions clearly as suggestions and avoids fake completion", () => {
    expect(page).toContain("这是基于当前报告数据的下月建议，不代表已经排期完成。");
    expect(page).not.toContain('priority.source === "suggestion") return "已完成"');
    expect(page).not.toContain('priority.source === "suggestion") return "已验证"');
  });

  it("does not expose technical fields in the customer report page", () => {
    for (const forbidden of [
      "questionId=",
      "sourceType=",
      "taskId=",
      "ownerUserId",
      "optimization_task",
      "publish_task",
      "Local Agent",
      "workflow",
      "bundle",
      "commit",
      "错误堆栈",
      "JSON.stringify",
      "rawAnswer",
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });
});

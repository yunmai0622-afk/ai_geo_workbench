import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO V2.3 P0-C monthly plan service proposal", () => {
  const page = read("client/src/pages/MonthlyPlanPage.tsx");

  it("turns /monthly-plan into a customer-facing service proposal", () => {
    for (const marker of [
      "本月服务方案",
      "本月服务结论",
      "monthly-plan-service-conclusion",
      "monthly-plan-customer-goals",
      "monthly-plan-top3-service-items",
      "monthly-plan-service-progress",
      "monthly-plan-next-verification",
      "monthly-plan-primary-cta",
    ]) {
      expect(page).toContain(marker);
    }
  });

  it("explains each Top 3 service item in customer language", () => {
    for (const label of [
      "解决的问题",
      "为什么做",
      "完成标准",
      "做完怎么验证",
      "客户能看到什么价值",
      "关联任务数量",
    ]) {
      expect(page).toContain(label);
    }
    expect(page).toContain("customerValueForDimension");
    expect(page).toContain("priority.successCriteria");
    expect(page).toContain("priority.retestMethod");
  });

  it("keeps detailed tasks downgraded as operational execution details", () => {
    expect(page).toContain("运营执行明细");
    expect(page).toContain("详细任务清单已降级展示");
    expect(page).toContain("monthly-plan-execution-details");
    expect(page).not.toContain("MonthlyOptimizationPrioritiesPanel");
  });

  it("does not present suggestion priorities as completed work", () => {
    expect(page).toContain('priority.source === "suggestion") return "待纳入方案"');
    expect(page).not.toContain('priority.source === "suggestion") return "已完成"');
    expect(page).not.toContain('priority.source === "suggestion") return "已验证"');
  });

  it("does not expose technical routing fields in customer copy", () => {
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
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });
});

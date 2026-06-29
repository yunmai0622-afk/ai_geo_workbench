import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("V2.3-P0-G Weekly execution progress customer view", () => {
  const weeklyPage = read("client/src/pages/WeeklyContentPage.tsx");
  const customerOverview = read("client/src/components/weekly/WeeklyCustomerExecutionOverview.tsx");

  it("turns /weekly into a customer-readable execution progress page", () => {
    expect(weeklyPage).toContain("客户主流程 / 执行进度");
    expect(weeklyPage).toContain("<h1 className=\"text-2xl font-bold text-gray-900\">执行进度</h1>");
    expect(weeklyPage).toContain("WeeklyCustomerExecutionOverview");
    expect(customerOverview).toContain("weekly-customer-execution-overview");
    expect(customerOverview).toContain("一句话执行结论");
    expect(customerOverview).toContain("客户可见执行进度");
  });

  it("shows the four customer metrics and execution blockers", () => {
    expect(customerOverview).toContain("weekly-execution-metrics");
    expect(customerOverview).toContain("本月服务事项");
    expect(customerOverview).toContain("内容资产建设");
    expect(customerOverview).toContain("待发布内容");
    expect(customerOverview).toContain("已发布待验证");
    expect(customerOverview).toContain("weekly-execution-top-blockers");
    expect(customerOverview).toContain("当前卡点");
  });

  it("keeps service items, flow progress, and one primary CTA in the customer surface", () => {
    expect(customerOverview).toContain("weekly-execution-primary-cta");
    expect(customerOverview).toContain("weekly-execution-flow");
    expect(customerOverview).toContain("服务流程进度");
    expect(customerOverview).toContain("weekly-execution-service-items");
    expect(customerOverview).toContain("本月 Top 3 执行事项");
  });

  it("keeps operational production controls below the customer view", () => {
    expect(weeklyPage).toContain("weekly-operational-workbench");
    expect(weeklyPage).toContain("运营执行明细");
    expect(weeklyPage).toContain("MonthlyContentTaskList");
    expect(weeklyPage).toContain("TaskProgressOverview");
    expect(weeklyPage).toContain("PlatformTaskBoard");
    expect(weeklyPage).toContain("内容任务推进");
  });

  it("reuses the proven weekly task entry path for primary CTA and list actions", () => {
    expect(weeklyPage).toContain("handleSelectMonthlyContentTask");
    expect(weeklyPage).toContain("buildMonthlyContentTaskEntryUrl");
    expect(weeklyPage).toContain("setLocation(entryUrl)");
    expect(weeklyPage).toContain("onSelectTask={handleSelectMonthlyContentTask}");
  });

  it("does not expose engineering fields in the customer execution component", () => {
    const forbidden = ["questionId", "sourceType", "taskId", "workflow", "bundle", "commit", "错误堆栈"];
    for (const term of forbidden) {
      expect(customerOverview).not.toContain(term);
    }
  });
});

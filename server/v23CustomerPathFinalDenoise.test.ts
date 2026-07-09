import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V2.3-P0-P customer path final denoise", () => {
  it("keeps local publishing controls out of the default customer weekly page", () => {
    const weekly = read("client/src/pages/WeeklyContentPage.tsx");

    expect(weekly).toContain("{enabled && isContentProductionWorkbench && !isSingleTaskProgression ? (");
    expect(weekly).toContain("WeeklyLocalAgentStatusBar");
    expect(weekly).toContain('if (isCustomerExecutionView) return "查看收录与验证";');
  });

  it("makes delivery reports honest about sample evidence gaps", () => {
    const delivery = read("client/src/pages/DeliveryReportsCenterPage.tsx");

    expect(delivery).toContain("delivery-report-evidence-accumulation");
    expect(delivery).toContain("当前仍处于样板交付积累阶段");
    expect(delivery).toContain("本月证据仍在积累中");
    expect(delivery).toContain("不承诺 AI 推荐率提升");
    expect(delivery).toContain("本月做了什么");
    expect(delivery).toContain("发布了什么");
    expect(delivery).toContain("验证了什么");
    expect(delivery).toContain("还缺什么");
    expect(delivery).toContain("下月继续做什么");
  });

  it("explains an empty clients dashboard as an account data state", () => {
    const clients = read("client/src/pages/ClientDashboardPage.tsx");

    expect(clients).toContain("当前账号暂无可管理客户项目");
    expect(clients).toContain("请使用有客户数据的账号验证客户管理台，或先创建样板客户项目。");
    expect(clients).toContain("create-client-project-empty-button");
  });
});

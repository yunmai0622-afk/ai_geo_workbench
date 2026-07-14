import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveRetestReportState,
  deriveScheduledRetestState,
  scheduledRetestStatusLabel,
} from "@shared/trustworthyState";
import { missingSampleRetestQuestions, SAMPLE_RETEST_QUESTIONS } from "./scheduledSampleRetest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf-8");

describe("GEO V3.0 trustworthy state and scheduled retest fix", () => {
  it("accepts the complete 210001 question pool and names every missing required question", () => {
    expect(missingSampleRetestQuestions(SAMPLE_RETEST_QUESTIONS)).toEqual([]);
    expect(missingSampleRetestQuestions(["海豚知道是什么？"])).toEqual([
      "海豚知道主要解决什么问题？",
      "知识付费 SaaS 系统有哪些推荐？",
      "知识付费团队如何做系统化经营？",
    ]);
    expect(read("server/scheduledSampleRetest.ts")).toContain("请先补齐问题配置后再执行复测");
    expect(read("server/routers.ts")).toContain("derived.retryMilestones[0]?.status ?? currentStatus");
  });

  it("keeps the failed 07/12 node but rolls next validation to 07/16", () => {
    const state = deriveScheduledRetestState({
      now: new Date("2026-07-14T04:00:00Z"),
      currentKey: "light_t2",
      currentStatus: "failed",
      lastError: "question pool missing",
      milestones: [
        { key: "light_t2", dueDate: "2026-07-12", status: "failed" },
        { key: "t2", dueDate: "2026-07-16", status: "pending" },
        { key: "t3", dueDate: "2026-07-23", status: "pending" },
      ],
    });
    expect(state.milestones[0]?.status).toBe("retry_required");
    expect(scheduledRetestStatusLabel(state.milestones[0]?.status)).toBe("自动复测失败，需补跑");
    expect(state.nextMilestone?.key).toBe("t2");
    expect(state.retryRequired).toBe(true);
    expect(state.healthStatus).toBe("needs_attention");
  });

  it("marks an unexecuted past node overdue instead of pending", () => {
    const state = deriveScheduledRetestState({
      now: new Date("2026-07-14T04:00:00Z"),
      milestones: [
        { key: "light_t2", dueDate: "2026-07-12", status: "pending" },
        { key: "t2", dueDate: "2026-07-16", status: "pending" },
      ],
    });
    expect(state.milestones.map(item => item.status)).toEqual(["overdue", "pending"]);
    expect(scheduledRetestStatusLabel(state.milestones[0]?.status)).toBe("计划已过期，等待补跑");
    expect(state.nextMilestone?.key).toBe("t2");
  });

  it("separates retest history, current eligibility, report availability and effect closure", () => {
    expect(deriveRetestReportState({
      hasRetestRecord: true,
      currentRetestReadyCount: 0,
      automaticStatus: "failed",
      retryRequired: true,
      reportPageAvailable: true,
      formalMonthlyReportGenerated: false,
      effectLoopCompleted: false,
    })).toMatchObject({
      retestRecordLabel: "已有复测记录",
      currentRetestReadyCount: 0,
      planRetryRequired: true,
      reportPageAvailable: true,
      formalMonthlyReportGenerated: false,
      effectLoopCompleted: false,
    });
  });

  it("restores the honest Top 3 asset tasks without the four conflicting states", () => {
    const page = read("client/src/pages/MonthlyPlanPage.tsx");
    for (const marker of [
      "补业务定义资产：建设官网同主题定义页",
      "补可信信源资产：新增第三方公开证据",
      "补第二个 AI 问题占位资产",
      "生成本月资产建设计划",
    ]) expect(page).toContain(marker);
    expect(page).toContain("optimizationBriefQuery.isLoading && !plan");
    expect(page).not.toContain("当前缺少可用的本月服务事项");
  });

  it("keeps the real Zhihu evidence and removes the unexplained dual score from workspace core metrics", () => {
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    const assets = read("shared/brandAssets.ts");
    const metricSection = workspace.slice(workspace.indexOf("const customerCoreMetrics"), workspace.indexOf("const customerIssues"));
    expect(metricSection).toContain("AI 品牌资产总分");
    expect(metricSection).not.toContain("AI 成熟度");
    expect(assets).toContain("https://zhuanlan.zhihu.com/p/2058633582978060994");
    expect(assets).toContain("07/12 节点待补跑");
  });
});

import { describe, expect, it } from "vitest";
import type { GeoBusinessMaturityReport } from "./geoBusinessMaturity";
import { buildMonthlyOptimizationBrief } from "./monthlyOptimizationBrief";

const maturityReport: GeoBusinessMaturityReport = {
  projectId: 210001,
  enterpriseName: "海豚知道",
  totalScore: 58,
  level: "初步建立",
  summary: "海豚知道处于初步建立阶段。",
  generatedAt: "2026-06-27T00:00:00.000Z",
  nextAction: "推进内容资产生成与发布",
  dimensions: [
    {
      key: "contentExecution",
      name: "内容资产执行",
      score: 20,
      status: "poor",
      explanation: "内容资产还没有形成稳定执行闭环。",
      evidence: ["内容主题 7 个", "已生成文章 2 篇"],
      nextAction: "推进本月 Top 3 内容任务",
    },
    {
      key: "retestDelivery",
      name: "复测与交付证明",
      score: 25,
      status: "poor",
      explanation: "复测和交付证明还不完整。",
      evidence: ["交付报告 0 份"],
      nextAction: "发布后按节奏复测",
    },
    {
      key: "aiVisibility",
      name: "AI 可见与推荐表现",
      score: 50,
      status: "warning",
      explanation: "AI 提及或推荐仍不稳定。",
      evidence: ["AI 实测 100 次"],
      nextAction: "围绕低提及问题补内容",
    },
    {
      key: "profile",
      name: "品牌档案完整度",
      score: 85,
      status: "good",
      explanation: "品牌基础信息已经比较完整。",
      evidence: ["已登记官网"],
      nextAction: "保持统一口径",
    },
    {
      key: "questionCoverage",
      name: "AI 搜索问题覆盖",
      score: 78,
      status: "good",
      explanation: "问题池已覆盖较多 AI 搜索场景。",
      evidence: ["已启用 55 个 AI 搜索问题"],
      nextAction: "持续补齐高价值问题",
    },
    {
      key: "sourceConsistency",
      name: "信源与证据一致性",
      score: 70,
      status: "warning",
      explanation: "公开信源有一定基础。",
      evidence: ["已记录 7 条公开信源"],
      nextAction: "补充公开信源",
    },
  ],
  topWeaknesses: [],
};

describe("monthlyOptimizationBrief", () => {
  it("builds top three priorities from the weakest maturity dimensions", () => {
    const brief = buildMonthlyOptimizationBrief({
      projectId: 210001,
      maturityReport,
      plan: { status: "active", roundNumber: 1 },
      tasks: [],
    });
    expect(brief.priorities).toHaveLength(3);
    expect(brief.priorities.map(p => p.relatedDimensionKey)).toEqual([
      "contentExecution",
      "retestDelivery",
      "aiVisibility",
    ]);
    expect(brief.reviewCalendar.map(item => item.label)).toEqual(["T1", "T2", "T3"]);
  });

  it("prefers existing monthly tasks when they map to a priority dimension", () => {
    const brief = buildMonthlyOptimizationBrief({
      projectId: 210001,
      maturityReport,
      plan: { status: "active", roundNumber: 1 },
      tasks: [
        {
          id: 1,
          title: "为未覆盖问题生成内容",
          status: "pending",
          actionUrl: "/weekly?questionId=480001",
          targetDimension: "aiTestPerformance",
          reason: "AI 实测表现偏弱",
        },
      ],
    });
    const aiPriority = brief.priorities.find(priority => priority.relatedDimensionKey === "aiVisibility");
    expect(aiPriority?.source).toBe("existing_task");
    expect(aiPriority?.tasks[0]?.id).toBe(1);
  });
});

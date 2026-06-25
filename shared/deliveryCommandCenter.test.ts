import { describe, expect, it } from "vitest";
import {
  buildDeliveryCommandCenterView,
  buildDeliveryCommandTodos,
  computeCommandCenterRenewalRisk,
  COMMAND_CENTER_RENEWAL_RISK_LABELS,
  formatCommandCenterAiDiagnosisLabel,
  formatCommandCenterCurrentStageLabel,
  formatCommandCenterSubscriptionLabel,
  formatDeliveryClientLabel,
  type DeliveryCommandProjectInput,
} from "./deliveryCommandCenter";

const baseProject = (): DeliveryCommandProjectInput => ({
  companyId: 1,
  companyName: "测试客户",
  projectId: 100,
  projectName: "测试项目",
  hasSubscription: true,
  subscriptionExpiresAt: "2026-08-01T00:00:00.000Z",
  profileCompletionScore: 90,
  profileCompletedSteps: 7,
  hasAiTest: true,
  lastAiTestAt: "2026-06-01T00:00:00.000Z",
  monthlyPlanProgress: { completedCount: 2, totalCount: 4, rate: 0.5 },
  monthlyPlanStatus: "active",
  monthlyReportStatus: "未生成",
  retestScheduledAt: null,
  retestCompletedAt: null,
  contentGeneratedCount: 3,
  contentPublishedCount: 2,
  inclusionIncludedCount: 1,
  inclusionPendingCount: 0,
  contentGeneratingCount: 0,
  contentStuckGeneratingCount: 0,
  contentPendingReviewCount: 0,
  contentPendingReviewStaleCount: 0,
  contentGeneratedThisMonthCount: 2,
  contentPublishedThisMonthCount: 1,
  currentMonthPlanRate: 0.5,
  recentTwoMonthPlanRates: [0.4, 0.3],
  lastActivityAt: "2026-06-10T00:00:00.000Z",
  lastReportAt: null,
});

describe("deliveryCommandCenter", () => {
  it("computes renewal risk per command center rules", () => {
    expect(
      computeCommandCenterRenewalRisk({
        hasSubscription: true,
        daysUntilExpiry: 20,
        currentMonthPlanRate: 0.3,
        recentTwoMonthPlanRates: [],
      }),
    ).toBe("high");
    expect(
      computeCommandCenterRenewalRisk({
        hasSubscription: true,
        daysUntilExpiry: 45,
        currentMonthPlanRate: 0.8,
        recentTwoMonthPlanRates: [],
      }),
    ).toBe("attention");
    expect(
      computeCommandCenterRenewalRisk({
        hasSubscription: true,
        daysUntilExpiry: 120,
        currentMonthPlanRate: 0.8,
        recentTwoMonthPlanRates: [0.3, 0.4],
      }),
    ).toBe("attention");
    expect(
      computeCommandCenterRenewalRisk({
        hasSubscription: true,
        daysUntilExpiry: 120,
        currentMonthPlanRate: 0.8,
        recentTwoMonthPlanRates: [0.8, 0.9],
      }),
    ).toBe("normal");
  });

  it("downgrades renewal risk when subscription is missing", () => {
    expect(
      computeCommandCenterRenewalRisk({
        hasSubscription: false,
        daysUntilExpiry: null,
        currentMonthPlanRate: 0,
        recentTwoMonthPlanRates: [],
        hasUnfinishedContent: true,
      }),
    ).toBe("attention");
    expect(
      computeCommandCenterRenewalRisk({
        hasSubscription: false,
        daysUntilExpiry: null,
        currentMonthPlanRate: 0,
        recentTwoMonthPlanRates: [],
        hasUnfinishedContent: false,
      }),
    ).toBe("normal");
  });

  it("builds grouped todos and overview without engineering field names", () => {
    const project = {
      ...baseProject(),
      profileCompletionScore: 60,
      contentStuckGeneratingCount: 1,
      monthlyPlanProgress: { completedCount: 4, totalCount: 4, rate: 1 },
      monthlyReportStatus: "未生成",
    };
    const view = buildDeliveryCommandCenterView([project], new Date("2026-06-15T00:00:00.000Z"));
    expect(view.todos.urgent.some(item => item.description.includes("月报已到期未生成"))).toBe(true);
    expect(view.todos.pending.some(item => item.description.includes("建档未完成"))).toBe(true);
    expect(view.overview[0]?.renewalRiskLabel).toBe(COMMAND_CENTER_RENEWAL_RISK_LABELS.attention);
    expect(view.overview[0]?.currentStageLabel).toContain("建档中");
    expect(view.overview[0]?.contentAssetsLabel).toContain("已生成");
    expect(JSON.stringify(view)).not.toContain("scene_need");
  });

  it("formats client label for multi-project companies", () => {
    expect(
      formatDeliveryClientLabel({
        companyName: "海豚知道",
        projectName: "华东事业部",
        projectId: 12,
        companyProjectCount: 2,
      }),
    ).toBe("海豚知道 · 华东事业部");
    expect(
      formatDeliveryClientLabel({
        companyName: "海豚知道",
        projectName: "海豚知道",
        projectId: 12,
        companyProjectCount: 2,
      }),
    ).toBe("海豚知道 · 项目#12");
    expect(
      formatDeliveryClientLabel({
        companyName: "海豚知道",
        projectName: "海豚知道",
        projectId: 12,
        companyProjectCount: 1,
      }),
    ).toBe("海豚知道");
  });

  it("shows unconfigured subscription label and count", () => {
    const view = buildDeliveryCommandCenterView(
      [{ ...baseProject(), hasSubscription: false, subscriptionExpiresAt: null }],
      new Date("2026-06-15T00:00:00.000Z"),
    );
    expect(view.overview[0]?.subscriptionLabel).toBe("未配置");
    expect(view.unconfiguredSubscriptionCount).toBe(1);
    expect(
      formatCommandCenterSubscriptionLabel({
        hasSubscription: false,
        subscriptionExpiresAt: null,
      }),
    ).toBe("未配置");
  });

  it("merges current stage labels", () => {
    expect(
      formatCommandCenterCurrentStageLabel({
        profileCompletionScore: 60,
        profileCompletedSteps: 4,
        profileTotalSteps: 8,
        hasAiTest: false,
        monthlyPlanStatus: "none",
        completedCount: 0,
        totalCount: 0,
      }),
    ).toBe("建档中 4/8步");
    expect(
      formatCommandCenterCurrentStageLabel({
        profileCompletionScore: 90,
        profileCompletedSteps: 7,
        profileTotalSteps: 8,
        hasAiTest: false,
        monthlyPlanStatus: "none",
        completedCount: 0,
        totalCount: 0,
      }),
    ).toBe("待诊断");
    expect(
      formatCommandCenterCurrentStageLabel({
        profileCompletionScore: 90,
        profileCompletedSteps: 8,
        profileTotalSteps: 8,
        hasAiTest: true,
        monthlyPlanStatus: "active",
        completedCount: 1,
        totalCount: 4,
      }),
    ).toBe("执行中 1/4");
  });

  it("formats ai diagnosis label for customers", () => {
    expect(
      formatCommandCenterAiDiagnosisLabel({
        hasAiTest: false,
        lastAiTestAt: null,
      }),
    ).toBe("未开始");
    expect(
      formatCommandCenterAiDiagnosisLabel({
        hasAiTest: true,
        lastAiTestAt: "2026-06-14T00:00:00.000Z",
        now: new Date("2026-06-15T00:00:00.000Z"),
      }),
    ).toContain("1 天前");
  });

  it("creates urgent todo when subscription expires within 7 days", () => {
    const todos = buildDeliveryCommandTodos(
      [
        {
          ...baseProject(),
          subscriptionExpiresAt: "2026-06-18T00:00:00.000Z",
        },
      ],
      new Date("2026-06-15T00:00:00.000Z"),
    );
    expect(todos.urgent.some(item => item.description.includes("天内到期"))).toBe(true);
  });

  it("adds client labels to todos for multi-project companies", () => {
    const incomplete = {
      ...baseProject(),
      profileCompletionScore: 60,
      hasAiTest: false,
    };
    const todos = buildDeliveryCommandTodos(
      [
        { ...incomplete, companyId: 1, projectId: 101, projectName: "项目A" },
        { ...incomplete, companyId: 1, projectId: 102, projectName: "项目B" },
      ],
      new Date("2026-06-15T00:00:00.000Z"),
    );
    const allTodos = [...todos.urgent, ...todos.pending, ...todos.inProgress];
    expect(allTodos.length).toBeGreaterThan(0);
    expect(allTodos.some(item => item.clientLabel === "测试客户 · 项目A")).toBe(true);
    expect(allTodos.some(item => item.clientLabel === "测试客户 · 项目B")).toBe(true);
  });
});

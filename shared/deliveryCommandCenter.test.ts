import { describe, expect, it } from "vitest";
import {
  buildDeliveryCommandCenterView,
  buildDeliveryCommandTodos,
  computeCommandCenterRenewalRisk,
  COMMAND_CENTER_RENEWAL_RISK_LABELS,
  formatCommandCenterAiDiagnosisLabel,
  type DeliveryCommandProjectInput,
} from "./deliveryCommandCenter";

const baseProject = (): DeliveryCommandProjectInput => ({
  companyId: 1,
  companyName: "测试客户",
  projectId: 100,
  projectName: "测试项目",
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
        daysUntilExpiry: 20,
        currentMonthPlanRate: 0.3,
        recentTwoMonthPlanRates: [],
      }),
    ).toBe("high");
    expect(
      computeCommandCenterRenewalRisk({
        daysUntilExpiry: 45,
        currentMonthPlanRate: 0.8,
        recentTwoMonthPlanRates: [],
      }),
    ).toBe("attention");
    expect(
      computeCommandCenterRenewalRisk({
        daysUntilExpiry: 120,
        currentMonthPlanRate: 0.8,
        recentTwoMonthPlanRates: [0.3, 0.4],
      }),
    ).toBe("attention");
    expect(
      computeCommandCenterRenewalRisk({
        daysUntilExpiry: 120,
        currentMonthPlanRate: 0.8,
        recentTwoMonthPlanRates: [0.8, 0.9],
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
    expect(JSON.stringify(view)).not.toContain("scene_need");
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
});

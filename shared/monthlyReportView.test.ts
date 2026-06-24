import { describe, expect, it } from "vitest";
import {
  buildMonthlyReportCompetitorRateExplanation,
  buildMonthlyReportContentAssetProof,
  buildMonthlyReportRenewalJustification,
  buildMonthlyReportView,
  computeAiTestRatesFromRuns,
  formatMonthlyReportMetricCount,
  formatMonthlyReportMetricPercent,
  formatMonthlyReportMaturityChange,
  formatMonthlyReportPeriodLabel,
  formatMonthlyReportRateChange,
  splitAiTestRunsByPlanPeriod,
} from "./monthlyReportView";

describe("monthlyReportView", () => {
  const basePlan = {
    id: 1,
    roundNumber: 2,
    status: "active" as const,
    baselineMaturityScore: 52,
    baselineDimensionScores: {
      brandIdentity: 40,
      categoryPositioning: 45,
      questionCoverage: 30,
      sourceGraph: 55,
      trustEvidence: 50,
      aiTestPerformance: 35,
    },
    resultMaturityScore: null,
    resultDimensionScores: null,
    generatedAt: "2026-06-01T08:00:00.000Z",
    retestScheduledAt: "2026-06-08T08:00:00.000Z",
    retestCompletedAt: null,
  };

  it("formats period label and rate change placeholders", () => {
    expect(formatMonthlyReportPeriodLabel("2026-06-01T08:00:00.000Z", 2)).toContain("2026");
    expect(formatMonthlyReportRateChange(0.2, null)).toContain("当前基线：20%");
    expect(formatMonthlyReportRateChange(0.2, null)).toContain("复测完成后生成对比");
    expect(formatMonthlyReportRateChange(null, null)).toBe("尚未建立基线");
    expect(formatMonthlyReportMaturityChange(52, null)).toContain("52分");
  });

  it("computes mention and recommend rates from ai test runs", () => {
    const rates = computeAiTestRatesFromRuns([
      { mentionedCompany: true, recommendedCompany: false, platform: "豆包" },
      { mentionedCompany: false, recommendedCompany: true, platform: "豆包" },
      { mentionedCompany: true, recommendedCompany: true, platform: "Kimi" },
    ]);
    expect(rates.mentionRate).toBeCloseTo(2 / 3);
    expect(rates.recommendRate).toBeCloseTo(2 / 3);
    expect(rates.byPlatform).toHaveLength(2);
  });

  it("splits ai test runs by plan generatedAt", () => {
    const split = splitAiTestRunsByPlanPeriod(
      [
        { testedAt: "2026-05-30T00:00:00.000Z", mentionedCompany: true },
        { testedAt: "2026-06-05T00:00:00.000Z", mentionedCompany: false },
      ],
      "2026-06-01T08:00:00.000Z",
    );
    expect(split.baselineRuns).toHaveLength(1);
    expect(split.periodRuns).toHaveLength(1);
  });

  it("builds executing empty state when no retest data", () => {
    const view = buildMonthlyReportView({
      plan: basePlan,
      tasks: [
        { id: 1, taskType: "content_generation", title: "t1", status: "completed", relatedQuestionId: 1, linkedEntityId: 1, metadata: { focusSummary: "搜索问题覆盖度" }, completedAt: null },
        { id: 2, taskType: "evidence_addition", title: "t2", status: "pending", relatedQuestionId: null, linkedEntityId: null, metadata: null, completedAt: null },
      ],
      planPhase: "executing",
      aiTestRuns: [
        { testedAt: "2026-05-30T00:00:00.000Z", mentionedCompany: true, recommendedCompany: false, platform: "豆包" },
        { testedAt: "2026-05-30T01:00:00.000Z", mentionedCompany: false, recommendedCompany: false, platform: "豆包" },
        { testedAt: "2026-05-30T02:00:00.000Z", mentionedCompany: false, recommendedCompany: true, platform: "Kimi" },
      ],
      contentItems: [],
      sourceItems: [],
      evidenceItems: [],
      latestTotalScore: 52,
      latestDimensionScores: basePlan.baselineDimensionScores,
      historyPlans: [{ plan: basePlan, progress: { completedCount: 1, totalCount: 2 } }],
    });
    expect(view.showExecutingEmpty).toBe(true);
    expect(view.executingMessage).toContain("1/2");
    expect(view.summary.pendingLabel).toBe("复测完成后自动生成");
    expect(view.summary.mentionRateBaseline).toBeCloseTo(1 / 3);
    expect(view.weakDimensionChanges.length).toBeGreaterThan(0);
  });

  it("builds completed report with retest summary", () => {
    const completedPlan = {
      ...basePlan,
      status: "completed" as const,
      resultMaturityScore: 61,
      resultDimensionScores: {
        brandIdentity: 45,
        categoryPositioning: 50,
        questionCoverage: 42,
        sourceGraph: 58,
        trustEvidence: 55,
        aiTestPerformance: 48,
      },
      retestCompletedAt: "2026-06-15T10:00:00.000Z",
    };
    const view = buildMonthlyReportView({
      plan: completedPlan,
      tasks: [],
      planPhase: "completed",
      aiTestRuns: [
        { testedAt: "2026-05-30T00:00:00.000Z", mentionedCompany: false, recommendedCompany: false, platform: "豆包" },
        { testedAt: "2026-06-12T00:00:00.000Z", mentionedCompany: true, recommendedCompany: true, platform: "豆包" },
      ],
      contentItems: [{ articleId: 1, title: "文章A", platform: "知乎", publishedAt: "2026-06-03", questionText: "问题1" }],
      sourceItems: [{ id: 1, name: "百度百科", type: "百科", adoptedAt: "2026-06-04" }],
      evidenceItems: [{ id: 1, title: "媒体报道", type: "media_report", addedAt: "2026-06-05" }],
      latestTotalScore: 61,
      latestDimensionScores: completedPlan.resultDimensionScores,
      historyPlans: [{ plan: completedPlan, progress: { completedCount: 4, totalCount: 4 } }],
    });
    expect(view.hasRetestData).toBe(true);
    expect(view.summary.maturityDelta).toBe(9);
    expect(view.actions.contentCount).toBe(1);
    expect(view.retest?.platformChanges.length).toBeGreaterThan(0);
    expect(view.nextMonth.canGenerateNextPlan).toBe(true);
  });

  it("builds content asset renewal proof from effect rows", () => {
    const proof = buildMonthlyReportContentAssetProof({
      publishedCount: 3,
      rows: [
        {
          id: 1,
          articleId: 1,
          title: "内容资产A",
          platform: "知乎",
          questionText: "怎么选择方案",
          publishedAt: "2026-06-01T00:00:00.000Z",
          publicUrl: "https://example.com/a",
          effectInclusionStatus: "included",
          inclusionVerifiedAt: "2026-06-04T00:00:00.000Z",
          readCount: 120,
          impressionCount: 900,
          interactionCount: 8,
          searchTriggerKeywords: ["品牌方案", "AI 推荐"],
          effectDataSource: "manual",
          evidenceScreenshotUrl: "https://example.com/s.png",
        },
        {
          id: 2,
          articleId: 2,
          title: "内容资产B",
          platform: "小红书",
          questionText: "行业服务哪家好",
          publishedAt: "2026-06-02T00:00:00.000Z",
          publicUrl: "https://example.com/b",
          effectInclusionStatus: "pending",
          readCount: 30,
          impressionCount: 200,
          interactionCount: 2,
        },
      ],
    });

    expect(proof.includedCount).toBe(1);
    expect(proof.inclusionRate).toBe(33);
    expect(proof.averageInclusionDays).toBe(3);
    expect(proof.totalReadCount).toBe(150);
    expect(proof.totalImpressionCount).toBe(1100);
    expect(proof.totalInteractionCount).toBe(10);
    expect(proof.triggeredKeywordCount).toBe(2);
    expect(proof.keywordTriggeredContentCount).toBe(1);
    expect(proof.screenshotEvidenceCount).toBe(1);
    expect(proof.retestReadyCount).toBeGreaterThanOrEqual(1);
    expect(proof.hasInclusionData).toBe(true);
  });

  it("formats missing metrics as --", () => {
    expect(formatMonthlyReportMetricCount(null)).toBe("--");
    expect(formatMonthlyReportMetricPercent(null)).toBe("--");
  });

  it("builds competitor rate explanation with month-over-month delta", () => {
    const higher = buildMonthlyReportCompetitorRateExplanation({
      currentRate: 0.5,
      previousMonthRate: 0.3,
    });
    expect(higher).toContain("本月竞品出现率50%");
    expect(higher).toContain("上升了20个百分点");

    const lower = buildMonthlyReportCompetitorRateExplanation({
      currentRate: 0.2,
      previousMonthRate: 0.35,
    });
    expect(lower).toContain("下降了15个百分点");

    const noCompare = buildMonthlyReportCompetitorRateExplanation({
      currentRate: 0.4,
      previousMonthRate: null,
    });
    expect(noCompare).toContain("暂无上月对比数据");
  });

  it("builds renewal justification from real metrics", () => {
    const renewal = buildMonthlyReportRenewalJustification({
      publishCount: 3,
      questionCoverageCount: 2,
      includedCount: 1,
      totalReadCount: 100,
      totalImpressionCount: 500,
      competitorRate: 0.45,
      competitorSceneType: "品类推荐",
      uncoveredQuestionCount: 8,
      recommendRate: 0.2,
    });
    expect(renewal.hasData).toBe(true);
    expect(renewal.completedLines.join("\n")).toContain("发布 3 篇内容");
    expect(renewal.opportunityLines.join("\n")).toContain("品类推荐");
    expect(renewal.nextMonthLines).toHaveLength(3);

    const empty = buildMonthlyReportRenewalJustification({
      publishCount: null,
      questionCoverageCount: null,
      includedCount: null,
      totalReadCount: null,
      totalImpressionCount: null,
      competitorRate: null,
      competitorSceneType: null,
      uncoveredQuestionCount: null,
      recommendRate: null,
    });
    expect(empty.hasData).toBe(false);
    expect(empty.emptyMessage).toContain("完成本月AI复测后");
  });

  it("includes renewal justification in monthly report view", () => {
    const view = buildMonthlyReportView({
      plan: basePlan,
      tasks: [],
      planPhase: "executing",
      aiTestRuns: [
        {
          questionId: 1,
          testedAt: "2026-06-05T00:00:00.000Z",
          mentionedCompany: true,
          recommendedCompany: false,
          competitorMentioned: true,
          platform: "豆包",
        },
      ],
      contentItems: [{ articleId: 1, title: "文章", platform: "知乎", publishedAt: "2026-06-03", questionText: "Q1" }],
      contentAssetEffectRows: [
        {
          id: 1,
          articleId: 1,
          title: "文章",
          platform: "知乎",
          questionText: "Q1",
          publishedAt: "2026-06-03T00:00:00.000Z",
          publicUrl: "https://example.com/a",
          effectInclusionStatus: "included",
          inclusionVerifiedAt: "2026-06-06T00:00:00.000Z",
        },
      ],
      sourceItems: [],
      evidenceItems: [],
      latestTotalScore: 52,
      latestDimensionScores: basePlan.baselineDimensionScores,
      uncoveredQuestionCount: 5,
      questionTypeByQuestionId: new Map([[1, "行业推荐"]]),
      historyPlans: [{ plan: basePlan, progress: { completedCount: 1, totalCount: 2 } }],
    });
    expect(view.summary.competitorRateExplanation).toContain("本月竞品出现率");
    expect(view.renewalJustification.hasData).toBe(true);
    expect(view.actions.contentAssetProof.hasInclusionData).toBe(true);
  });
});

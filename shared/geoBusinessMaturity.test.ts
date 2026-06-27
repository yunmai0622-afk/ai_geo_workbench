import { describe, expect, it } from "vitest";
import {
  buildGeoBusinessMaturityReport,
  resolveGeoBusinessMaturityLevel,
} from "./geoBusinessMaturity";

const emptyInput = {
  projectId: 180001,
  enterpriseName: "海豚知道",
  profile: null,
  questionStats: {
    totalCount: 0,
    enabledCount: 0,
    coveredTypeCount: 0,
    targetTypeCount: 6,
    contentLinkedCount: 0,
    highPriorityCount: 0,
  },
  aiTestStats: {
    totalRuns: 0,
    mentionedCount: 0,
    recommendedCount: 0,
    sourceLinkCount: 0,
    competitorMentionedCount: 0,
  },
  sourceStats: {
    brandSourceCount: 0,
    platformCount: 0,
    officialSourceCount: 0,
    aiCitationConfirmedCount: 0,
    entityCheckCount: 0,
    entityConsistentCount: 0,
    verifiedTrustEvidenceCount: 0,
    customerCaseCount: 0,
  },
  contentStats: {
    optimizationTaskCount: 0,
    monthlyTaskCount: 0,
    completedMonthlyTaskCount: 0,
    articleTopicCount: 0,
    articleCount: 0,
    publishedArticleCount: 0,
    publishRecordCount: 0,
    publishTaskCount: 0,
    completedPublishTaskCount: 0,
  },
  retestStats: {
    baselineRoundCount: 0,
    retestRoundCount: 0,
    completedRetestRoundCount: 0,
    inclusionRecordCount: 0,
    inclusionVerifiedCount: 0,
    aiMentionMonitoringCount: 0,
    reportCount: 0,
  },
};

describe("geoBusinessMaturity", () => {
  it("returns a safe six-dimension report when project data is empty", () => {
    const report = buildGeoBusinessMaturityReport(emptyInput);
    expect(report.totalScore).toBe(0);
    expect(report.level).toBe("基础薄弱");
    expect(report.dimensions).toHaveLength(6);
    expect(report.topWeaknesses).toHaveLength(3);
    expect(report.dimensions.every(dimension => dimension.status === "poor")).toBe(true);
    expect(report.summary).toContain("海豚知道");
  });

  it("maps score ranges to customer-facing maturity levels", () => {
    expect(resolveGeoBusinessMaturityLevel(39)).toBe("基础薄弱");
    expect(resolveGeoBusinessMaturityLevel(40)).toBe("初步建立");
    expect(resolveGeoBusinessMaturityLevel(60)).toBe("基础成型");
    expect(resolveGeoBusinessMaturityLevel(75)).toBe("增长优化中");
    expect(resolveGeoBusinessMaturityLevel(90)).toBe("高可见度品牌");
  });

  it("uses real operational signals across content, source, AI test, and retest dimensions", () => {
    const report = buildGeoBusinessMaturityReport({
      ...emptyInput,
      profile: {
        enterpriseName: "海豚知道",
        officialWebsite: "https://www.htknow.com",
        oneLiner: "AI 知识服务品牌",
        industryTag: "知识付费",
        targetCustomers: "企业主",
        coreSellingPoints: "搜索可见性",
        competitorDifference: "强调 AI 搜索场景",
        completionScore: 90,
        keyPoints: ["AI 搜索", "内容资产", "月报"],
        keywords: ["GEO", "AI 搜索", "知识服务"],
      },
      questionStats: {
        totalCount: 55,
        enabledCount: 55,
        coveredTypeCount: 6,
        targetTypeCount: 6,
        contentLinkedCount: 20,
        highPriorityCount: 12,
      },
      aiTestStats: {
        totalRuns: 100,
        mentionedCount: 70,
        recommendedCount: 45,
        sourceLinkCount: 30,
        competitorMentionedCount: 10,
      },
      sourceStats: {
        brandSourceCount: 8,
        platformCount: 4,
        officialSourceCount: 1,
        aiCitationConfirmedCount: 2,
        entityCheckCount: 4,
        entityConsistentCount: 4,
        verifiedTrustEvidenceCount: 5,
        customerCaseCount: 2,
      },
      contentStats: {
        optimizationTaskCount: 3,
        monthlyTaskCount: 6,
        completedMonthlyTaskCount: 3,
        articleTopicCount: 7,
        articleCount: 4,
        publishedArticleCount: 2,
        publishRecordCount: 2,
        publishTaskCount: 3,
        completedPublishTaskCount: 1,
      },
      retestStats: {
        baselineRoundCount: 1,
        retestRoundCount: 3,
        completedRetestRoundCount: 1,
        inclusionRecordCount: 3,
        inclusionVerifiedCount: 1,
        aiMentionMonitoringCount: 2,
        reportCount: 1,
      },
    });
    expect(report.totalScore).toBeGreaterThan(60);
    expect(report.dimensions.find(d => d.key === "contentExecution")?.evidence.join("")).toContain("已生成文章");
    expect(report.dimensions.find(d => d.key === "retestDelivery")?.nextAction).toContain("月报证明");
  });
});

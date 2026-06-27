import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { buildGeoBusinessMaturityReport } from "@shared/geoBusinessMaturity";
import {
  aiTestRuns,
  brandSourceRecords,
  customerCases,
  enterpriseGeoProfiles,
  entityConsistencyChecks,
  geoArticles,
  geoArticleTopics,
  geoInclusionMonitoringRecords,
  geoPublishRecords,
  monthlyOptimizationPlans,
  monthlyOptimizationTasks,
  optimizationTasks,
  projects,
  publishTasks,
  questions,
  reports,
  testRounds,
  trustEvidenceItems,
} from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  return db;
}

function isEnabled(value: number | boolean | null | undefined): boolean {
  if (typeof value === "boolean") return value;
  return value !== 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const value = text(status).toLowerCase();
  return ["completed", "success", "published", "done", "已完成", "已发布", "发布成功"].includes(value);
}

function isPublishedArticle(article: typeof geoArticles.$inferSelect): boolean {
  return Boolean(
    article.publishedAt ||
      isCompletedStatus(article.lifecycleStatus) ||
      isCompletedStatus(article.status) ||
      text(article.publicPath),
  );
}

function isInclusionVerified(record: typeof geoInclusionMonitoringRecords.$inferSelect): boolean {
  return (
    record.effectInclusionStatus === "已收录" ||
    record.inclusionMonitorStatus === "已收录" ||
    Boolean(record.inclusionVerifiedAt)
  );
}

export async function getGeoBusinessMaturityReport(projectId: number) {
  const db = await requireDb();
  const [
    projectRows,
    profileRows,
    questionRows,
    aiRunRows,
    sourceRows,
    entityCheckRows,
    trustRows,
    customerCaseRows,
    optimizationTaskRows,
    monthlyPlanRows,
    monthlyTaskRows,
    topicRows,
    articleRows,
    publishTaskRows,
    publishRecordRows,
    inclusionRows,
    reportRows,
    testRoundRows,
  ] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).limit(1),
    db.select().from(questions).where(eq(questions.projectId, projectId)),
    db.select().from(aiTestRuns).where(eq(aiTestRuns.projectId, projectId)),
    db.select().from(brandSourceRecords).where(eq(brandSourceRecords.projectId, projectId)),
    db.select().from(entityConsistencyChecks).where(eq(entityConsistencyChecks.projectId, projectId)),
    db.select().from(trustEvidenceItems).where(eq(trustEvidenceItems.projectId, projectId)),
    db.select().from(customerCases).where(eq(customerCases.projectId, projectId)),
    db.select().from(optimizationTasks).where(eq(optimizationTasks.projectId, projectId)),
    db.select().from(monthlyOptimizationPlans).where(eq(monthlyOptimizationPlans.projectId, projectId)),
    db.select().from(monthlyOptimizationTasks).where(eq(monthlyOptimizationTasks.projectId, projectId)),
    db.select().from(geoArticleTopics).where(eq(geoArticleTopics.projectId, projectId)),
    db.select().from(geoArticles).where(eq(geoArticles.projectId, projectId)),
    db.select().from(publishTasks).where(eq(publishTasks.projectId, projectId)),
    db.select().from(geoPublishRecords).where(eq(geoPublishRecords.projectId, projectId)),
    db.select().from(geoInclusionMonitoringRecords).where(eq(geoInclusionMonitoringRecords.projectId, projectId)),
    db.select().from(reports).where(eq(reports.projectId, projectId)),
    db.select().from(testRounds).where(eq(testRounds.projectId, projectId)),
  ]);

  const project = projectRows[0] ?? null;
  const profile = profileRows[0] ?? null;
  const enabledQuestions = questionRows.filter(question => isEnabled(question.enabled));
  const coveredTypes = new Set(enabledQuestions.map(question => question.searchPoolType).filter(Boolean));
  const highPriorityQuestions = enabledQuestions.filter(
    question => question.priorityLevel === "high" || question.businessValue >= 4,
  );
  const sourcePlatforms = new Set(sourceRows.map(source => source.platform || source.platformName).filter(Boolean));
  const completedMonthlyTasks = monthlyTaskRows.filter(task => task.status === "completed");
  const completedPublishTasks = publishTaskRows.filter(task => isCompletedStatus(task.status));
  const baselineRounds = testRoundRows.filter(round => round.roundType === "T0_BASELINE");
  const retestRounds = testRoundRows.filter(round => round.roundType !== "T0_BASELINE");
  const completedRetestRounds = retestRounds.filter(round => round.status === "completed");
  const aiMentionMonitoringRows = inclusionRows.filter(
    row =>
      row.aiMentionMonitorStatus === "已提及" ||
      row.aiRecommendMonitorStatus === "已推荐" ||
      Boolean(row.lastAiTestedAt) ||
      (row.aiTestResults?.length ?? 0) > 0,
  );

  return buildGeoBusinessMaturityReport({
    projectId,
    enterpriseName: project?.enterpriseName ?? profile?.enterpriseName ?? null,
    profile: profile
      ? {
          enterpriseName: profile.enterpriseName,
          brandName: profile.brandName,
          officialWebsite: profile.officialWebsite,
          oneLiner: profile.oneLiner,
          industry: profile.industry,
          industryTag: profile.industryTag,
          productDesc: profile.productDesc,
          productServiceIntro: profile.productServiceIntro,
          targetCustomers: profile.targetCustomers,
          coreSellingPoints: profile.coreSellingPoints,
          competitorDifference: profile.competitorDifference,
          completionScore: profile.completionScore,
          keyPoints: profile.keyPoints,
          keywords: profile.keywords,
        }
      : null,
    questionStats: {
      totalCount: questionRows.length,
      enabledCount: enabledQuestions.length,
      coveredTypeCount: coveredTypes.size,
      targetTypeCount: 6,
      contentLinkedCount: enabledQuestions.filter(question => Boolean(question.relatedContentTask)).length,
      highPriorityCount: highPriorityQuestions.length,
    },
    aiTestStats: {
      totalRuns: aiRunRows.length,
      mentionedCount: aiRunRows.filter(run => run.mentionedCompany).length,
      recommendedCount: aiRunRows.filter(run => run.recommendedCompany).length,
      sourceLinkCount: aiRunRows.filter(run => run.hasSourceLinks || (run.sourceLinks?.length ?? 0) > 0).length,
      competitorMentionedCount: aiRunRows.filter(run => run.competitorMentioned).length,
    },
    sourceStats: {
      brandSourceCount: sourceRows.length,
      platformCount: sourcePlatforms.size,
      officialSourceCount: sourceRows.filter(source => source.platform === "official_site" || source.containsOfficialSite).length,
      aiCitationConfirmedCount: sourceRows.filter(source => source.aiCitationConfirmed).length,
      entityCheckCount: entityCheckRows.length,
      entityConsistentCount: entityCheckRows.filter(check => check.status === "consistent").length,
      verifiedTrustEvidenceCount: trustRows.filter(item => item.verificationStatus === "verified").length,
      customerCaseCount: customerCaseRows.length,
    },
    contentStats: {
      optimizationTaskCount: optimizationTaskRows.length,
      monthlyTaskCount: monthlyTaskRows.length,
      completedMonthlyTaskCount: completedMonthlyTasks.length,
      articleTopicCount: topicRows.length,
      articleCount: articleRows.length,
      publishedArticleCount: articleRows.filter(isPublishedArticle).length,
      publishRecordCount: publishRecordRows.length,
      publishTaskCount: publishTaskRows.length,
      completedPublishTaskCount: completedPublishTasks.length,
    },
    retestStats: {
      baselineRoundCount: baselineRounds.length,
      retestRoundCount: retestRounds.length,
      completedRetestRoundCount: completedRetestRounds.length,
      inclusionRecordCount: inclusionRows.length,
      inclusionVerifiedCount: inclusionRows.filter(isInclusionVerified).length,
      aiMentionMonitoringCount: aiMentionMonitoringRows.length,
      reportCount: reportRows.length,
    },
  });
}

import { describe, expect, it } from "vitest";
import { buildWorkspaceTodayTasks } from "./workspaceTodayTasks";

const baseMetrics = {
  profileCompletionPercent: 100,
  boundPublishAccountCount: 1,
  expiredSessionAccountCount: 0,
  articleCount: 2,
  publishRecordCount: 1,
  publishRecordWithPublicUrlCount: 1,
  waitingPublicLinkCount: 0,
  publishTaskCount: 1,
  completedPublishTaskCount: 1,
  retestPendingCount: 0,
  rewriteOpenCount: 0,
  aiTestResultCount: 3,
  monitoringRecordCount: 1,
  retestComparisonCount: 0,
  reportCount: 0,
  geoScore: 70,
  brandMentionRate: 0.4,
  recommendRate: 0.2,
  lowQualityArticleCount: 0,
  hasAnalysis: true,
  hasGeoScore: true,
  hasCompletedT0Baseline: true,
  hasCompletedT1Retest: false,
  showT1RetestAutoTriggerReminder: false,
  p0ProfileComplete: true,
  retestPlan: { stages: [] } as any,
  retestDueReminder: null,
  pendingPublishContentCount: 0,
  lastDiagnosisAt: new Date().toISOString(),
};

describe("buildWorkspaceTodayTasks", () => {
  it("includes profile and diagnosis tasks when prerequisites are missing", () => {
    const tasks = buildWorkspaceTodayTasks({
      projectId: 90001,
      ...baseMetrics,
      p0ProfileComplete: false,
      profileCompletionPercent: 55,
      hasAnalysis: false,
      hasGeoScore: false,
      hasCompletedT0Baseline: false,
      lastDiagnosisAt: null,
    });
    expect(tasks.some(task => task.key === "complete_profile")).toBe(true);
    expect(tasks.some(task => task.key === "start_ai_diagnosis")).toBe(false);
  });

  it("builds actionable tasks with project scoped paths", () => {
    const tasks = buildWorkspaceTodayTasks({
      projectId: 90001,
      ...baseMetrics,
      pendingPublishContentCount: 2,
      waitingPublicLinkCount: 1,
      publishRecordWithPublicUrlCount: 1,
    });
    const contentTask = tasks.find(task => task.key === "process_pending_content");
    expect(contentTask?.targetPath).toBe("/weekly?projectId=90001");
    expect(contentTask?.actionLabel).toBe("去处理内容");
    expect(tasks.find(task => task.key === "fill_public_links")?.targetPath).toContain("/content-publishing?projectId=90001");
    expect(tasks.find(task => task.key === "run_inclusion_retest")?.targetPath).toBe(
      "/inclusion-monitoring?projectId=90001",
    );
  });
});

import { describe, expect, it } from "vitest";
import { GEO_UNIFIED_MAIN_PIPELINE_STEPS } from "../shared/workspaceMainChain";
import {
  COCKPIT_PIPELINE_STEPS,
  resolveMainPipelineStepStatuses,
} from "../client/src/lib/geoProductPositioning";

describe("geoProductPositioning", () => {
  it("主链路为 8 步", () => {
    expect(GEO_UNIFIED_MAIN_PIPELINE_STEPS).toHaveLength(8);
    expect(COCKPIT_PIPELINE_STEPS).toHaveLength(8);
  });

  it("无数据时实测步骤提示发起实测", () => {
    const steps = resolveMainPipelineStepStatuses({
      profileCompletionPercent: 0,
      boundPublishAccountCount: 0,
      expiredSessionAccountCount: 0,
      articleCount: 0,
      publishRecordCount: 0,
      publishTaskCount: 0,
      completedPublishTaskCount: 0,
      retestPendingCount: 0,
      rewriteOpenCount: 0,
      aiTestResultCount: 0,
      monitoringRecordCount: 0,
      retestComparisonCount: 0,
      reportCount: 0,
      geoScore: null,
      brandMentionRate: null,
      recommendRate: null,
      lowQualityArticleCount: 0,
      hasAnalysis: false,
      hasGeoScore: false,
      hasCompletedT0Baseline: false,
      hasCompletedT1Retest: false,
      p0ProfileComplete: false,
    });
    const aiStep = steps.find(s => s.id === "ai_search_test_t0");
    expect(aiStep?.status).toBe("未开始");
    expect(aiStep?.nextAction).toContain("暂无实测结果");
  });
});

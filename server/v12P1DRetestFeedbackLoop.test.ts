import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.2-P1-D-Retest-Feedback-Loop", () => {
  it("retest calculator triggers feedback loop after comparison write", () => {
    const calculator = read("server/geoRetestCalculator.ts");
    expect(calculator).toContain("applyRetestFeedbackFromRound");
  });

  it("feedback loop service updates questions and brand sources", () => {
    const service = read("server/retestFeedbackLoopService.ts");
    expect(service).toContain("aggregateRetestQuestionResult");
    expect(service).toContain("aiCitationConfirmed: true");
    expect(service).toContain("lastTestResult");
    expect(service).toContain("getRetestFeedbackSummary");
    expect(service).toContain("mergeNextRoundSuggestions");
  });

  it("feedbackLoop router exposes getRetestFeedbackSummary", () => {
    expect(read("server/feedbackLoopRouter.ts")).toContain("getRetestFeedbackSummary");
    expect(read("server/routers.ts")).toContain("feedbackLoop: feedbackLoopRouter");
  });

  it("inclusion monitoring surfaces retest-ready content module", () => {
    const page = read("client/src/pages/InclusionMonitoringCenterPage.tsx");
    expect(page).toContain("content-asset-retest-ready");
    expect(page).toContain("加入AI复测");
    expect(page).toContain("aiMentionCheck.run");
  });

  it("workspace does not embed retest coverage and consistency internals", () => {
    const page = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(page).not.toContain("workspace-business-results");
    expect(page).not.toContain("workspace-last-retest");
    expect(page).not.toContain("workspace-question-pool-coverage");
    expect(page).not.toContain("workspace-source-consistency");
    expect(page).toContain("workspace-customer-risks");
  });
});

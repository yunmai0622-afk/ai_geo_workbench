import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P3 Content Asset Lifecycle", () => {
  const shared = read("shared/contentAssetLifecycle.ts");
  const weeklyPage = read("client/src/pages/WeeklyContentPage.tsx");
  const inclusionPage = read(
    "client/src/pages/InclusionMonitoringCenterPage.tsx"
  );
  const platformBoard = read(
    "client/src/components/weekly/PlatformContentBoard.tsx"
  );
  const taskList = read(
    "client/src/components/weekly/ContentTaskProgressionView.tsx"
  );

  it("shared lifecycle resolver covers customer-facing stages", () => {
    expect(shared).toContain("resolveContentAssetLifecycleStage");
    expect(shared).toContain("not_started");
    expect(shared).toContain("待生成");
    expect(shared).toContain("已复测");
    expect(shared).toContain("pickLaggingContentAssetLifecycleStage");
  });

  it("weekly platform cards use lifecycle labels", () => {
    expect(weeklyPage).toContain("resolveContentAssetLifecycleStage");
    expect(platformBoard).toContain("lifecycle.label");
    expect(platformBoard).toContain("contentAssetLifecycleBadgeClass");
  });

  it("inclusion monitoring shows current lifecycle stage", () => {
    expect(inclusionPage).toContain("ContentAssetLifecycleProgress");
    expect(inclusionPage).toContain("resolveMonitoringRecordLifecycle");
    expect(inclusionPage).toContain("inclusion-lifecycle-");
    expect(inclusionPage).not.toContain("effectInclusionStatus");
  });

  it("monthly task list shows lagging platform lifecycle", () => {
    expect(weeklyPage).toContain("pickLaggingContentAssetLifecycleStage");
    expect(taskList).toContain("laggingLifecycleLabel");
    expect(taskList).toContain("当前状态：");
    expect(taskList).not.toContain("最落后平台：");
  });
});

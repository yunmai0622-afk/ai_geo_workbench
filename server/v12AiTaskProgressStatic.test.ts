import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO AI task progress P0 static", () => {
  const diagnosis = read("client/src/pages/V12FlowPages.tsx");
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const board = read("client/src/components/weekly/PlatformContentBoard.tsx");
  const routers = read("server/routers.ts");

  it("AI diagnosis page shows progress card and stages", () => {
    expect(diagnosis).toContain("AiTaskProgressCard");
    expect(diagnosis).toContain("ai-diagnosis-progress");
    expect(diagnosis).toContain("正在运行 AI 实测诊断");
    expect(diagnosis).toContain("AI_DIAGNOSIS_PROGRESS_HINT_30S");
    expect(diagnosis).toContain("mapGeoDiagnosisErrorCategory");
  });

  it("weekly platform board only disables active platform generate button", () => {
    expect(board).toContain("generatingPlatformKey");
    expect(board).toContain("generatingPlatformKey === def.key");
    expect(weekly).toContain("platform-content-progress");
    expect(weekly).toContain("generatingPlatformKey={generatingPlatformKey}");
    expect(weekly).toContain("boardBusy={batchBusy}");
  });

  it("backend duration logs", () => {
    const durationLog = read("server/geoTaskDurationLog.ts");
    expect(routers).toContain("logGeoAnalysisRunDuration");
    expect(routers).toContain("logGeoArticlesGenerateDuration");
    expect(durationLog).toContain('"geo.analysis.run"');
    expect(durationLog).toContain('"geo.articles.generate"');
  });

  it("does not expose internal fields in progress UI", () => {
    const card = read("client/src/components/geo/AiTaskProgressCard.tsx");
    for (const token of ["rawAnswer", "taskId", "provider", "adapter", "mock", "轮询"]) {
      expect(card).not.toContain(token);
    }
  });

  it("diagnosis prompt and output schema unchanged (quality guard)", () => {
    expect(routers).toContain("geo_analysis_result_v12");
    expect(routers).toContain("easyToMention");
    expect(routers).toContain("runGeoArticleQualityCheckFlow");
    expect(routers).not.toMatch(/skip.*质检|跳过质检/i);
  });

  it("progress card includes elapsed and slow hints", () => {
    const card = read("client/src/components/geo/AiTaskProgressCard.tsx");
    expect(card).toContain("已耗时");
    expect(card).toContain("hint30s");
    expect(card).toContain("hint60s");
    expect(card).toContain("hint90s");
    expect(card).toContain("step-description");
    expect(card).toContain("data-elapsed-sec");
  });
});

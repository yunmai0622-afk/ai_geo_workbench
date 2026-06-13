import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatProfileCompletenessDimensionLabel,
  PROFILE_COMPLETENESS_DIMENSION_LABEL_PREFIX,
} from "../shared/onboardingCompletenessReport";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-Fix-Naming-Scan-AITest", () => {
  it("prefixes profile completeness checklist labels with 资料-", () => {
    expect(formatProfileCompletenessDimensionLabel("品类定位")).toBe("资料-品类定位");
    expect(formatProfileCompletenessDimensionLabel("信任证据")).toBe("资料-信任证据");
    expect(formatProfileCompletenessDimensionLabel("资料-公开信源")).toBe("资料-公开信源");
    expect(PROFILE_COMPLETENESS_DIMENSION_LABEL_PREFIX).toBe("资料-");
  });

  it("wizard shell shows completeness vs maturity hints and maturity link", () => {
    const shell = read("client/src/components/enterpriseProfile/wizard/OnboardingWizardShell.tsx");
    expect(shell).toContain("formatProfileCompletenessDimensionLabel");
    expect(shell).toContain("wizard-completeness-vs-maturity-hint");
    expect(shell).toContain("wizard-maturity-link");
    expect(shell).toContain("查看 AI 品牌成熟度评分");
    expect(shell).toContain('buildProjectUrl("/maturity"');
  });

  it("maturity overview explains difference from profile completeness", () => {
    const page = read("client/src/pages/MaturityDetailPage.tsx");
    expect(page).toContain("maturity-vs-profile-completeness-hint");
    expect(page).toContain("MATURITY_VS_PROFILE_COMPLETENESS_HINT");
  });

  it("T0 execution can resume on poll and skips completed runs", () => {
    const executor = read("server/geoT0Executor.ts");
    expect(executor).toContain("ensureT0ExecutionContinues");
    expect(executor).toContain("loadCompletedT0TaskKeys");
    expect(executor).toContain("buildT0RunTaskKey");
    const routers = read("server/routers.ts");
    expect(routers).toContain("ensureT0ExecutionContinues(db, input.id)");
  });

  it("AI diagnosis running banner shows long-running hint", () => {
    const flow = read("client/src/pages/V12FlowPages.tsx");
    expect(flow).toContain("T0_DETECTION_LONG_RUNNING_HINT");
    expect(flow).toContain("ai-diagnosis-t0-long-running-hint");
  });
});

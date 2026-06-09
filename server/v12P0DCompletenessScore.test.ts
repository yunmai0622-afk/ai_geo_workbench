import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P0-D Completeness Score", () => {
  it("exposes geo.onboarding.getCompletenessReport router", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("onboarding: router({");
    expect(routers).toContain("getCompletenessReport:");
    expect(routers).toContain("loadOnboardingCompletenessReport");
  });

  it("builds standard 8-dimension completeness report in shared layer", () => {
    const shared = read("shared/onboardingCompletenessReport.ts");
    expect(shared).toContain("buildOnboardingCompletenessReport");
    expect(shared).toContain("topMissingItems");
    expect(shared).toContain("nextStepSuggestion");
    expect(shared).toContain("brandIdentity");
    expect(shared).toContain("geoGoal");
  });

  it("workspace business results shows profile completeness summary", () => {
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(workspace).toContain("geo.onboarding.getCompletenessReport");
    expect(workspace).toContain("workspace-profile-completeness");
    expect(workspace).toContain("建档完整度");
    expect(workspace).toContain("主要缺口");
    expect(workspace).toContain("workspace-go-complete-profile");
    expect(workspace).toContain('buildProjectUrl("/enterprise-profile"');
  });

  it("enterprise profile top area shows 8-dimension scores with status", () => {
    const shell = read("client/src/components/enterpriseProfile/wizard/OnboardingWizardShell.tsx");
    expect(shell).toContain("wizard-dimension-scores");
    expect(shell).toContain("resolveCompletenessDimensionStatusIcon");
    expect(shell).toContain("wizard-dimension-step-");
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(asset).toContain("geo.onboarding.getCompletenessReport");
    expect(asset).toContain("dimensionScores");
  });
});

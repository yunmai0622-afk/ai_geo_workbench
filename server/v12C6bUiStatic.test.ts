import { describe, expect, it } from "vitest";
import { readEnterpriseProfileUi } from "./enterpriseProfileTestBlob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C6-B enterprise profile flow order", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const profileUi = readEnterpriseProfileUi();

  it("shows create project first when no projects", () => {
    expect(page).toContain("ProjectContextEmptyState");
    expect(page).toContain("enterprise-profile-empty");
    expect(page).toMatch(/if \(!currentProjectId && !projectsLoading\)/);
    expect(page).toContain("选择或新建客户项目");
  });

  it("hides wizard without selected project", () => {
    expect(page).toMatch(/if \(!currentProjectId && !projectsLoading\)/);
    expect(page).toMatch(/currentProjectId && !coreProfileLoadFailed \? \(/);
    expect(profileUi).toContain("OnboardingWizardShell");
  });

  it("places new project as secondary when projects exist", () => {
    expect(read("client/src/pages/ClientDashboardPage.tsx")).toContain("新建企业项目");
    expect(read("client/src/pages/LegacyOnboardingPage.tsx")).toContain("已有客户项目");
    expect(read("client/src/pages/OnboardingPage.tsx")).toContain("if (user && projects.length > 0 && !continuingProjectId)");
    expect(read("client/src/pages/OnboardingPage.tsx")).toContain('Redirect to="/clients"');
  });

  it("shows wizard when project selected", () => {
    expect(profileUi).toContain("wizard-step-nav");
    expect(page).toContain("WizardStepPanels");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C6-B enterprise profile flow order", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const upload = read("client/src/components/enterpriseProfile/ProfileUploadAssistSection.tsx");

  it("shows empty state when no project selected", () => {
    expect(page).toContain("ProjectContextEmptyState");
    expect(page).toContain("enterprise-profile-empty");
    expect(page).toContain("useActiveProjectId");
  });

  it("shows onboarding blocks only with selected project", () => {
    expect(page).toContain("FiveMinuteBasicOnboardingSection");
    expect(page).toMatch(/selectedProject|currentProjectId/);
  });

  it("create project lives on clients hub not profile page", () => {
    expect(page).not.toContain("handleCreateProject");
    expect(read("client/src/pages/ClientDashboardPage.tsx")).toContain("新建企业项目");
  });

  it("shows publish env hint before upload assist when project selected", () => {
    expect(upload).toContain("资料上传与 AI 辅助解析");
    const hintBlock = page.indexOf("ProfilePublishEnvLightHint");
    const basicBlock = page.indexOf("FiveMinuteBasicOnboardingSection");
    const uploadBlock = page.indexOf("ProfileUploadAssistSection");
    expect(hintBlock).toBeGreaterThan(-1);
    expect(basicBlock).toBeGreaterThan(-1);
    expect(hintBlock).toBeLessThan(uploadBlock);
    expect(basicBlock).toBeLessThan(uploadBlock);
  });

  it("save profile starts diagnosis flow", () => {
    expect(page).toContain("saveFiveMinuteAndStartDiagnosis");
    expect(page).toContain("保存并开始 AI 实测诊断");
  });
});

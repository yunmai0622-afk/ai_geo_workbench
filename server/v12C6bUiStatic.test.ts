import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C6-B enterprise profile flow order", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const upload = read("client/src/components/enterpriseProfile/ProfileUploadAssistSection.tsx");

  it("shows create project first when no projects", () => {
    expect(page).toContain("先新建第一个企业项目");
    expect(page).toContain("hasProjects");
    expect(page).toContain("hasSelectedProject");
  });

  it("hides onboarding blocks without selected project", () => {
    expect(page).toContain("{hasSelectedProject ? (");
    expect(page).toMatch(/hasSelectedProject \?[\s\S]*FiveMinuteBasicOnboardingSection/);
  });

  it("places new project as secondary when projects exist", () => {
    expect(page).toContain("新增企业项目");
    expect(page).toContain("<details");
  });

  it("shows publish env then basic onboarding when project selected", () => {
    expect(upload).toContain("资料上传与 AI 辅助解析");
    const publishBlock = page.indexOf("<EnterprisePublishEnvironmentSection");
    const basicBlock = page.indexOf("<FiveMinuteBasicOnboardingSection");
    const uploadBlock = page.indexOf("<ProfileUploadAssistSection");
    expect(publishBlock).toBeGreaterThan(-1);
    expect(basicBlock).toBeGreaterThan(-1);
    expect(publishBlock).toBeLessThan(basicBlock);
    expect(basicBlock).toBeLessThan(uploadBlock);
  });

  it("auto switches after create with hint message", () => {
    expect(page).toContain("企业已创建，现在可以上传资料进行 AI 建档");
  });
});

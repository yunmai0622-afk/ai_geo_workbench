import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(projectRoot, rel), "utf-8");

describe("GEO-V1-D 企业 GEO 建档只服务当前 project", () => {
  it("AssetCenter 不包含项目切换与新建", () => {
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(asset).not.toContain("setSelectedProjectId");
    expect(asset).not.toContain("createProject");
    expect(asset).not.toContain("handleCreateProject");
    expect(asset).not.toMatch(/<select[\s\S]*projects\.map/);
    expect(asset).not.toContain("projects[0]");
    expect(asset).toContain("currentProjectId");
    expect(asset).toContain("useActiveProjectSelection");
  });

  it("无 activeProjectId 时展示空状态且不查询业务", () => {
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(asset).toContain("ProjectContextEmptyState");
    expect(asset).toContain("enterprise-profile-empty");
    expect(asset).toContain("enabled: Boolean(currentProjectId)");
    expect(asset).toMatch(/if \(!currentProjectId && !projectsLoading\)/);
  });

  it("不在页内重复展示当前客户项目大块头", () => {
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(asset).not.toContain("enterprise-profile-current-project-header");
    expect(asset).not.toContain("enterprise-profile-switch-client");
    expect(asset).not.toContain("当前客户项目：");
  });

  it("写操作与查询均绑定 currentProjectId", () => {
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(asset).toContain("upsertProfile");
    expect(asset).toContain("projectId: currentProjectId");
  });

  it("发布账号区仍可在发布中心配置", () => {
    const publish = read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx");
    const binding = read("client/src/components/PlatformAccountBindingSection.tsx");
    const publishCenter = read("client/src/pages/ContentPublishingCenterPage.tsx");
    expect(publish).toContain("PlatformAccountBindingSection");
    expect(binding).toContain("projectId: number");
    expect(publishCenter).toContain("PublishPlatformAccountsOverview");
  });
});

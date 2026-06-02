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
    expect(asset).toContain("createCustomerCase");
    expect(asset).toContain("updateCustomerCase");
    expect(asset).toContain("projectId: currentProjectId");
    expect(asset).toContain("buildProjectUrl(\"/ai-diagnosis\"");
  });

  it("发布账号区只接收当前 projectId", () => {
    const publish = read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx");
    const binding = read("client/src/components/PlatformAccountBindingSection.tsx");
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(publish).toContain("PlatformAccountBindingSection");
    expect(binding).toContain("projectId: number");
    expect(asset).toContain("PublishPlatformAccountsOverview");
    expect(asset).toContain("projectId={currentProjectId}");
  });

  it("建档页仍绑定 currentProjectId 查询与保存", () => {
    const asset = read("client/src/pages/AssetCenter.tsx");
    expect(asset).toContain("enabled: Boolean(currentProjectId)");
    expect(asset).toContain("projectId: currentProjectId");
  });

  it("无 Chrome 插件主文案、不改 schema", () => {
    const blob = read("client/src/pages/AssetCenter.tsx") + read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    expect(blob).not.toMatch(/下载 Chrome 插件|browser-extension\.zip/);
    expect(read("drizzle/schema.ts")).not.toContain("currentProjectOnly");
  });
});

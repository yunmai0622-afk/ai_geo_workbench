import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Local-Agent-Account-Binding-Flow-P0", () => {
  const publishPage = read("client/src/pages/ContentPublishingCenterPage.tsx");
  const guide = read("client/src/components/publishing/LocalAccountBindingGuideCard.tsx");
  const appJs = read("local-agent/src/renderer/app.js");
  const preload = read("local-agent/src/preload.ts");
  const main = read("local-agent/src/main.ts");
  const localServer = read("local-agent/src/agent/localServer.ts");
  const workspace = read("shared/workspaceStateMachine.ts");

  it("Web 平台适配发布页引导在本地客户端完成账号配置", () => {
    expect(publishPage).toContain("LocalAccountBindingGuideCard");
    expect(guide).toContain("LOCAL_AGENT_ACCOUNT_BINDING_BODY");
    expect(guide).toContain("打开本地客户端账号环境");
    expect(guide).toContain("local-account-binding-guide");
    expect(guide).not.toMatch(/上传.*Cookie|Chrome 插件/i);
  });

  it("Web 在 Local Agent 已连接但无账号时显示提示", () => {
    expect(guide).toContain("local-agent-no-account-hint");
    expect(guide).toContain("LOCAL_AGENT_CONNECTED_NO_ACCOUNT_HINT");
    expect(guide).toContain("local-agent-not-connected-hint");
  });

  it("local-agent 创建按钮使用事件绑定而非内联 onclick（CSP）", () => {
    expect(appJs).toContain("handleCreatePlatformProfile");
    expect(appJs).toContain("createBtn.onclick");
    expect(appJs).not.toContain("onclick=\"void window.agentApi.createPlatformProfile");
  });

  it("创建知乎账号环境调用 IPC 且创建后打开登录", () => {
    expect(preload).toContain("createPlatformProfile");
    expect(main).toContain('ipcMain.handle("agent:createPlatformProfile"');
    expect(main).toContain("openLoginWindow(account.profileId)");
    expect(localServer).toContain("/profiles/create");
    expect(localServer).toContain("openLoginWindow(account.profileId)");
  });

  it("selectedPlatform 与不支持平台处理", () => {
    expect(appJs).toContain('let selectedPlatform = "zhihu"');
    expect(appJs).toContain("PENDING_PLATFORMS");
    expect(appJs).toContain("即将支持");
    expect(main).toContain("即将支持账号环境创建");
  });

  it("账号环境侧栏展示搜狐/百家号/头条/网易并可创建", () => {
    for (const platform of ["sohu", "baijiahao", "toutiao", "netease"] as const) {
      expect(appJs).toContain(`"${platform}"`);
      expect(appJs).toContain("CREATABLE_PLATFORMS");
    }
    expect(appJs).toContain("搜狐号");
    expect(appJs).toContain("百家号");
    expect(appJs).toContain("头条号");
    expect(appJs).toContain("网易号");
    expect(main).toContain('"sohu"');
    expect(main).toContain('"baijiahao"');
    expect(main).toContain('"toutiao"');
    expect(main).toContain('"netease"');
  });

  it("workspace 风险提示指向本地客户端", () => {
    expect(workspace).toContain("workspacePublishAccountRiskHint");
    expect(read("shared/localAgentAccountBinding.ts")).toContain("本地发布客户端");
  });
});

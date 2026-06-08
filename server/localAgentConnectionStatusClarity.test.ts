import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildWorkspacePublishRiskHints } from "@shared/publishReadiness";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const LEGACY_HINT = "请先打开 GEO 本地发布客户端，并刷新连接状态。";

describe("GEO-V1.1 Local Agent connection status clarity P0", () => {
  it("shared copy includes detect button and no legacy vague hint in UI strings", () => {
    const mod = read("shared/localAgentConnectionStatus.ts");
    expect(mod).toContain("检测本地客户端连接");
    expect(mod).not.toContain('message: "' + LEGACY_HINT);
  });

  it("publish center exposes check connection entry", () => {
    const page = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const statusBar = read("client/src/components/publishing/PublishStatusBar.tsx");
    const panel = read("client/src/components/publishing/LocalAgentConnectionPanel.tsx");
    expect(statusBar).toContain("打开客户端");
    expect(statusBar).toContain("publish-open-client");
    expect(page).toContain("useLocalAgentConnection");
    expect(page).toContain("PublishStatusBar");
    expect(panel).toContain("local-agent-connection-panel");
    expect(page).not.toContain(LEGACY_HINT);
    expect(page).not.toMatch(/useEffect\([\s\S]*checkLocalAgentHealth/);
  });

  it("weekly publish dialog exposes check connection entry", () => {
    const page = read("client/src/pages/WeeklyContentPage.tsx");
    expect(page).toContain("publish-to-platform-dialog");
    expect(page).toContain("LocalAgentConnectionPanel");
    expect(read("client/src/components/publishing/LocalAgentConnectionPanel.tsx")).toContain(
      "local-agent-connection-panel",
    );
    expect(page).not.toContain(LEGACY_HINT);
  });

  it("workspace shell wires risk hints without auto health loop", () => {
    const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
    expect(shell).toContain("useLocalAgentConnection");
    expect(shell).not.toMatch(/useEffect\([\s\S]*checkLocalAgentHealth/);
  });

  it("account health hook does not auto-run on mount", () => {
    const hook = read("client/src/hooks/usePublishAccountHealthCheck.ts");
    expect(hook).not.toMatch(/autoRunKeyRef/);
  });

  it("workspace risk hints follow connection status", () => {
    expect(
      buildWorkspacePublishRiskHints({
        p0ProfileComplete: true,
        boundPublishAccountCount: 0,
        localAgentConnectionStatus: "UNKNOWN",
      })[0],
    ).toMatch(/尚未检测/);
    expect(
      buildWorkspacePublishRiskHints({
        p0ProfileComplete: true,
        boundPublishAccountCount: 1,
        localAgentConnectionStatus: "DISCONNECTED",
      })[0],
    ).toMatch(/未检测到/);
    expect(
      buildWorkspacePublishRiskHints({
        p0ProfileComplete: true,
        boundPublishAccountCount: 1,
        localAgentConnectionStatus: "CONNECTED_ACCOUNT_NOT_SYNCED",
      })[0],
    ).toMatch(/未同步/);
  });
});

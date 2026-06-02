import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1-AgentUX", () => {
  it("polling restart logs reason instead of silent stop/start", () => {
    const pm = read("local-agent/src/agent/pollingManager.ts");
    expect(pm).toContain("restartReason");
    expect(pm).toContain("正在重连");
    expect(pm).toContain("export function restartPolling");
    const startBlock = pm.slice(pm.indexOf("export function startPolling"), pm.indexOf("export function stopPolling"));
    expect(startBlock).not.toContain("stopPolling()");
    expect(read("local-agent/src/main.ts")).toContain('restartReason: "配置已更新"');
  });

  it("log detail empty state shows customer hint", () => {
    const emptyText = "暂无任务日志，选择一条发布任务查看执行详情";
    expect(read("local-agent/src/renderer/index.html")).toContain(emptyText);
    expect(read("local-agent/src/renderer/app.js")).toContain(emptyText);
    const css = read("local-agent/src/renderer/style.css");
    expect(css).toContain(".log-detail.is-empty");
    expect(css).toContain("border-style: dashed");
  });

  it("client checks manifest version on startup and shows update notice", () => {
    expect(read("local-agent/src/agent/agentUpdateCheck.ts")).toContain("fetchAgentUpdateNotice");
    expect(read("local-agent/src/agent/agentUpdateCheck.ts")).toContain("/downloads/manifest.json");
    expect(read("local-agent/src/agent/agentUpdateCheck.ts")).toContain("isLocalAgentClientOutdated");
    expect(read("local-agent/src/agent/dashboard.ts")).toContain("fetchAgentUpdateNotice");
    expect(read("local-agent/src/agent/dashboard.ts")).toContain("updateNotice");
    const html = read("local-agent/src/renderer/index.html");
    expect(html).toContain('id="update-notice"');
    const appJs = read("local-agent/src/renderer/app.js");
    expect(appJs).toContain("renderUpdateNotice");
    expect(appJs).toContain("有新版本可用，建议更新客户端");
    expect(appJs).toContain("openExternalUrl");
  });
});

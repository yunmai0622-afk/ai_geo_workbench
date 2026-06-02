import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Agent-4 local publish client productization", () => {
  it("config supports pollIntervalSeconds and log retention", () => {
    const cfg = read("local-agent/src/agent/agentConfig.ts");
    expect(cfg).toContain("pollIntervalSeconds");
    expect(cfg).toContain("logRetentionDays");
    expect(cfg).toContain("maxTasksPerCycle");
    expect(read("local-agent/data/config.example.json")).toContain("autoStartPolling");
  });

  it("polling manager exposes start/stop/pollOnce and single loop", () => {
    const pm = read("local-agent/src/agent/pollingManager.ts");
    expect(pm).toContain("export function startPolling");
    expect(pm).toContain("export function stopPolling");
    expect(pm).toContain("export async function pollOnce");
    expect(pm).toContain("正在执行任务，跳过本轮");
    expect(pm).toContain("maxTasksPerCycle");
  });

  it("task logs persisted per task id", () => {
    expect(read("local-agent/src/agent/taskLogStore.ts")).toContain("task-${taskId}.json");
    expect(read("local-agent/src/agent/publishWorker.ts")).toContain("reportPublishOutcome");
    expect(read("local-agent/src/agent/taskLogStore.ts")).toContain("persistTaskLogsFromOutcome");
  });

  it("diagnostics redacts api key and excludes profiles", () => {
    const d = read("local-agent/src/agent/diagnostics.ts");
    expect(d).toContain("[REDACTED]");
    expect(d).toContain("不包含 Cookie");
  });

  it("renderer has overview, tasks, diagnostics and settings tabs", () => {
    const html = read("local-agent/src/renderer/index.html");
    for (const tab of ["总览", "账号环境", "发布任务", "诊断", "设置"]) {
      expect(html).toContain(tab);
    }
    expect(html).toContain('data-tab="settings"');
    expect(html).toContain("panel-settings");
    const diagSlice = html.slice(html.indexOf("panel-diagnostics"), html.indexOf("panel-settings"));
    expect(diagSlice).not.toContain("btn-save-settings");
    const appJs = read("local-agent/src/renderer/app.js");
    expect(appJs).toContain("deleteProfile");
    expect(appJs).toContain("最后检查：");
    expect(appJs).toContain("暂无任务日志，选择一条发布任务查看执行详情");
  });

  it("server exposes agent.listTasks for client queue", () => {
    expect(read("server/agentRouter.ts")).toContain("listTasks");
    expect(read("server/agentPublishTasks.ts")).toContain("listAgentTasksForClient");
  });

  it("electron-builder package scripts exist", () => {
    const pkg = JSON.parse(read("local-agent/package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["package:mac"]).toContain("electron-builder");
    expect(pkg.scripts["package:win"]).toContain("electron-builder");
  });

  it("README documents security boundaries", () => {
    const readme = read("local-agent/README.md");
    expect(readme).toContain("不保存平台密码");
    expect(readme).toContain("Cookie 不上传");
    expect(readme).toContain("导出诊断包");
  });
});

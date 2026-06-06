import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-V1.1-AgentDiagFix", () => {
  it("merges idle poll messages in renderer live log", () => {
    const appJs = read("local-agent/src/renderer/app.js");
    expect(appJs).toContain("setLiveLogIdleStatus");
    expect(appJs).toContain("syncLiveLogIdleFromDashboard");
    expect(appJs).toContain("最后检查：");
    const pm = read("local-agent/src/agent/pollingManager.ts");
    const idleBlock = pm.slice(pm.indexOf("tasks.length === 0"), pm.indexOf("for (const task"));
    expect(idleBlock).not.toContain('log("暂无待处理任务")');
  });

  it("log detail shows customer empty hint", () => {
    const html = read("local-agent/src/renderer/index.html");
    expect(html).toContain("暂无任务日志，选择一条发布任务查看执行详情");
    expect(html).toContain("log-detail-customer is-empty");
  });

  it("settings merged into diag-settings panel", () => {
    const html = read("local-agent/src/renderer/index.html");
    expect(html).toContain("panel-diag-settings");
    expect(html).toContain("btn-save-settings");
    expect(html).not.toContain("panel-settings");
  });
});

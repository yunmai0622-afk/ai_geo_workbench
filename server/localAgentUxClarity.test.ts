import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("GEO-Local-Agent-UX-Clarity-P0", () => {
  const html = read("local-agent/src/renderer/index.html");
  const appJs = read("local-agent/src/renderer/app.js");
  const uxCopy = read("local-agent/src/renderer/uxCopy.js");

  it("四个 Tab，诊断与设置合并", () => {
    expect(html).toContain('data-tab="overview">状态总览');
    expect(html).toContain('data-tab="diag-settings">诊断与设置');
    expect(html).not.toContain('data-tab="settings"');
    expect(html).not.toContain('data-tab="diagnostics"');
  });

  it("总览页准备就绪文案与下一步动作", () => {
    expect(uxCopy).toContain("准备就绪");
    expect(html).toContain("平台适配发布");
    expect(appJs).toContain("renderHeroActions");
    expect(html).toContain('id="hero-actions"');
  });

  it("账号环境展示 Web 同步状态", () => {
    expect(uxCopy).toContain("webSync");
    expect(appJs).toContain("Web 同步");
    expect(uxCopy).toContain("刷新并同步账号状态");
  });

  it("发布任务空状态包含说明与下一步", () => {
    expect(uxCopy).toContain("TASKS_EMPTY");
    expect(uxCopy).toContain("加入发布队列");
    expect(appJs).toContain("renderTasksEmptyState");
    expect(html).toContain('id="tasks-empty"');
  });

  it("诊断页普通排查优先，技术日志折叠", () => {
    expect(html).toContain("普通排查");
    expect(html).toContain('class="diag-tech-fold"');
  });

  it("设置说明不跳过人工确认", () => {
    expect(uxCopy).toMatch(/不会在未经确认的情况下/);
  });

  it("不出现自动发布误导文案", () => {
    expect(html).not.toMatch(/自动发布/);
    expect(html).not.toMatch(/自动接收并执行/);
  });

  it("顶部状态栏与诊断摘要", () => {
    expect(html).toContain('id="hdr-metrics"');
    expect(appJs).toContain("renderHeaderMetrics");
    expect(appJs).toContain("renderDiagSettings");
  });
});

#!/usr/bin/env node
/**
 * GEO-V1-C 企业工作台状态机静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf-8");

let passed = 0;
let failed = 0;

function ok(msg) {
  passed++;
  console.log("[OK]", msg);
}
function fail(msg) {
  failed++;
  console.error("[FAIL]", msg);
}

const app = read("client/src/App.tsx");
if (app.includes('path="/workspace"') && app.includes("EnterpriseWorkspacePage")) {
  ok("App 路由支持 /workspace");
} else fail("App /workspace route");

const clients = read("client/src/pages/ClientDashboardPage.tsx");
if (clients.includes('buildProjectUrl("/workspace"')) {
  ok("ClientDashboard 进入工作台带 projectId");
} else fail("ClientDashboard workspace jump");

const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
if (workspace.includes("useActiveProjectSelection") && workspace.includes("geo.workspace.summary")) {
  ok("Workspace 使用 activeProjectId + summary API");
} else fail("Workspace hook/api");

if (workspace.includes("ProjectContextEmptyState") && workspace.includes("workspace-empty")) {
  ok("Workspace 无项目使用 ProjectContextEmptyState");
} else fail("Workspace empty state");

const sm = read("shared/workspaceStateMachine.ts");
const stageLabels = [
  "待绑定发布环境",
  "待完成 GEO 建档",
  "待 AI 现状诊断",
  "待生成内容",
  "待发布",
  "待复测",
  "待优化",
  "可生成报告",
];
let stagesOk = true;
for (const label of stageLabels) {
  if (!sm.includes(label)) {
    fail(`missing stage label: ${label}`);
    stagesOk = false;
  }
}
if (stagesOk) ok("状态机阶段文案存在");

if (workspace.includes("workspaceCtaUrl") && workspace.includes("buildProjectUrl")) {
  ok("CTA 均带 projectId");
} else fail("CTA projectId");

const blob = workspace + sm + read("server/workspaceSummary.ts");
if (!/projects\[0\]\.id|setSelectedProjectId\(projects\[0\]/.test(blob)) {
  ok("不存在 projects[0] fallback");
} else fail("projects[0] found");

if (!/\bmock\b|mock数据|fake/i.test(blob)) {
  ok("不存在 mock 数据文案");
} else fail("mock data copy");

if (!/下载 Chrome 插件|browser-extension\.zip/.test(blob)) {
  ok("无 Chrome 插件主文案");
} else fail("Chrome plugin");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

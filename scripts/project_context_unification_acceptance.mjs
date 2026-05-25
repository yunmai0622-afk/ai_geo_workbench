#!/usr/bin/env node
/**
 * GEO-V1-A Project 上下文统一静态验收
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

const activeProject = read("client/src/lib/activeProject.ts");
if (
  activeProject.includes("getActiveProjectId") &&
  activeProject.includes("setActiveProjectId") &&
  activeProject.includes("buildProjectUrl")
) {
  ok("activeProjectId 工具存在");
} else fail("missing activeProject lib");

const clientDash = read("client/src/pages/ClientDashboardPage.tsx");
if (clientDash.includes("setActiveProjectId(projectId)") && clientDash.includes("buildProjectUrl")) {
  ok("客户台进入工作台带 projectId");
} else fail("ClientDashboard enter missing projectId");

if (!/setLocation\("\/"\)/.test(clientDash.replace(/buildProjectUrl\("\/workspace"/, ""))) {
  ok("handleEnter 不裸跳 /");
} else fail("handleEnter still bare /");

const pages = [
  "client/src/pages/AssetCenter.tsx",
  "client/src/pages/WeeklyContentPage.tsx",
  "client/src/pages/V12FlowPages.tsx",
  "client/src/components/V1WorkbenchOverview.tsx",
  "client/src/pages/ProgressPage.tsx",
  "client/src/pages/GeoPages.tsx",
];
let noSilentFirst = true;
for (const f of pages) {
  const s = read(f);
  if (s.includes("projects[0]?.id") || /setSelectedProjectId\(projects\[0\]/.test(s)) {
    fail(`still projects[0] in ${f}`);
    noSilentFirst = false;
  }
}
if (noSilentFirst) ok("无静默 projects[0]");

const empty = read("client/src/components/ProjectContextEmptyState.tsx");
if (empty.includes("请先选择客户项目") && empty.includes("去客户管理台")) {
  ok("无 project 空状态文案");
} else fail("empty state copy");

const layout = read("client/src/components/DashboardLayout.tsx");
if (layout.includes("当前客户") && layout.includes("切换客户") && layout.includes("buildProjectUrl")) {
  ok("DashboardLayout 当前客户 + 侧栏带 projectId");
} else fail("DashboardLayout");

const app = read("client/src/App.tsx");
if (app.includes("getActiveProjectId") && !app.includes("const projectId = projects[0]")) {
  ok("App onboarding 不用 projects[0] 单项目门禁");
} else fail("App onboarding gate");

const blob = read("client/src/pages/WeeklyContentPage.tsx") + read("client/src/components/DashboardLayout.tsx");
if (!/下载 Chrome 插件|browser-extension\.zip/.test(blob)) {
  ok("无 Chrome 插件主文案");
} else fail("Chrome plugin copy found");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

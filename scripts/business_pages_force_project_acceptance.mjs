#!/usr/bin/env node
/**
 * GEO-V1-E 业务页强制 activeProjectId 静态验收
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

const pages = [
  "client/src/pages/WeeklyContentPage.tsx",
  "client/src/pages/V12FlowPages.tsx",
  "client/src/components/V1WorkbenchOverview.tsx",
  "client/src/pages/ProgressPage.tsx",
  "client/src/pages/GeoPages.tsx",
];

let noFirst = true;
for (const f of pages) {
  const s = read(f);
  if (
    s.includes("projects[0]?.id") ||
    /setSelectedProjectId\(projects\[0\]/.test(s) ||
    /projects\[0\]\.id/.test(s) ||
    /= projects\[0\]/.test(s)
  ) {
    fail(`projects[0] in ${f}`);
    noFirst = false;
  }
  if (/<select[\s\S]{0,400}projects\.map/.test(s) || s.includes("请选择项目") || s.includes("ProjectSelector")) {
    fail(`project select in ${f}`);
    noFirst = false;
  }
}
if (noFirst) ok("业务页无 projects[0] 与项目 select");

const weekly = read("client/src/pages/WeeklyContentPage.tsx");
if (weekly.includes("useActiveProjectSelection") && weekly.includes("BusinessPageProjectHeader")) {
  ok("WeeklyContentPage 使用 activeProject + 只读头部");
} else fail("WeeklyContentPage hook/header");

const v12 = read("client/src/pages/V12FlowPages.tsx");
if (!v12.includes("ProjectSelector") && v12.includes("BusinessPageProjectHeader")) {
  ok("V12FlowPages 无 ProjectSelector，有只读头部");
} else fail("V12FlowPages");

const progress = read("client/src/pages/ProgressPage.tsx");
if (!progress.includes("setSelectedProjectId(Number") && progress.includes("查看当前企业的 GEO 增长进展")) {
  ok("ProgressPage 强制当前 project");
} else fail("ProgressPage");

const geo = read("client/src/pages/GeoPages.tsx");
if (!geo.includes("ProjectSelector") && geo.includes("BusinessPageProjectHeader")) {
  ok("GeoPages 遗留页收口");
} else fail("GeoPages");

const delivery = v12;
if (!delivery.includes("请选择项目后查看") && delivery.includes("DeliveryReportsFlowPage")) {
  ok("交付报告无页内切换企业");
} else fail("DeliveryReports");

let allUseActive = true;
for (const f of pages) {
  const s = read(f);
  if (!s.includes("useActiveProjectSelection") && !s.includes("useProjectSelection")) {
    fail(`missing active hook in ${f}`);
    allUseActive = false;
  }
}
if (allUseActive) ok("主页面均使用 activeProject 选择 hook");

const empty = read("client/src/components/ProjectContextEmptyState.tsx");
if (empty.includes("请先选择客户项目") && empty.includes("/clients")) {
  ok("ProjectContextEmptyState 可被业务页复用");
} else fail("empty state");

const blob = pages.map(read).join("\n");
const navPaths = ["/weekly", "/ai-diagnosis", "/content-publishing", "/inclusion-monitoring", "/delivery-reports", "/enterprise-profile"];
let navOk = true;
for (const p of navPaths) {
  if (!blob.includes(`buildProjectUrl("${p}"`)) {
    fail(`missing buildProjectUrl for ${p}`);
    navOk = false;
  }
}
if (navOk) ok("主链路跳转保留 projectId");

if (!/下载 Chrome 插件|browser-extension\.zip/.test(blob)) {
  ok("无 Chrome 插件主文案");
} else fail("Chrome plugin copy");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

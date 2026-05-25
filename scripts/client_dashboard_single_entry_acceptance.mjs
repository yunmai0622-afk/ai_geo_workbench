#!/usr/bin/env node
/**
 * GEO-V1-B 客户管理台唯一入口静态验收
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

const clients = read("client/src/pages/ClientDashboardPage.tsx");
const asset = read("client/src/pages/AssetCenter.tsx");
const onboarding = read("client/src/pages/OnboardingPage.tsx");
const layout = read("client/src/components/DashboardLayout.tsx");

if (clients.includes("新建客户项目") && clients.includes("create-client-project-dialog")) {
  ok("/clients 有新建客户项目弹窗");
} else fail("missing create dialog on clients");

if (clients.includes("buildProjectUrl(\"/enterprise-profile\"") && clients.includes("setActiveProjectId")) {
  ok("创建后跳转 enterprise-profile 并设置 active");
} else fail("post-create navigation");

if (!asset.includes("handleCreateProject") && !asset.includes("geo.projects.create")) {
  ok("AssetCenter 无 createProject");
} else fail("AssetCenter still creates projects");

for (const phrase of ["新建企业", "创建企业项目", "新建第一个企业项目", "新增企业项目"]) {
  if (asset.includes(phrase)) {
    fail(`AssetCenter contains forbidden: ${phrase}`);
  }
}
if (!["新建企业", "创建企业项目", "新建第一个企业项目", "新增企业项目"].some(p => asset.includes(p))) {
  ok("AssetCenter 无 forbidden create copy");
}

if (asset.includes("当前客户项目") && asset.includes("切换客户") && !/<select[^>]*aria-label="切换企业"/.test(asset)) {
  ok("AssetCenter 只读当前项目 + 切换客户");
} else fail("AssetCenter project switch UI");

if (onboarding.includes("onboarding-has-projects") && onboarding.includes("已有客户项目")) {
  ok("Onboarding 已有项目去客户管理台");
} else fail("Onboarding existing projects");

if (layout.includes('label: "GEO 建档"')) {
  ok("侧栏 GEO 建档");
} else fail("sidebar label");

const noFirst = [
  "client/src/pages/AssetCenter.tsx",
  "client/src/pages/WeeklyContentPage.tsx",
  "client/src/pages/V12FlowPages.tsx",
  "client/src/components/V1WorkbenchOverview.tsx",
].every(f => !read(f).includes("projects[0]?.id"));
if (noFirst) ok("client 无 projects[0] fallback");
else fail("projects[0] still in client pages");

if (!/下载 Chrome 插件/.test(clients + asset)) {
  ok("无 Chrome 插件主文案");
} else fail("Chrome plugin copy");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

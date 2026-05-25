#!/usr/bin/env node
/**
 * GEO-V1-D 企业 GEO 建档只服务当前 project 静态验收
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

const asset = read("client/src/pages/AssetCenter.tsx");

if (!/<select/.test(asset) || !/projects\.map/.test(asset)) ok("AssetCenter 无项目 select");
else fail("project select still present");

for (const bad of ["handleCreateProject", "createProject", "新建企业", "创建企业项目", "新建第一个企业项目", "setSelectedProjectId"]) {
  if (asset.includes(bad)) fail(`forbidden: ${bad}`);
}
if (!["handleCreateProject", "createProject", "新建企业", "创建企业项目", "新建第一个企业项目", "setSelectedProjectId"].some(b => asset.includes(b))) {
  ok("无新建企业与项目切换 API");
}

if (asset.includes("当前客户项目：") && asset.includes("切换客户") && asset.includes('setLocation("/clients")')) {
  ok("当前客户项目 + 切换客户");
} else fail("header");

if (asset.includes("ProjectContextEmptyState") && asset.includes("enabled: Boolean(currentProjectId)")) {
  ok("无 project 时空状态与禁用查询");
} else fail("empty state");

if (asset.includes("buildProjectUrl(\"/weekly\"") && asset.includes("currentProjectId")) {
  ok("写操作与进入内容生产带 projectId");
} else fail("projectId in writes");

if (
  asset.includes("EnterprisePublishEnvironmentSection") &&
  asset.includes("projectId={currentProjectId") &&
  read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx").includes("PlatformAccountBindingSection")
) {
  ok("发布账号绑定当前 project");
} else fail("platform accounts");

if (!asset.includes("projects[0]")) ok("无 projects[0]");
else fail("projects[0] fallback");

const blob = asset + read("client/src/components/PlatformAccountBindingSection.tsx");
if (!/下载 Chrome 插件/.test(blob)) ok("无 Chrome 插件主文案");
else fail("Chrome copy");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

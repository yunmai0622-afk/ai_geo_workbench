#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

let passed = 0;
let failed = 0;
function ok(m) {
  passed++;
  console.log("[OK]", m);
}
function fail(m) {
  failed++;
  console.error("[FAIL]", m);
}

const routers = read("server/routers.ts");
const access = read("server/projectAccess.ts");
const share = read("server/deliveryReportPublicShare.ts");
const agent = read("server/agentPublishTasks.ts");
const h1Report = path.join(ROOT, "artifacts/GEO_TENANT_ISOLATION_H1_REPORT.md");
const p0Report = path.join(ROOT, "artifacts/GEO_TENANT_ISOLATION_P0_REPORT.md");

if (/requireQuestionAccess\(ctx,\s*input\.id\)/.test(routers) && /toggle:[\s\S]*?requireQuestionAccess/.test(routers)) {
  ok("questions toggle/delete 使用 requireQuestionAccess");
} else fail("questions 间接 guard 不完整");

if (/requireQuestionAccess\(ctx,\s*id\)/.test(routers) || /requireQuestionAccess\(ctx,\s*input\.id\)/.test(routers)) {
  ok("questions update 反查 projectId");
} else fail("questions update 未反查");

if (/requireArticleAccess/.test(access) && /requireAnalysisAccess/.test(access)) {
  ok("按 id 资源反查 helpers 存在");
} else fail("缺少 article/analysis 间接 guard helpers");

if (/requireArticleAccess\(ctx,\s*input\.articleId\)/.test(routers)) {
  ok("articleId 操作使用 requireArticleAccess");
} else fail("articleId guard 未接入 routers");

if (fs.existsSync(path.join(ROOT, "scripts/tenant_isolation_idor_e2e.mjs"))) ok("tenant_isolation_idor_e2e.mjs 存在");
else fail("缺少 idor e2e 脚本");

if (fs.existsSync(h1Report)) {
  const h1 = read("artifacts/GEO_TENANT_ISOLATION_H1_REPORT.md");
  if (/分享链接/.test(h1) && /公开只读/.test(h1)) ok("H1 报告含分享边界");
  else fail("H1 报告缺少分享边界");
  if (/Agent/.test(h1) && /localAgentId/.test(h1)) ok("H1 报告含 Agent 边界");
  else fail("H1 报告缺少 Agent 边界");
} else fail("缺少 GEO_TENANT_ISOLATION_H1_REPORT.md");

if (fs.existsSync(p0Report) && /生产执行步骤/.test(read("artifacts/GEO_TENANT_ISOLATION_P0_REPORT.md"))) {
  ok("P0 报告含生产执行步骤");
} else fail("P0 报告缺少生产执行步骤");

if (/randomBytes\(32\)/.test(share)) ok("分享 token 32 字节随机");
else fail("分享 token 强度不足");

if (/task\.localAgentId !== input\.localAgentId/.test(agent)) ok("Agent claim 校验 localAgentId");
else fail("Agent claim 缺 localAgentId 校验");

const weekly = fs.existsSync(path.join(ROOT, "client/src/pages/WeeklyContentPage.tsx"))
  ? read("client/src/pages/WeeklyContentPage.tsx")
  : "";
if (!/Chrome 插件主链路|浏览器插件发布/.test(routers + weekly)) {
  ok("无 Chrome 插件主文案（抽样）");
} else fail("发现 Chrome 插件主文案");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

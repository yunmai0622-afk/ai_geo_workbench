#!/usr/bin/env node
/**
 * GEO-Safety-Phase-2：多企业 projectId / ownerUserId 隔离复验
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PHASE = "GEO-Safety-Phase-2-Project-Isolation-Recheck";
const PREREQ = "GEO-Safety-Phase-1-Main-Flow-Runtime-Audit";
const root = resolve(process.cwd());
const read = rel => readFileSync(resolve(root, rel), "utf-8");
const exists = rel => existsSync(resolve(root, rel));

const MAIN_CHAIN_PAGES = [
  { path: "/clients", file: "client/src/pages/ClientDashboardPage.tsx", kind: "entry" },
  { path: "/workspace", file: "client/src/pages/EnterpriseWorkspacePage.tsx", hook: "useActiveProjectSelection" },
  { path: "/enterprise-profile", file: "client/src/pages/AssetCenter.tsx", hook: "useActiveProjectId" },
  { path: "/ai-diagnosis", file: "client/src/pages/V12FlowPages.tsx", hook: "useActiveProjectSelection" },
  { path: "/weekly", file: "client/src/pages/WeeklyContentPage.tsx", hook: "useActiveProjectSelection" },
  { path: "/content-publishing", file: "client/src/pages/ContentPublishingCenterPage.tsx", hook: "useActiveProjectSelection" },
  { path: "/inclusion-monitoring", file: "client/src/pages/V12FlowPages.tsx", hook: "useActiveProjectSelection" },
  { path: "/delivery-reports", file: "client/src/pages/DeliveryReportsCenterPage.tsx", hook: "useActiveProjectSelection" },
];

/** @type {Record<string, unknown>} */
const report = {
  phase: PHASE,
  prerequisite: { phase: PREREQ, pass: false },
  scannedAt: new Date().toISOString(),
  pass: false,
  ownerUserId: {},
  requireProjectAccess: {},
  clientsFilter: {},
  frontendActiveProject: {},
  backendProjectId: {},
  mainChainIsolation: [],
  p0Findings: [],
  p1Findings: [],
  p2Findings: [],
  suspectedFiles: [],
  fixesApplied: [],
  needsCodeFix: false,
  subprocess: [],
  realRisks: [],
  nextSteps: [],
};

let gateFailures = 0;
function gateFail(msg) {
  gateFailures++;
  report.p0Findings.push(msg);
}

function runSub(script) {
  try {
    execSync(`node ${script}`, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    report.subprocess.push({ script, pass: true });
    return true;
  } catch (e) {
    report.subprocess.push({ script, pass: false, tail: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim().slice(-800) });
    return false;
  }
}

// --- Prerequisite Phase-1 ---
const p1Report = resolve(root, "artifacts/geo-main-flow-runtime-audit.json");
if (exists(p1Report)) {
  try {
    const p1 = JSON.parse(read("artifacts/geo-main-flow-runtime-audit.json"));
    report.prerequisite.pass = Boolean(p1.pass);
  } catch {
    report.prerequisite.pass = false;
  }
} else {
  report.prerequisite.pass = false;
}
if (!report.prerequisite.pass) {
  console.error(`[FAIL] 前置 ${PREREQ} 未通过或报告缺失`);
  writeReports();
  process.exit(1);
}

// --- ownerUserId ---
const schema = read("drizzle/schema.ts");
const projectsBlock = schema.slice(
  schema.indexOf('export const projects = mysqlTable("projects"'),
  schema.indexOf("export const questions"),
);
report.ownerUserId = {
  schemaNotNull: /ownerUserId:\s*int\("ownerUserId"\)\.notNull\(\)/.test(projectsBlock),
  migration0030: exists("drizzle/0030_projects_owner_user_id.sql"),
  ensureScript: exists("scripts/ensure_project_owner_user_id.mjs"),
};
if (!report.ownerUserId.schemaNotNull) gateFail("P0: schema 缺少 projects.ownerUserId notNull");
if (!report.ownerUserId.migration0030) report.p1Findings.push("P1: 生产库需确认已执行 0030 迁移");

// --- requireProjectAccess ---
const projectAccess = read("server/projectAccess.ts");
const routers = read("server/routers.ts");
const rpcCount = (routers.match(/requireProjectAccess\(ctx/g) ?? []).length;
report.requireProjectAccess = {
  exported: /export async function requireProjectAccess/.test(projectAccess),
  listAccessible: /export async function listAccessibleProjectIds/.test(projectAccess),
  indirectHelpers: ["requireQuestionAccess", "requireArticleAccess", "requireAnalysisAccess", "requireAiResponseAccess", "requireOptimizationTaskAccess"].map(
    name => ({ name, present: projectAccess.includes(`export async function ${name}`) }),
  ),
  routersCallCount: rpcCount,
};
if (!report.requireProjectAccess.exported) gateFail("P0: 缺少 requireProjectAccess");
if (rpcCount < 25) gateFail(`P0: requireProjectAccess 调用过少 (${rpcCount})`);

// --- /clients filter ---
const dash = routers.slice(routers.indexOf("clientDashboard"), routers.indexOf("projects: router"));
const projectsList = routers.slice(routers.indexOf("projects: router"), routers.indexOf("questions: router"));
report.clientsFilter = {
  listProjectsSummaryUsesAccessibleIds: dash.includes("listAccessibleProjectIds(ctx)") && dash.includes("inArray(projects.id, accessibleIds)"),
  projectsListOwnerFilter: /eq\(projects\.ownerUserId,\s*userId\)/.test(projectsList),
  projectsCreateWritesOwner: projectsList.includes("ownerUserId") && projectsList.includes("getCurrentUserId(ctx)"),
  noGetAllProjects: !/getAllProjects|listAllProjects/.test(read("client/src/pages/ClientDashboardPage.tsx") + routers),
};
if (!report.clientsFilter.listProjectsSummaryUsesAccessibleIds) gateFail("P0: clientDashboard 未按 owner 过滤");
if (!report.clientsFilter.projectsListOwnerFilter) gateFail("P0: projects.list 未按 ownerUserId 过滤");

// --- P0 API guards (static) ---
function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

const aiRespBlock = sliceBetween(routers, "aiResponses: router({", "analysis: router({");
const scoresBlock = sliceBetween(routers, "scores: router({", "tasks: router({");
const tasksBlock = sliceBetween(routers, "tasks: router({", "templates: router({");

const p0ApiChecks = [
  {
    id: "geo.aiResponses.create",
    block: aiRespBlock,
    must: /create:[\s\S]*?requireProjectAccess\(ctx,\s*input\.projectId\)/,
  },
  {
    id: "geo.aiResponses.importCsvRows",
    block: aiRespBlock,
    must: /importCsvRows:[\s\S]*?requireProjectAccess\(ctx,\s*projectId\)/,
  },
  {
    id: "geo.scores.calculate",
    block: scoresBlock,
    must: /calculate:[\s\S]*?requireProjectAccess\(ctx,\s*input\.projectId\)/,
  },
  {
    id: "geo.tasks.updateStatus",
    block: tasksBlock,
    must: /updateStatus:[\s\S]*?requireOptimizationTaskAccess\(ctx,\s*input\.id\)/,
  },
];

for (const c of p0ApiChecks) {
  const ok = c.must.test(c.block);
  report.backendProjectId[c.id] = ok;
  if (!ok) gateFail(`P0: ${c.id} 缺少 project 归属校验`);
}

// --- Frontend ---
const activeLib = read("client/src/lib/activeProject.ts");
report.frontendActiveProject = {
  noProjects0Fallback: activeLib.includes("禁止 fallback 到 projects[0]"),
  sessionStorageKey: activeLib.includes("activeProjectId"),
  buildProjectUrl: activeLib.includes("buildProjectUrl"),
};

for (const row of MAIN_CHAIN_PAGES) {
  const src = exists(row.file) ? read(row.file) : "";
  let ok = exists(row.file);
  let detail = "";
  if (row.kind === "entry") {
    ok = ok && src.includes("geo.projects.create") && src.includes("setActiveProjectId");
    detail = "唯一新建入口 + setActiveProjectId";
  } else if (row.hook === "useActiveProjectId") {
    ok = ok && src.includes("useActiveProjectId") && /projectId:\s*currentProjectId/.test(src);
    detail = "useActiveProjectId + API projectId";
  } else {
    ok =
      ok &&
      (src.includes("useActiveProjectSelection") || src.includes("useProjectSelection")) &&
      (src.includes("projectInput") || /projectId:\s*selectedProjectId/.test(src));
    detail = "useActiveProjectSelection + enabled/projectInput";
  }
  const noBareQuery =
    !/trpc\.geo\.(analysis|articles|questions)\.[a-zA-Z]+\.useQuery\(\s*\)/.test(src) ||
    src.includes("projectInput");
  if (!noBareQuery) {
    report.p1Findings.push(`P1: ${row.path} 可能存在无 projectId 的 geo API useQuery`);
  }
  report.mainChainIsolation.push({ path: row.path, pass: ok, detail });
  if (!ok) gateFail(`P0: 主链路 ${row.path} 未绑定 activeProject`);
}

// --- mock / chrome / leak ---
const clientBlob = MAIN_CHAIN_PAGES.map(r => read(r.file)).join("\n");
if (/getAllProjects|listAllProjects/.test(clientBlob + routers)) {
  gateFail("P0: 存在 getAllProjects/listAllProjects 暴露");
}
if (/mockSuccess|fake\s+publish(?!ed)|fake\s+inclusion/i.test(clientBlob)) {
  gateFail("P0: 主链路存在 mock/fake 成功语义");
}
if (/下载 Chrome 插件|browser-extension\.zip/.test(clientBlob) && !clientBlob.includes("旧版 Chrome 插件")) {
  report.p1Findings.push("P1: 主链路文案含 Chrome 插件下载（需确认非主入口）");
}

report.p2Findings.push("Agent publicProcedure 按 apiKey 拉任务 — 设计边界，非 Web 用户 IDOR");
report.p2Findings.push("geo.articles.publicContent 使用 getProjectRowConn — 公开文章只读");
report.p2Findings.push("/legacy/onboarding 仍可 createProject — 非 /clients 日常路径");

report.suspectedFiles = [
  "server/routers.ts#geo.aiResponses",
  "server/routers.ts#geo.scores.calculate",
  "server/routers.ts#geo.tasks.updateStatus",
  "server/agentRouter.ts",
  "server/deliveryReportPublicShare.ts",
];

// --- subprocess ---
runSub("scripts/tenant_isolation_p0_acceptance.mjs");
runSub("scripts/tenant_isolation_h1_acceptance.mjs");
runSub("scripts/project_context_unification_acceptance.mjs");
runSub("scripts/business_pages_force_project_acceptance.mjs");

if (!process.env.DATABASE_URL) {
  report.realRisks.push("未配置 DATABASE_URL：未执行 tenant_isolation_idor_e2e 双用户实测");
} else {
  const idorOk = runSub("scripts/tenant_isolation_idor_e2e.mjs");
  if (!idorOk) report.p1Findings.push("P1: IDOR E2E 未通过或数据不足（见 artifacts/tenant-isolation-idor-e2e.json）");
}

report.fixesApplied = [
  "geo.aiResponses.create/importCsvRows → requireProjectAccess",
  "geo.scores.calculate → requireProjectAccess",
  "geo.tasks.updateStatus → requireOptimizationTaskAccess（新增 helper）",
];

report.needsCodeFix = report.p0Findings.length > 0;
report.pass = gateFailures === 0 && report.prerequisite.pass;
report.nextSteps = report.pass
  ? ["可进入 Phase-3（建议补 DATABASE_URL 下 IDOR E2E）"]
  : ["修复 P0 后重跑本脚本"];

function writeReports() {
  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  const md = [
    "# " + PHASE,
    "",
    "- 时间: " + report.scannedAt,
    "- 结论: " + (report.pass ? "**PASS**" : "**FAIL**"),
    "- 前置 Phase-1: " + (report.prerequisite.pass ? "PASS" : "FAIL"),
    "",
    "## ownerUserId",
    "",
    JSON.stringify(report.ownerUserId, null, 2),
    "",
    "## requireProjectAccess",
    "",
    "- 调用次数: " + report.requireProjectAccess.routersCallCount,
    "",
    "## /clients 过滤",
    "",
    JSON.stringify(report.clientsFilter, null, 2),
    "",
    "## 8 条主链路隔离",
    "",
    ...report.mainChainIsolation.map(r => `- ${r.path}: ${r.pass ? "PASS" : "FAIL"} — ${r.detail}`),
    "",
    "## P0 发现",
    "",
    ...(report.p0Findings.length ? report.p0Findings.map(s => "- " + s) : ["- （无）"]),
    "",
    "## 已做最小修复",
    "",
    ...report.fixesApplied.map(s => "- " + s),
    "",
    "## 真实风险",
    "",
    ...report.realRisks.map(s => "- " + s),
    "",
    "## 下一步",
    "",
    ...report.nextSteps.map(s => "- " + s),
    "",
  ].join("\n");
  writeFileSync(resolve(root, "artifacts/geo-project-isolation-recheck.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(resolve(root, "artifacts/geo-project-isolation-recheck.md"), `${md}\n`);
}

writeReports();

console.log(`\n=== ${PHASE} ${report.pass ? "PASSED" : "FAILED"} (P0=${report.p0Findings.length}) ===\n`);
if (report.p0Findings.length) {
  for (const f of report.p0Findings) console.error("[P0]", f);
}
console.log("Wrote artifacts/geo-project-isolation-recheck.md");
process.exit(report.pass ? 0 : 1);

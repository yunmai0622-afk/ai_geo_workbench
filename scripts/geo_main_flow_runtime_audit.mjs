#!/usr/bin/env node
/**
 * GEO-Safety-Phase-1：V1 主链路运行时/静态审计（不 mock API 成功）
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PHASE = "GEO-Safety-Phase-1-Main-Flow-Runtime-Audit";
const root = resolve(process.cwd());
const read = rel => readFileSync(resolve(root, rel), "utf-8");
const exists = rel => existsSync(resolve(root, rel));

const MAIN_CHAIN = [
  { path: "/clients", component: "ClientDashboardPage", file: "client/src/pages/ClientDashboardPage.tsx" },
  { path: "/workspace", component: "EnterpriseWorkspacePage", file: "client/src/pages/EnterpriseWorkspacePage.tsx" },
  { path: "/enterprise-profile", component: "AssetCenterPage", file: "client/src/pages/AssetCenter.tsx" },
  { path: "/ai-diagnosis", component: "AiDiagnosisFlowPage", file: "client/src/pages/V12FlowPages.tsx" },
  { path: "/weekly", component: "WeeklyContentPage", file: "client/src/pages/WeeklyContentPage.tsx" },
  {
    path: "/content-publishing",
    component: "ContentPublishingFlowPage",
    file: "client/src/pages/ContentPublishingCenterPage.tsx",
    reexport: "client/src/pages/V12FlowPages.tsx",
  },
  { path: "/inclusion-monitoring", component: "InclusionMonitoringFlowPage", file: "client/src/pages/V12FlowPages.tsx" },
  {
    path: "/delivery-reports",
    component: "DeliveryReportsFlowPage",
    file: "client/src/pages/DeliveryReportsCenterPage.tsx",
    reexport: "client/src/pages/V12FlowPages.tsx",
  },
];

const REDIRECTS = [
  { path: "/", expected: "/clients", scope: "PrivateRoutes" },
  { path: "/home", expected: "/clients", scope: "PrivateRoutes" },
  { path: "/demo", expected: "/clients", scope: "Router" },
  { path: "/demo/geo", expected: "/clients", scope: "Router" },
  { path: "/flow", expected: "/workspace", scope: "PrivateRoutes" },
];

/** @type {import('node:child_process').ExecSyncOptions} */
const execOpts = { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] };

const report = {
  phase: PHASE,
  scannedAt: new Date().toISOString(),
  pass: false,
  gates: {},
  mainChain: [],
  redirects: [],
  activeProjectId: { findings: [], pass: true },
  projectIdForce: { findings: [], subprocess: [], pass: true },
  api500Risks: [],
  clientsEntry: {},
  workspace: {},
  mockFakeChrome: { mockFake: [], chrome: [], pass: true },
  runtimeProbe: null,
  realRisks: [],
  nextSteps: [],
};

let failed = 0;
function gate(id, ok, detail) {
  report.gates[id] = { pass: ok, detail };
  if (!ok) failed++;
}

function parseRedirects(appSource, scopeFilter) {
  const out = [];
  const block =
    scopeFilter === "Router"
      ? appSource.slice(appSource.indexOf("function Router"))
      : appSource.slice(appSource.indexOf("function PrivateRoutes"), appSource.indexOf("function AuthenticatedAppShell"));
  const re = /<Route\s+path="([^"]+)"[^>]*>\s*<Redirect\s+to="([^"]+)"/g;
  let m;
  while ((m = re.exec(block))) out.push({ path: m[1], to: m[2] });
  return out;
}

function parseComponentRoutes(appSource, scopeFilter) {
  const block =
    scopeFilter === "Router"
      ? appSource.slice(appSource.indexOf("function Router"))
      : appSource.slice(appSource.indexOf("function PrivateRoutes"), appSource.indexOf("function AuthenticatedAppShell"));
  const out = [];
  const re = /<Route\s+path="([^"]+)"\s+component=\{(\w+)\}/g;
  let m;
  while ((m = re.exec(block))) out.push({ path: m[1], component: m[2] });
  return out;
}

function runSubprocess(scriptRel) {
  const label = scriptRel;
  try {
    const out = execSync(`node ${scriptRel}`, execOpts);
    report.projectIdForce.subprocess.push({ script: label, pass: true, tail: out.trim().split("\n").slice(-3).join("\n") });
    return true;
  } catch (e) {
    const tail = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim().split("\n").slice(-6).join("\n");
    report.projectIdForce.subprocess.push({ script: label, pass: false, tail });
    return false;
  }
}

function checkMainChain(appSource) {
  const privateRoutes = parseComponentRoutes(appSource, "PrivateRoutes");
  const routeMap = new Map(privateRoutes.map(r => [r.path, r.component]));
  let allOk = true;

  for (const row of MAIN_CHAIN) {
    const registered = routeMap.get(row.path) === row.component;
    const fileOk = exists(row.file);
    let buildOk = fileOk;
    let activeOk = false;
    let note = "";

    if (fileOk) {
      const src = read(row.file);
      if (row.path === "/enterprise-profile") {
        activeOk =
          src.includes("useActiveProjectId") &&
          /projectId:\s*currentProjectId/.test(src) &&
          src.includes("geo.assetLibrary.summary");
      } else if (row.path === "/clients") {
        activeOk = src.includes("setActiveProjectId") && src.includes("geo.projects.create");
      } else if (row.path === "/workspace") {
        activeOk =
          src.includes("useActiveProjectSelection") && src.includes("geo.workspace.summary");
      } else {
        activeOk =
          (src.includes("useActiveProjectSelection") || src.includes("useProjectSelection")) &&
          (src.includes("projectInput") || /projectId:\s*selectedProjectId/.test(src)) &&
          src.includes("enabled");
      }
      if (row.reexport) {
        const v12 = read(row.reexport);
        buildOk = v12.includes(`export {`) && v12.includes(row.component);
        note = `re-export via ${row.reexport}`;
      }
    }

    const item = {
      path: row.path,
      component: row.component,
      routeRegistered: registered,
      fileExists: fileOk,
      exportOk: buildOk,
      activeProjectBinding: activeOk,
      note,
      pass: registered && fileOk && buildOk && activeOk,
    };
    report.mainChain.push(item);
    if (!item.pass) allOk = false;
  }
  return allOk;
}

function checkRedirects(appSource) {
  const priv = parseRedirects(appSource, "PrivateRoutes");
  const pub = parseRedirects(appSource, "Router");
  const map = new Map([...priv, ...pub].map(r => [r.path, r.to]));
  let allOk = true;

  for (const row of REDIRECTS) {
    const actual = map.get(row.path) ?? null;
    const ok = actual === row.expected;
    report.redirects.push({ ...row, actual, pass: ok });
    if (!ok) allOk = false;
  }
  return allOk;
}

function checkClientsEntry() {
  const clients = read("client/src/pages/ClientDashboardPage.tsx");
  const asset = read("client/src/pages/AssetCenter.tsx");
  const onboarding = read("client/src/pages/OnboardingPage.tsx");
  const app = read("client/src/App.tsx");

  const clientsCreate = clients.includes("geo.projects.create") && clients.includes("新建客户项目");
  const assetNoCreate = !asset.includes("geo.projects.create") && !asset.includes("handleCreateProject");
  const appGate =
    app.includes("P0：/clients 为唯一新建/选项目入口") &&
    /pathname !== "\/clients"/.test(app) &&
    /projects\.length === 0/.test(app);

  report.clientsEntry = {
    clientsHasCreate: clientsCreate,
    assetCenterNoCreate: assetNoCreate,
    appRedirectsWithoutProject: appGate,
    legacyOnboardingCreate: onboarding.includes("geo.projects.create.useMutation"),
    legacyPath: "/legacy/onboarding",
    pass: clientsCreate && assetNoCreate && appGate,
  };
  return report.clientsEntry.pass;
}

function checkWorkspace() {
  const ws = read("client/src/pages/EnterpriseWorkspacePage.tsx");
  const ok =
    ws.includes("useActiveProjectSelection") &&
    ws.includes("geo.workspace.summary") &&
    ws.includes("buildProjectUrl") &&
    ws.includes("ProjectContextEmptyState");
  report.workspace = { usesActiveProject: ok, summaryApi: ws.includes("geo.workspace.summary"), pass: ok };
  return ok;
}

function checkApi500Risks() {
  const routers = read("server/routers.ts");
  const schema = read("drizzle/schema.ts");
  const migrationOk = exists("drizzle/0030_projects_owner_user_id.sql");
  const ownerFilter = /projects\.list[\s\S]{0,800}ownerUserId/.test(routers) || /eq\(projects\.ownerUserId,\s*userId\)/.test(routers);
  const schemaOk = /ownerUserId:\s*int\("ownerUserId"\)\.notNull\(\)/.test(
    schema.slice(schema.indexOf('export const projects'), schema.indexOf("export const questions")),
  );

  report.api500Risks = [
    {
      id: "projects.ownerUserId.schema",
      pass: schemaOk,
      detail: schemaOk ? "schema 已声明 ownerUserId notNull" : "schema 缺少 ownerUserId — 列表 API 可能 500",
    },
    {
      id: "migration.0030",
      pass: migrationOk,
      detail: migrationOk ? "迁移文件存在（生产需已执行）" : "缺少 0030 迁移 — 生产 geo.projects.list 高风险 500",
    },
    {
      id: "projects.list.filter",
      pass: ownerFilter,
      detail: ownerFilter ? "projects.list 按 ownerUserId 过滤" : "projects.list 未过滤 owner — IDOR/500 风险",
    },
    {
      id: "runtime.db",
      pass: Boolean(process.env.DATABASE_URL),
      detail: process.env.DATABASE_URL
        ? "DATABASE_URL 已配置（本脚本未调用真实 tRPC）"
        : "未配置 DATABASE_URL — 无法在 CI/本机做 API 实调，仅静态风险扫描",
    },
    {
      id: "app.emptyProjectsGate",
      pass: true,
      detail: "无项目时 App 强制 /clients（主链路需先选项目）",
    },
  ];

  for (const r of report.api500Risks) {
    if (!r.pass && r.id !== "runtime.db") report.realRisks.push(r.detail);
  }
  return report.api500Risks.every(r => r.pass || r.id === "runtime.db");
}

function checkMockFakeChrome() {
  const mainFiles = [
    ...MAIN_CHAIN.map(r => r.file),
    "client/src/pages/ContentPublishingCenterPage.tsx",
    "client/src/pages/DeliveryReportsCenterPage.tsx",
    "client/src/components/DashboardLayout.tsx",
  ];
  const blob = [...new Set(mainFiles)].filter(exists).map(read).join("\n");

  const forbiddenSuccess = [
    /mockSuccess/i,
    /fake\s+publish(?!ed)/i,
    /fake\s+inclusion/i,
    /假装(已)?发布成功/,
    /mock.*publish.*success/i,
  ];
  let mockOk = true;
  for (const re of forbiddenSuccess) {
    if (re.test(blob)) {
      mockOk = false;
      report.mockFakeChrome.mockFake.push(`主链路命中禁止模式: ${re}`);
    }
  }
  if (mockOk) {
    report.mockFakeChrome.mockFake.push("未发现 fake publish / fake inclusion 作为成功逻辑的主链路文案");
  }

  const chromeMain = /下载 Chrome 插件|安装 Chrome 插件|browser-extension\.zip/.test(blob);
  const chromeLegacyOnly =
    blob.includes("旧版 Chrome 插件") &&
    blob.includes("历史兼容") &&
    !/下载 Chrome 插件/.test(blob.replace(/旧版 Chrome 插件[\s\S]{0,120}/g, ""));

  let chromeOk = true;
  if (chromeMain && !chromeLegacyOnly) {
    chromeOk = false;
    report.mockFakeChrome.chrome.push("主链路存在 Chrome 插件主入口文案");
  } else if (blob.includes("旧版 Chrome 插件")) {
    report.mockFakeChrome.chrome.push("仅折叠区「旧版 Chrome 插件」历史兼容说明（非主链路）");
  } else {
    report.mockFakeChrome.chrome.push("主链路无 Chrome 插件下载主入口");
  }

  report.mockFakeChrome.pass = mockOk && chromeOk;
  return report.mockFakeChrome.pass;
}

async function probeRuntime() {
  const base = process.env.GEO_RUNTIME_AUDIT_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    report.runtimeProbe = { skipped: true, reason: "未设置 GEO_RUNTIME_AUDIT_BASE_URL" };
    return;
  }
  try {
    const res = await fetch(`${base}/downloads/manifest.json`, { method: "GET", redirect: "follow" });
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const jsonOk = ct.includes("json") && text.includes("macZipUrl");
    report.runtimeProbe = {
      skipped: false,
      url: `${base}/downloads/manifest.json`,
      status: res.status,
      contentType: ct,
      manifestParseable: jsonOk,
      pass: res.ok && jsonOk,
    };
    if (!report.runtimeProbe.pass) {
      report.realRisks.push(`运行时 manifest 探针失败: HTTP ${res.status} ${ct}`);
    }
  } catch (e) {
    report.runtimeProbe = { skipped: false, error: String(e), pass: false };
    report.realRisks.push(`运行时探针异常: ${e}`);
  }
}

async function main() {
const appSource = read("client/src/App.tsx");

gate("mainChain.routes", checkMainChain(appSource), "8 条主链路 Route + 页面绑定");
gate("redirects", checkRedirects(appSource), "legacy 重定向");
gate("clientsEntry", checkClientsEntry(), "/clients 唯一日常新建入口");
gate("workspace", checkWorkspace(), "/workspace 承接 activeProjectId");

const subOk =
  runSubprocess("scripts/project_context_unification_acceptance.mjs") &&
  runSubprocess("scripts/client_dashboard_single_entry_acceptance.mjs") &&
  runSubprocess("scripts/business_pages_force_project_acceptance.mjs") &&
  runSubprocess("scripts/enterprise_workspace_state_machine_acceptance.mjs");
gate("projectIdForce.subprocess", subOk, "projectId 静态验收脚本套件");

gate("api500.static", checkApi500Risks(), "API 500 静态风险（不含可选 DB 实调）");
gate("mockFakeChrome", checkMockFakeChrome(), "mock/fake/Chrome 主链路");

await probeRuntime();

report.pass = failed === 0;
report.nextSteps = report.pass
  ? ["可进入 Phase-2（建议配置 DATABASE_URL 后做 tRPC/浏览器实调）"]
  : ["修复闸门失败项后重跑 node scripts/geo_main_flow_runtime_audit.mjs"];

if (!process.env.DATABASE_URL) {
  report.realRisks.push("本机无 DATABASE_URL：未实测 geo.projects.list / 主链路 API 响应");
}
if (report.clientsEntry.legacyOnboardingCreate) {
  report.realRisks.push("/legacy/onboarding 仍保留 createProject（非日常入口，需培训勿推广）");
}
report.realRisks.push("GeoPages legacy URL（/projects、/questions）仍可直达 — 非本 Phase 范围");

function buildMarkdown() {
  const lines = [
    "# " + PHASE + " 报告",
    "",
    "- **时间**: " + report.scannedAt,
    "- **结论**: " + (report.pass ? "**PASS**" : "**FAIL**"),
    "",
    "## 闸门",
    "",
  ];
  for (const [k, v] of Object.entries(report.gates)) {
    lines.push(`- **${k}**: ${v.pass ? "通过" : "失败"} — ${v.detail}`);
  }
  lines.push("", "## 8 条主链路", "", "| 路径 | Route | 文件 | activeProject | 结果 |", "|------|-------|------|---------------|------|");
  for (const r of report.mainChain) {
    lines.push(
      `| ${r.path} | ${r.routeRegistered ? "Y" : "N"} ${r.component} | ${r.fileExists ? "Y" : "N"} | ${r.activeProjectBinding ? "Y" : "N"} | ${r.pass ? "PASS" : "FAIL"} |`,
    );
  }
  lines.push("", "## 重定向", "");
  for (const r of report.redirects) {
    lines.push(`- ${r.path} -> ${r.actual ?? "缺失"} (期望 ${r.expected}) ${r.pass ? "OK" : "FAIL"}`);
  }
  lines.push("", "## activeProjectId / projectId", "");
  for (const s of report.projectIdForce.subprocess) {
    lines.push(`- ${s.script}: ${s.pass ? "通过" : "失败"}`, "  " + s.tail.replace(/\n/g, "\n  "));
  }
  lines.push(
    "",
    "## /clients 入口",
    "",
    "- 客户台可新建: " + report.clientsEntry.clientsHasCreate,
    "- 建档页无 create: " + report.clientsEntry.assetCenterNoCreate,
    "- App 无项目门禁: " + report.clientsEntry.appRedirectsWithoutProject,
    "- legacy onboarding 仍有 create: " + report.clientsEntry.legacyOnboardingCreate,
    "",
    "## /workspace",
    "",
    "- 使用 activeProject + summary API: " + report.workspace.pass,
    "",
    "## API 500 风险（静态）",
    "",
  );
  for (const r of report.api500Risks) {
    lines.push(`- ${r.pass ? "OK" : "FAIL"} ${r.id}: ${r.detail}`);
  }
  lines.push("", "## mock / fake / Chrome", "");
  for (const s of report.mockFakeChrome.mockFake) lines.push("- " + s);
  for (const s of report.mockFakeChrome.chrome) lines.push("- " + s);
  lines.push("", "## 运行时探针", "", JSON.stringify(report.runtimeProbe, null, 2), "", "## 真实风险", "");
  for (const s of report.realRisks) lines.push("- " + s);
  lines.push("", "## 下一步", "");
  for (const s of report.nextSteps) lines.push("- " + s);
  return lines.join("\n");
}
const md = buildMarkdown();

mkdirSync(resolve(root, "artifacts"), { recursive: true });
writeFileSync(resolve(root, "artifacts/geo-main-flow-runtime-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(root, "artifacts/geo-main-flow-runtime-audit.md"), `${md}\n`);

console.log(`\n=== ${PHASE} ${report.pass ? "PASSED" : "FAILED"} (${failed} gate failures) ===\n`);
console.log("Wrote artifacts/geo-main-flow-runtime-audit.md");
process.exit(report.pass ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

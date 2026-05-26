#!/usr/bin/env node
/**
 * GEO Phase-2: legacy 路由审计（只读，不删除/不移动文件）
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { resolve, relative, basename, extname } from "node:path";

const root = resolve(process.cwd());
const read = rel => readFileSync(resolve(root, rel), "utf-8");

const V1_MAIN_PATHS = new Set([
  "/clients",
  "/workspace",
  "/enterprise-profile",
  "/ai-diagnosis",
  "/weekly",
  "/content-publishing",
  "/inclusion-monitoring",
  "/delivery-reports",
]);

const PROTECTED_PAGE_FILES = new Set([
  "client/src/pages/ClientDashboardPage.tsx",
  "client/src/pages/EnterpriseWorkspacePage.tsx",
  "client/src/pages/AssetCenter.tsx",
  "client/src/pages/WeeklyContentPage.tsx",
  "client/src/pages/ContentPublishingCenterPage.tsx",
  "client/src/pages/DeliveryReportsCenterPage.tsx",
  "client/src/pages/V12FlowPages.tsx",
  "client/src/pages/AiSearchEvidencePage.tsx",
  "client/src/pages/DeliveryReportPublicPage.tsx",
  "client/src/pages/DeliveryReportPublicEvidencePage.tsx",
  "client/src/pages/DeliveryReportSharePage.tsx",
  "client/src/pages/GeoPublicContent.tsx",
  "client/src/pages/NotFound.tsx",
]);

const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walkDir(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    const full = resolve(dir, ent.name);
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
    if (ent.isDirectory()) walkDir(full, acc);
    else if (TEXT_EXT.has(extname(ent.name))) acc.push(full);
  }
  return acc;
}

function parseAppRoutes(appSource) {
  const routes = [];
  const routeRe = /<Route\s+path="([^"]+)"(?:\s+component=\{(\w+)\})?/g;
  let m;
  while ((m = routeRe.exec(appSource))) {
    routes.push({ path: m[1], component: m[2] || null, kind: "route" });
  }
  const redirectRe = /<Route\s+path="([^"]+)"[^>]*>\s*<Redirect\s+to="([^"]+)"/g;
  while ((m = redirectRe.exec(appSource))) {
    routes.push({ path: m[1], redirectTo: m[2], kind: "redirect" });
  }
  return routes;
}

function parseNav(appLayoutSource) {
  const inNav = new Map();
  const aliasRe = /path:\s*"([^"]+)"[\s\S]*?aliases:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = aliasRe.exec(appLayoutSource))) {
    const primary = m[1];
    const aliases = m[2].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, "")) ?? [];
    for (const p of [primary, ...aliases]) {
      inNav.set(p, primary);
    }
  }
  return inNav;
}

function pageFiles() {
  const dir = resolve(root, "client/src/pages");
  return readdirSync(dir)
    .filter(f => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map(f => `client/src/pages/${f}`);
}

function stemFromPage(rel) {
  return basename(rel, extname(rel)).replace(/Page$/, "");
}

function findProductionImports(relPath, sourceFiles) {
  const refs = [];
  const stem = basename(relPath, extname(relPath));
  const patterns = [
    relPath,
    relPath.replace(/^client\/src\//, "@/"),
    `@/pages/${basename(relPath)}`.replace(/\.tsx$/, ""),
    stem,
  ];
  for (const abs of sourceFiles) {
    const rel = relative(root, abs).replace(/\\/g, "/");
    if (rel.startsWith("client/src/pages/")) continue;
    if (!rel.startsWith("client/src/")) continue;
    const content = readFileSync(abs, "utf-8");
    for (const p of patterns) {
      if (p.length >= 4 && content.includes(p)) {
        refs.push(rel);
        break;
      }
    }
  }
  return [...new Set(refs)];
}

function findTestRefs(relPath) {
  const refs = [];
  const stem = basename(relPath, extname(relPath));
  const patterns = [relPath, stem, basename(relPath)];
  for (const abs of walkDir(resolve(root, "server"))) {
    if (!abs.endsWith(".test.ts") && !abs.endsWith(".spec.ts")) continue;
    const content = readFileSync(abs, "utf-8");
    for (const p of patterns) {
      if (content.includes(p)) {
        refs.push(relative(root, abs).replace(/\\/g, "/"));
        break;
      }
    }
  }
  return refs;
}

function findScriptRefs(relPath) {
  const refs = [];
  const stem = basename(relPath, extname(relPath));
  for (const abs of walkDir(resolve(root, "scripts"))) {
    const content = readFileSync(abs, "utf-8");
    if (content.includes(relPath) || content.includes(stem)) {
      refs.push(relative(root, abs).replace(/\\/g, "/"));
    }
  }
  return refs;
}

function routesForComponent(componentName, appRoutes, appSource) {
  if (!componentName) return [];
  return appRoutes.filter(r => r.component === componentName).map(r => r.path);
}

function classifyRow(row) {
  if (row.protected) {
    return { action: "保留", phase: "暂缓", blocked: false, protectedMain: true };
  }
  if (row.file.includes("Home.tsx")) {
    return { action: "已删除（Phase-3A）", phase: "Phase-3", blocked: false };
  }
  if (row.deadExport) {
    return {
      action: "Phase-3 删除",
      phase: "Phase-3",
      blocked: true,
      note: "模块级死代码；需先确认无符号 import",
    };
  }
  if (row.routes.length === 0 && row.productionImports.length === 0) {
    if (row.testRefs.length || row.scriptRefs.length) {
      return { action: "Phase-3 改验收后删除", phase: "Phase-3", blocked: true };
    }
    return { action: "Phase-3 删除", phase: "Phase-3", blocked: false };
  }
  if (row.file.includes("DemoGeo") || row.routes.some(p => p.startsWith("/demo"))) {
    if (row.routes.some(p => p.includes("→"))) {
      return { action: "已归档（重定向）", phase: "Phase-3B", blocked: false };
    }
    return { action: "Phase-3 归档", phase: "Phase-3", blocked: row.testRefs.length > 0 };
  }
  if (row.file.includes("Onboarding")) {
    return { action: "Phase-3 归档", phase: "Phase-3", blocked: true };
  }
  if (row.file.includes("GeoFlowWizard") || row.routes.some(p => p.startsWith("/flow"))) {
    if (row.routes.some(p => p.includes("→"))) {
      return { action: "已归档（重定向）", phase: "Phase-3B", blocked: false };
    }
    return { action: "Phase-3 归档", phase: "Phase-3", blocked: true };
  }
  if (row.file.includes("Progress")) {
    return { action: "Phase-3 归档", phase: "Phase-4", blocked: row.testRefs.length > 0 };
  }
  if (row.file.includes("GeoPages")) {
    return { action: "暂缓，需人工确认", phase: "暂缓", blocked: true };
  }
  if (row.file.includes("V1Workbench")) {
    return { action: "Phase-3 归档", phase: "Phase-3", blocked: true };
  }
  return { action: "暂缓，需人工确认", phase: "暂缓", blocked: row.testRefs.length > 0 };
}

function main() {
  const appSource = read("client/src/App.tsx");
  const layoutSource = read("client/src/components/DashboardLayout.tsx");
  const appRoutes = parseAppRoutes(appSource);
  const navMap = parseNav(layoutSource);
  const sourceFiles = walkDir(resolve(root, "client/src"));

  const importToComponent = {};
  const importRe = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+["']\.\/pages\/([^"']+)["']/g;
  let im;
  while ((im = importRe.exec(appSource))) {
    const named = im[1];
    const def = im[2];
    const mod = im[3];
    if (named) {
      for (const part of named.split(",")) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        importToComponent[name] = mod;
      }
    }
    if (def) importToComponent[def] = mod;
  }
  importRe.lastIndex = 0;
  const directRe = /import\s+(\w+)\s+from\s+["']\.\/pages\/([^"']+)["']/g;
  while ((im = directRe.exec(appSource))) {
    importToComponent[im[1]] = im[2];
  }
  const reExportRe = /export\s+\{([^}]+)\s+as\s+(\w+)\}\s+from\s+["']\.\/([^"']+)["']/g;
  while ((im = reExportRe.exec(appSource))) {
    importToComponent[im[2]] = im[3];
  }

  const rows = [];
  for (const file of pageFiles()) {
    const content = read(file);
    const defaultName = content.match(/export\s+default\s+function\s+(\w+)/)?.[1];
    const base = basename(file, ".tsx");

    const routedPaths = [];
    for (const r of appRoutes) {
      if (r.kind === "route" && r.component) {
        const mod = importToComponent[r.component];
        if (mod && file.endsWith(`${mod}.tsx`)) routedPaths.push(r.path);
        if (r.component === defaultName || r.component === base.replace(".tsx", "")) {
          routedPaths.push(r.path);
        }
      }
      if (r.kind === "redirect" && file.includes("Onboarding") && r.path === "/onboarding") {
        routedPaths.push(`${r.path} → ${r.redirectTo}`);
      }
    }

    if (file.endsWith("pages/DemoGeo.tsx")) {
      for (const r of appRoutes) {
        if (r.kind === "redirect" && (r.path === "/demo" || r.path === "/demo/geo")) {
          routedPaths.push(`${r.path} → ${r.redirectTo}`);
        }
      }
    }
    if (file.endsWith("pages/GeoFlowWizard.tsx")) {
      const flowRedirect = appRoutes.find(r => r.kind === "redirect" && r.path === "/flow");
      if (flowRedirect) routedPaths.push(`/flow → ${flowRedirect.redirectTo}`);
    }

    const navLabels = [];
    for (const p of routedPaths) {
      const primary = navMap.get(p);
      if (primary) navLabels.push(primary);
    }
    const inMainNav = navLabels.length > 0 ? `是（高亮别名→${[...new Set(navLabels)].join("、")}）` : "否";

    const isV1 = routedPaths.some(p => V1_MAIN_PATHS.has(p.replace(/ →.*/, "")));
    const protectedPage = PROTECTED_PAGE_FILES.has(file);

    rows.push({
      file,
      routes: [...new Set(routedPaths)],
      inMainNav,
      v1MainChain: protectedPage || isV1 ? "是" : "否",
      productionImports: findProductionImports(file, sourceFiles),
      testRefs: findTestRefs(file),
      scriptRefs: findScriptRefs(file),
      protected: protectedPage,
      deadExport: false,
    });
  }

  // V1Workbench component (not a page file)
  rows.push({
    file: "client/src/components/V1WorkbenchOverview.tsx",
    routes: ["/flow → /workspace（Phase-3B 已重定向，不经本组件）"],
    inMainNav: "否（已移除 /flow 侧栏别名）",
    v1MainChain: "否（正式入口为 /workspace + EnterpriseWorkspacePage）",
    productionImports: findProductionImports(
      "client/src/components/V1WorkbenchOverview.tsx",
      sourceFiles,
    ),
    testRefs: findTestRefs("V1WorkbenchOverview.tsx"),
    scriptRefs: findScriptRefs("V1WorkbenchOverview.tsx"),
    protected: false,
    deadExport: false,
  });

  // Dead exports
  const deadExports = [
    {
      file: "client/src/pages/V12FlowPages.tsx#ContentGenerationFlowPage",
      routes: ["（无 Route）"],
      note: "已由 /weekly + WeeklyContentPage 取代",
    },
    {
      file: "client/src/pages/GeoPages.tsx#MonitoringPage",
      routes: ["（无 Route；/monitoring → InclusionMonitoringFlowPage）"],
      note: "与 GeoPages.MonitoringPage 重复",
    },
    {
      file: "client/src/pages/GeoPages.tsx#ReportsPage",
      routes: ["（无 Route；/reports → DeliveryReportsFlowPage）"],
      note: "与 GeoPages.ReportsPage 重复",
    },
  ];
  for (const d of deadExports) {
    rows.push({
      file: d.file,
      routes: d.routes,
      inMainNav: "否",
      v1MainChain: "否",
      productionImports: [],
      testRefs: findTestRefs("V12FlowPages.tsx").concat(findTestRefs("GeoPages.tsx")),
      scriptRefs: findScriptRefs(basename(d.file)),
      protected: false,
      deadExport: true,
      note: d.note,
    });
  }

  for (const row of rows) {
    const misclick =
      row.routes.length > 0 && row.inMainNav.startsWith("是")
        ? "低（侧栏高亮别名，点击进主链）"
        : row.routes.length > 0
          ? "中（URL 直达旧工程页）"
          : "低（无路由）";
    row.misclickRisk = misclick;
    const c = classifyRow(row);
    row.action = c.action;
    row.phase = c.phase;
    row.blocked = c.blocked;
  }

  const summary = {
    scannedAt: new Date().toISOString(),
    total: rows.length,
    protected: rows.filter(r => r.protected).length,
    byAction: {},
    blocked: rows.filter(r => r.blocked).length,
  };
  for (const r of rows) {
    summary.byAction[r.action] = (summary.byAction[r.action] || 0) + 1;
  }

  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  writeFileSync(resolve(root, "artifacts/geo-phase2-legacy-route-audit.json"), JSON.stringify({ summary, rows }, null, 2));

  const md = buildMarkdown(summary, rows, appRoutes, navMap);
  writeFileSync(resolve(root, "artifacts/geo-phase2-legacy-route-audit.md"), md);

  console.log("Phase-2 legacy route audit complete:");
  console.log(JSON.stringify(summary, null, 2));
  console.log("Wrote artifacts/geo-phase2-legacy-route-audit.md");
}

function buildMarkdown(summary, rows, appRoutes, navMap) {
  const lines = [];
  lines.push("# GEO Phase-2 Legacy 路由审计报告");
  lines.push("");
  lines.push(`生成时间: ${summary.scannedAt}`);
  lines.push("");
  lines.push("> **本轮未删除/未移动任何页面文件；未改主链路业务逻辑。**");
  lines.push("");
  lines.push("## 结论摘要");
  lines.push("");
  lines.push(`- 审计对象: ${summary.total} 项（含页面文件 + V1Workbench 组件 + 死 export）`);
  lines.push(`- P0 主链路 protected: ${summary.protected} 个页面文件`);
  lines.push(`- 测试/脚本阻断 (blocked): ${summary.blocked} 项`);
  lines.push("- 动作分布:");
  for (const [k, v] of Object.entries(summary.byAction).sort()) {
    lines.push(`  - ${k}: ${v}`);
  }
  lines.push("");
  lines.push("## Home.tsx 处理建议");
  lines.push("");
  lines.push("| 选项 | 说明 |");
  lines.push("|------|------|");
  lines.push("| **A. 保留弱跳转** | 维持文件，可选在组件内 redirect `/clients`（本轮未做） |");
  lines.push("| **B. `/` 已重定向 + Phase-3 删 Home** | **推荐**；`/`、`/home` 已 → `/clients`；删 Home 需改 4 处测试/脚本 readFile |");
  lines.push("| **C. 暂缓** | V1.0 交付后再删 |");
  lines.push("");
  lines.push("**现状**: `Home.tsx` **无 Route**；`/`、`/home` 在 App.tsx 已 `<Redirect to=\"/clients\" />`。");
  lines.push("");
  lines.push("**Phase-3 删 Home 需同步**:");
  lines.push("- `server/v12HomeStatic.test.ts`");
  lines.push("- `server/v12UiRefactorStatic.test.ts`");
  lines.push("- `scripts/v12_ui_acceptance_check.mjs`（`sources.home` 改为仅 `V1WorkbenchOverview` 或 `EnterpriseWorkspacePage`）");
  lines.push("- `scripts/v12_ui_phase2_fix.mjs`");
  lines.push("");
  lines.push("## 主链路保护（未改动）");
  lines.push("");
  for (const p of [...V1_MAIN_PATHS]) {
    lines.push(`- \`${p}\` — protected`);
  }
  lines.push("");
  lines.push("## Legacy 路由全表");
  lines.push("");
  lines.push("| 文件路径 | 路由路径 | 主导航 | V1主链 | 生产import | 测试引用 | 脚本引用 | 误触风险 | 建议处理 | 阶段 | blocked |");
  lines.push("|----------|----------|--------|--------|-------------|----------|----------|----------|----------|------|---------|");
  for (const r of rows) {
    const prod = r.productionImports.length ? `${r.productionImports.length}处` : "无";
    const tst = r.testRefs.length ? `${r.testRefs.length}处` : "无";
    const scr = r.scriptRefs.length ? `${r.scriptRefs.length}处` : "无";
    lines.push(
      `| \`${r.file}\` | ${r.routes.join("<br>") || "—"} | ${r.inMainNav} | ${r.v1MainChain} | ${prod} | ${tst} | ${scr} | ${r.misclickRisk} | ${r.action} | ${r.phase} | ${r.blocked ? "是" : "否"} |`,
    );
  }
  lines.push("");
  lines.push("## 重定向路由（非页面文件）");
  lines.push("");
  for (const r of appRoutes.filter(x => x.kind === "redirect")) {
    lines.push(`- \`${r.path}\` → \`${r.redirectTo}\``);
  }
  lines.push("");
  lines.push("## 侧栏别名中的 Legacy 路径（仍可 URL 访问）");
  lines.push("");
  const aliasLegacy = ["/flow", "/projects", "/questions", "/responses", "/analysis", "/scores", "/diagnosis", "/assets", "/publish", "/monitoring", "/reports", "/articles", "/content-generation"];
  for (const p of aliasLegacy) {
    const primary = navMap.get(p) || "—";
    lines.push(`- \`${p}\` → 侧栏高亮归属 \`${primary}\`（点击侧栏进主链 canonical 路径）`);
  }
  lines.push("");
  lines.push("## Phase-3 第一批建议（blocked=否 优先）");
  lines.push("");
  lines.push("1. 删除 `GeoPages.tsx` 内死 export：`MonitoringPage`、`ReportsPage`（模块内，无 Route）");
  lines.push("2. 删除 `V12FlowPages.tsx` 内 `ContentGenerationFlowPage`（无 Route）");
  lines.push("3. 归档或删除 `Home.tsx`（改 4 处验收后）");
  lines.push("4. 归档 `/demo` + `DemoGeo.tsx`（保留测试则先改 `v12DemoGeoPage.test.ts`）");
  lines.push("");
  return lines.join("\n");
}

main();

#!/usr/bin/env node
/**
 * GEO-V1-System-Cleanup-Audit — dry-run only (no delete, no DB write).
 * 用法: node scripts/geo_cleanup_dry_run.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, extname, basename } from "node:path";

const root = resolve(process.cwd());
const read = rel => readFileSync(resolve(root, rel), "utf-8");

/** C 类：明确可 dry-run 的删除/归档候选（不含 public/downloads 二进制） */
/** Phase-3A 已删除 Home.tsx */
const DELETE_CANDIDATE_REL_PATHS = [];

/** B 类：legacy / 归档候选（dry-run 标记为 archive，默认 blocked 若仍被路由引用） */
const ARCHIVE_CANDIDATE_REL_PATHS = [
  "client/src/pages/OnboardingPage.tsx",
  "client/src/pages/DemoGeo.tsx",
  "client/src/pages/GeoFlowWizard.tsx",
  "client/src/components/V1WorkbenchOverview.tsx",
];

const PROTECTED_ROUTE_MARKERS = [
  'path="/clients"',
  'path="/workspace"',
  'path="/enterprise-profile"',
  'path="/weekly"',
  'path="/content-publishing"',
  'path="/delivery-reports"',
  "ContentPublishingCenterPage",
  "DeliveryReportsCenterPage",
  "ClientDashboardPage",
  "EnterpriseWorkspacePage",
  "AssetCenter",
  "LocalAgentDownloadCard",
  "clientDashboard.listProjectsSummary",
];

const SOURCE_GLOBS_DIRS = [
  "client/src",
  "server",
  "shared",
  "scripts",
  "local-agent/src",
];

const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md"]);

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

function loadAllSourceFiles() {
  const files = [];
  for (const rel of SOURCE_GLOBS_DIRS) {
    walkDir(resolve(root, rel), files);
  }
  return files;
}

function moduleStem(relPath) {
  const base = basename(relPath, extname(relPath));
  return base;
}

function buildReferenceIndex(sourceFiles) {
  const index = new Map();
  for (const abs of sourceFiles) {
    const content = readFileSync(abs, "utf-8");
    index.set(abs, content);
  }
  return index;
}

function findReferences(relPath, sourceIndex) {
  const refs = [];
  const rel = relPath.replace(/\\/g, "/");
  const stem = moduleStem(relPath);
  const patterns = [
    rel,
    rel.replace(/^client\/src\//, "@/"),
    `@/${rel.replace(/^client\/src\//, "")}`.replace(/\.tsx?$/, ""),
    stem,
  ];
  const uniquePatterns = [...new Set(patterns.filter(Boolean))];

  for (const [abs, content] of sourceIndex.entries()) {
    const relSrc = relative(root, abs).replace(/\\/g, "/");
    if (relSrc === rel) continue;
    for (const p of uniquePatterns) {
      if (p.length >= 4 && content.includes(p)) {
        refs.push(relSrc);
        break;
      }
    }
  }
  return [...new Set(refs)].sort();
}

function isProtectedByApp(relPath) {
  const app = read("client/src/App.tsx");
  const stem = moduleStem(relPath);
  if (app.includes(stem)) return ["App.tsx route/import"];
  for (const m of PROTECTED_ROUTE_MARKERS) {
    if (app.includes(m) && relPath.includes("ClientDashboard")) return ["P0 protected marker"];
  }
  return [];
}

function classifyEntry(relPath, kind, sourceIndex) {
  const abs = resolve(root, relPath);
  let exists = true;
  try {
    statSync(abs);
  } catch {
    exists = false;
  }
  const refs = exists ? findReferences(relPath, sourceIndex) : [];
  const appRefs = exists ? isProtectedByApp(relPath) : [];
  const allRefs = [...new Set([...refs, ...appRefs])];
  const blocked = allRefs.length > 0;
  return {
    path: relPath,
    kind,
    exists,
    status: !exists ? "missing" : blocked ? "blocked" : "candidate",
    referencedBy: allRefs.slice(0, 30),
    referenceCount: allRefs.length,
  };
}

function scanOrphanComponents(sourceIndex) {
  const compDir = resolve(root, "client/src/components");
  const orphans = [];
  walkDir(compDir).forEach(abs => {
    if (!/\.(tsx|ts)$/.test(abs)) return;
    const rel = relative(root, abs).replace(/\\/g, "/");
    if (rel.includes("/ui/")) return;
    const refs = findReferences(rel, sourceIndex);
    if (refs.length === 0) orphans.push(rel);
  });
  return orphans;
}

function main() {
  const sourceFiles = loadAllSourceFiles();
  const sourceIndex = buildReferenceIndex(sourceFiles);

  const deleteResults = DELETE_CANDIDATE_REL_PATHS.map(p => classifyEntry(p, "delete-candidate", sourceIndex));
  const archiveResults = ARCHIVE_CANDIDATE_REL_PATHS.map(p => classifyEntry(p, "archive-candidate", sourceIndex));
  const orphanComponents = scanOrphanComponents(sourceIndex);

  const suspiciousUnreferenced = orphanComponents.filter(
    p => !DELETE_CANDIDATE_REL_PATHS.includes(p) && !ARCHIVE_CANDIDATE_REL_PATHS.includes(p),
  );

  const summary = {
    scannedAt: new Date().toISOString(),
    deleteCandidates: {
      total: deleteResults.length,
      blocked: deleteResults.filter(r => r.status === "blocked").length,
      ready: deleteResults.filter(r => r.status === "candidate").length,
      missing: deleteResults.filter(r => r.status === "missing").length,
    },
    archiveCandidates: {
      total: archiveResults.length,
      blocked: archiveResults.filter(r => r.status === "blocked").length,
      ready: archiveResults.filter(r => r.status === "candidate").length,
    },
    suspiciousUnreferencedComponents: suspiciousUnreferenced.length,
    legacyFiles: archiveResults.filter(r => r.status !== "missing").map(r => r.path),
  };

  const md = [];
  md.push("# GEO 清理 Dry-Run 结果");
  md.push("");
  md.push(`生成时间: ${summary.scannedAt}`);
  md.push("");
  md.push("> 本轮 **未执行任何删除**（无 rm / unlink / DELETE / DROP / TRUNCATE）。");
  md.push("");
  md.push("## 摘要");
  md.push("");
  md.push(`| 指标 | 数量 |`);
  md.push(`|------|------|`);
  md.push(`| C 类删除候选（清单内） | ${summary.deleteCandidates.total} |`);
  md.push(`| — 无引用可候选 (candidate) | ${summary.deleteCandidates.ready} |`);
  md.push(`| — 仍被引用阻断 (blocked) | ${summary.deleteCandidates.blocked} |`);
  md.push(`| B 类归档候选（清单内） | ${summary.archiveCandidates.total} |`);
  md.push(`| — 仍被引用阻断 (blocked) | ${summary.archiveCandidates.blocked} |`);
  md.push(`| 额外可疑零引用组件（非 ui/） | ${summary.suspiciousUnreferencedComponents} |`);
  md.push("");
  md.push("## C 类删除候选明细");
  md.push("");
  for (const r of deleteResults) {
    md.push(`### \`${r.path}\``);
    md.push(`- 状态: **${r.status}**`);
    md.push(`- 引用数: ${r.referenceCount}`);
    if (r.referencedBy.length) md.push(`- 引用方: ${r.referencedBy.map(x => `\`${x}\``).join(", ")}`);
    md.push("");
  }
  md.push("## B 类归档候选明细");
  md.push("");
  for (const r of archiveResults) {
    md.push(`### \`${r.path}\``);
    md.push(`- 状态: **${r.status}**`);
    md.push(`- 引用数: ${r.referenceCount}`);
    if (r.referencedBy.length) md.push(`- 引用方: ${r.referencedBy.map(x => `\`${x}\``).join(", ")}`);
    md.push("");
  }
  if (suspiciousUnreferenced.length) {
    md.push("## 额外可疑零引用组件（未在预设清单）");
    md.push("");
    for (const p of suspiciousUnreferenced.slice(0, 40)) {
      md.push(`- \`${p}\``);
    }
    if (suspiciousUnreferenced.length > 40) {
      md.push(`- … 另有 ${suspiciousUnreferenced.length - 40} 个`);
    }
    md.push("");
  }

  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  writeFileSync(resolve(root, "artifacts/geo-cleanup-dry-run-result.md"), md.join("\n"));
  writeFileSync(
    resolve(root, "artifacts/geo-cleanup-dry-run-summary.json"),
    JSON.stringify({ summary, deleteResults, archiveResults, suspiciousUnreferenced }, null, 2),
  );

  console.log("Dry-run complete:");
  console.log(JSON.stringify(summary, null, 2));
  console.log("Wrote artifacts/geo-cleanup-dry-run-result.md");

  const blockedDeletes = deleteResults.filter(r => r.status === "blocked").length;
  if (blockedDeletes > 0) {
    console.log(`Note: ${blockedDeletes} delete-candidate(s) blocked by references — expected for Home.tsx etc.`);
  }
}

main();

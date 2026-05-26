#!/usr/bin/env node
/**
 * Agent-Mac-Manifest-Deploy-Sync-Fix：构建产物 manifest 与源 manifest 一致验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  inspectMacZipArtifact,
  isExternalMacZipUrl,
} from "./lib/macAgentZipArtifact.mjs";

const PHASE = "Agent-Mac-Static-Asset-Delivery-Fix";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceManifestPath = path.join(root, "client/public/downloads/manifest.json");
const reportPath = path.join(root, "artifacts/agent-mac-manifest-deploy-sync.md");
const EXPECTED_ZIP = "/downloads/geo-local-agent-mac.zip";

const outputCandidates = [
  "dist/public/downloads/manifest.json",
  "dist/downloads/manifest.json",
  "client/dist/downloads/manifest.json",
  "client/build/downloads/manifest.json",
  "build/downloads/manifest.json",
];

/** @type {Record<string, unknown>} */
const report = {
  phase: PHASE,
  sourceManifestPath,
  sourceMacZipUrl: null,
  sourceMacDmgUrl: null,
  buildOutputManifestPath: null,
  buildMacZipUrl: null,
  buildMacDmgUrl: null,
  exposesOldDmg: null,
  conclusion: "未通过",
  risks: [],
  errors: [],
};

function ensureArtifactsDir() {
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeReport() {
  ensureArtifactsDir();
  const lines = [
    `# ${PHASE} 报告`,
    "",
    `- **Phase**：${report.phase}`,
    `- **源 manifest 路径**：\`${report.sourceManifestPath}\``,
    `- **源 macZipUrl**：${report.sourceMacZipUrl ?? "—"}`,
    `- **源 macDmgUrl**：${report.sourceMacDmgUrl ?? "—"}`,
    `- **构建输出 manifest 路径**：${report.buildOutputManifestPath ? `\`${report.buildOutputManifestPath}\`` : "—"}`,
    `- **构建输出 macZipUrl**：${report.buildMacZipUrl ?? "—"}`,
    `- **构建输出 macDmgUrl**：${report.buildMacDmgUrl ?? "—"}`,
    `- **是否存在旧 dmg 暴露**：${report.exposesOldDmg ?? "—"}`,
    "",
    "## 静态资源链路说明",
    "",
    "- Vite `publicDir` = `client/public`，构建输出 `dist/public`（见 `vite.config.ts`）。",
    "- 生产 `pnpm start` 应服务 `dist/public`（见 `server/_core/vite.ts` `serveStatic`）。",
    "- Manus 开发隧道通常跑 `pnpm dev`（Vite），直接读 `client/public/downloads/manifest.json`。",
    "- `copy_local_agent_download.mjs` 支持 `AGENT_MAC_ZIP_URL`，固定 `macDmgUrl: null`。",
    "",
    "## 最终结论",
    "",
    report.conclusion,
    "",
    "## 真实风险",
    "",
    ...(report.risks.length ? report.risks.map(r => `- ${r}`) : ["- （无）"]),
    "",
    "## 错误明细",
    "",
    ...(report.errors.length ? report.errors.map(e => `- ${e}`) : ["- （无）"]),
    "",
    `_生成时间：${new Date().toISOString()}_`,
  ];
  fs.writeFileSync(reportPath, lines.join("\n"));
}

function fail(msg) {
  report.errors.push(msg);
  report.conclusion = `**未通过**：${msg}`;
  console.error(`[FAIL] ${msg}`);
  writeReport();
  process.exit(1);
}

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function readManifest(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function isValidMacZipUrl(macZipUrl) {
  if (macZipUrl === EXPECTED_ZIP) return true;
  return typeof macZipUrl === "string" && /^https?:\/\/.+/i.test(macZipUrl);
}

function assertManifest(manifest, label) {
  if (!isValidMacZipUrl(manifest.macZipUrl)) {
    fail(`${label} macZipUrl 无效：${manifest.macZipUrl}`);
  }
  if (manifest.macDmgUrl != null) {
    fail(`${label} macDmgUrl 应为 null，实际：${manifest.macDmgUrl}`);
  }
}

if (!fs.existsSync(sourceManifestPath)) {
  fail(`源 manifest 不存在：${sourceManifestPath}`);
}

const sourceManifest = readManifest(sourceManifestPath);
report.sourceMacZipUrl = sourceManifest.macZipUrl ?? null;
report.sourceMacDmgUrl = sourceManifest.macDmgUrl ?? null;
assertManifest(sourceManifest, "源 manifest");
ok("源 manifest macZipUrl / macDmgUrl 正确");

const buildManifestPath = outputCandidates
  .map(rel => path.join(root, rel))
  .find(p => fs.existsSync(p));

if (!buildManifestPath) {
  report.risks.push("未找到 build 输出 manifest，请先执行 pnpm build。");
  fail(
    `构建输出 manifest 不存在。已检查：\n${outputCandidates.map(p => `  - ${p}`).join("\n")}`,
  );
}

report.buildOutputManifestPath = path.relative(root, buildManifestPath);
const buildManifest = readManifest(buildManifestPath);
report.buildMacZipUrl = buildManifest.macZipUrl ?? null;
report.buildMacDmgUrl = buildManifest.macDmgUrl ?? null;
report.exposesOldDmg = buildManifest.macDmgUrl != null;

assertManifest(buildManifest, "构建输出 manifest");
ok(`构建输出 manifest：${report.buildOutputManifestPath}`);

const sourceRaw = fs.readFileSync(sourceManifestPath, "utf-8").trim();
const buildRaw = fs.readFileSync(buildManifestPath, "utf-8").trim();
if (sourceRaw !== buildRaw) {
  report.risks.push("源 manifest 与构建输出 manifest 文本不完全相同（可能仅 copiedAt 等元数据差异），但 macZipUrl/macDmgUrl 已对齐。");
  const keys = ["macZipUrl", "macDmgUrl", "version"];
  for (const k of keys) {
    if (JSON.stringify(sourceManifest[k]) !== JSON.stringify(buildManifest[k])) {
      fail(`源与构建 manifest 字段 ${k} 不一致`);
    }
  }
  ok("关键字段 macZipUrl / macDmgUrl / version 与源 manifest 一致");
} else {
  ok("构建输出 manifest 与源 manifest 文本完全一致");
}

const distZipPath = path.join(root, "dist/public/downloads/geo-local-agent-mac.zip");
if (isExternalMacZipUrl(buildManifest.macZipUrl)) {
  ok("构建 manifest 使用外部 HTTPS macZipUrl，跳过 dist zip 体积校验");
} else if (buildManifest.macZipUrl === EXPECTED_ZIP) {
  const distZip = inspectMacZipArtifact(distZipPath);
  if (!distZip.ok) {
    fail(
      `相对 macZipUrl 要求 dist 内有效 zip，但 ${path.relative(root, distZipPath)}：${distZip.reason ?? "无效"}`,
    );
  }
  ok(`dist zip 有效（${((distZip.size ?? 0) / 1024 / 1024).toFixed(1)} MB）`);
}

report.conclusion =
  "**通过（本地构建产物）**：manifest 与 dist zip 已对齐。Git 部署须 AGENT_MAC_ZIP_URL 或构建机生成 zip 后随 dist 发布。";
report.risks.push(
  "Manus 从 Git 构建时 *.zip 不入库；未配置 AGENT_MAC_ZIP_URL 时勿使用相对 /downloads/*.zip 对外承诺可下载。",
);
writeReport();
console.log(`\n=== ${PHASE} build output acceptance PASSED ===\n`);
console.log(`报告：${reportPath}`);

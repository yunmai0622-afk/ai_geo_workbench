#!/usr/bin/env node
/**
 * GEO-Local-Agent-Download-Entry-Full-Audit-P0：线上 Mac zip 真实下载验收
 * 校验 manifest / 直连入口 / GitHub Release / zip 内版本与 UX 文案 / build 不回退
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const PHASE = "GEO-Local-Agent-Download-Entry-Full-Audit-P0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(root, "artifacts");
const reportPath = path.join(artifactsDir, "agent-mac-online-download-verify.md");
const headersPath = path.join(artifactsDir, "agent-mac-online-download-headers.json");
const repoZipPath = path.join(root, "client/public/downloads/geo-local-agent-mac.zip");
const sourceManifestPath = path.join(root, "client/public/downloads/manifest.json");
const buildManifestPath = path.join(root, "dist/public/downloads/manifest.json");
const localAgentPkgPath = path.join(root, "local-agent/package.json");
const tmpZipPath = path.join(root, "tmp/agent-online-download/geo-local-agent-mac.zip");
const tmpExtractDir = path.join(root, "tmp/agent-online-download/extract");
const tmpAsarDir = path.join(root, "tmp/agent-online-download/asar");
const MIN_ZIP_BYTES = 50 * 1024 * 1024;
const DEFAULT_RELATIVE_ZIP = "/downloads/geo-local-agent-mac.zip";
const DIRECT_ZIP_PATH = "/downloads/geo-local-agent-mac.zip";
const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";
const NEW_UX_MARKERS = ["状态总览", "诊断与设置", "测试 Web 连接", "已同步到 GEO Web"];
const OLD_UX_MARKERS = ["快捷操作", "v1.0.17"];
const OLD_TAB_MARKERS = ['data-tab="diag"', 'data-tab="settings"'];

/** @type {Record<string, unknown>} */
const report = {
  phase: PHASE,
  expectedVersion: null,
  baseUrl: null,
  manifestUrl: null,
  manifestCheck: "未执行",
  directZipCheck: "未执行",
  macZipUrl: null,
  macDmgUrl: null,
  macZipSha256: null,
  macZipSizeBytes: null,
  zipUrl: null,
  zipHttpStatus: null,
  contentType: null,
  contentLength: null,
  headMethod: "HEAD",
  repoZipSize: null,
  onlineZipSize: null,
  onlineZipSha256: null,
  sha256Match: null,
  sizeMatch: null,
  hasAppBundle: null,
  appPackageVersion: null,
  newUxMarkersFound: null,
  oldUxMarkersFound: null,
  buildManifestAligned: null,
  unzipTest: null,
  conclusion: "未通过",
  risks: [],
  errors: [],
};

function ensureArtifactsDir() {
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
}

function writeReport() {
  ensureArtifactsDir();
  const lines = [
    `# ${PHASE} 线上验收报告`,
    "",
    `- **Phase**：${report.phase}`,
    `- **期望版本**：${report.expectedVersion ?? "—"}`,
    `- **线上域名**：${report.baseUrl ?? "（未设置）"}`,
    `- **manifest URL**：${report.manifestUrl ?? "—"}`,
    `- **manifest 检查**：${report.manifestCheck}`,
    `- **直连 zip 检查**：${report.directZipCheck}`,
    `- **macZipUrl**：${report.macZipUrl ?? "—"}`,
    `- **macDmgUrl**：${report.macDmgUrl ?? "—"}`,
    `- **manifest macZipSha256**：${report.macZipSha256 ?? "—"}`,
    `- **manifest macZipSizeBytes**：${report.macZipSizeBytes ?? "—"}`,
    `- **zip URL**：${report.zipUrl ?? "—"}`,
    `- **zip HTTP status**：${report.zipHttpStatus ?? "—"}`,
    `- **Content-Type**：${report.contentType ?? "—"}`,
    `- **Content-Length**：${report.contentLength ?? "—"}`,
    `- **HEAD/GET 方式**：${report.headMethod}`,
    `- **仓库 zip 大小（bytes）**：${report.repoZipSize ?? "—"}`,
    `- **线上下载 zip 大小（bytes）**：${report.onlineZipSize ?? "—"}`,
    `- **线上 zip sha256**：${report.onlineZipSha256 ?? "—"}`,
    `- **sha256 与 manifest 一致**：${report.sha256Match ?? "—"}`,
    `- **文件大小与 manifest 一致**：${report.sizeMatch ?? "—"}`,
    `- **zip 内含 .app**：${report.hasAppBundle ?? "—"}`,
    `- **zip 内 app version**：${report.appPackageVersion ?? "—"}`,
    `- **新版 UX 文案**：${report.newUxMarkersFound ?? "—"}`,
    `- **旧版特征**：${report.oldUxMarkersFound ?? "—"}`,
    `- **build manifest 对齐**：${report.buildManifestAligned ?? "—"}`,
    `- **unzip -t**：${report.unzipTest ?? "—"}`,
    "",
    "## 最终结论",
    "",
    report.conclusion,
    "",
    "## 真实风险",
    "",
    ...(report.risks.length ? report.risks.map(r => `- ${r}`) : ["- （无额外记录）"]),
    "",
    "## 错误明细",
    "",
    ...(report.errors.length ? report.errors.map(e => `- ${e}`) : ["- （无）"]),
    "",
    `_生成时间：${new Date().toISOString()}_`,
  ];
  fs.writeFileSync(reportPath, lines.join("\n"));
}

function skip(msg) {
  report.conclusion = `**SKIP**：${msg}`;
  console.log(`[SKIP] ${msg}`);
  writeReport();
  process.exit(0);
}

function fail(msg, exitCode = 1) {
  report.errors.push(msg);
  report.conclusion = `**未通过**：${msg}`;
  console.error(`[FAIL] ${msg}`);
  writeReport();
  process.exit(exitCode);
}

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function readExpectedVersion() {
  const pkg = JSON.parse(fs.readFileSync(localAgentPkgPath, "utf-8"));
  if (typeof pkg.version !== "string" || !pkg.version.trim()) {
    fail("local-agent/package.json 缺少 version");
  }
  return pkg.version.trim();
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function normalizeBaseUrl(raw) {
  const trimmed = String(raw).trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (/localhost|127\.0\.0\.1/i.test(trimmed)) {
    fail("线上验收禁止使用 localhost / 127.0.0.1");
  }
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function resolveZipUrl(macZipUrl, baseUrl) {
  if (!macZipUrl || typeof macZipUrl !== "string") return null;
  const url = macZipUrl.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return null;
}

function isValidMacZipUrl(macZipUrl) {
  if (!macZipUrl || typeof macZipUrl !== "string") return false;
  const url = macZipUrl.trim();
  if (url === DEFAULT_RELATIVE_ZIP) return true;
  if (/^https?:\/\/.+\.zip(\?|$)/i.test(url)) return true;
  if (/^https?:\/\/.+/i.test(url)) return true;
  return false;
}

function headersToObject(headers) {
  /** @type {Record<string, string>} */
  const out = {};
  headers.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function assertNotPlaceholderPayload(filePath, contentType) {
  const head = fs.readFileSync(filePath, { encoding: "utf-8", flag: "r" }).slice(0, 512);
  const lower = head.toLowerCase();
  if (contentType?.includes("text/html") || lower.includes("<!doctype") || lower.includes("<html")) {
    fail(
      "zip URL 返回 HTML，说明静态资源未真实部署或被 SPA fallback；请配置 manifest.macZipUrl 为真实 HTTPS Release URL。",
    );
  }
  if (head.startsWith(LFS_POINTER_PREFIX)) {
    fail("zip 内容为 Git LFS pointer，不是真实安装包；请拉取 LFS 或改用 Release/CDN URL。");
  }
}

async function downloadToFile(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetchWithTimeout(url, { method: "GET" }, 600_000);
  if (!res.ok) {
    fail(`zip GET 失败：HTTP ${res.status} ${url}`);
  }
  if (!res.body) fail("zip GET 响应无 body");
  const nodeStream = Readable.fromWeb(res.body);
  await pipeline(nodeStream, fs.createWriteStream(dest));
}

function assertZipContainsApp(zipPath) {
  const list = spawnSync("unzip", ["-l", zipPath], { encoding: "utf-8" });
  const out = (list.stdout || "") + (list.stderr || "");
  if (list.status !== 0) {
    fail(`unzip -l 失败：${out.slice(0, 500)}`);
  }
  if (!/\.app\//i.test(out)) {
    fail("zip 内未找到 .app bundle");
  }
  report.hasAppBundle = true;
  ok("zip 内含 .app bundle");
}

function findAppBundle(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) return full;
    if (entry.isDirectory()) {
      const nested = findAppBundle(full);
      if (nested) return nested;
    }
  }
  return null;
}

function inspectZipAppContents(zipPath, expectedVersion) {
  if (fs.existsSync(tmpExtractDir)) {
    fs.rmSync(tmpExtractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpExtractDir, { recursive: true });
  const unzip = spawnSync("unzip", ["-q", zipPath, "-d", tmpExtractDir], { encoding: "utf-8" });
  if (unzip.status !== 0) {
    fail(`解包 zip 失败：${unzip.stderr || unzip.stdout}`);
  }
  const appPath = findAppBundle(tmpExtractDir);
  if (!appPath) fail("解包后未找到 .app");

  const asarPath = path.join(appPath, "Contents/Resources/app.asar");
  if (!fs.existsSync(asarPath)) fail("app 内缺少 app.asar");

  if (fs.existsSync(tmpAsarDir)) {
    fs.rmSync(tmpAsarDir, { recursive: true, force: true });
  }
  const extractAsar = spawnSync("npx", ["--yes", "asar", "extract", asarPath, tmpAsarDir], {
    cwd: root,
    encoding: "utf-8",
  });
  if (extractAsar.status !== 0) {
    fail(`asar extract 失败：${extractAsar.stderr || extractAsar.stdout}`);
  }

  const appPkgPath = path.join(tmpAsarDir, "package.json");
  if (!fs.existsSync(appPkgPath)) fail("asar 内缺少 package.json");
  const appPkg = JSON.parse(fs.readFileSync(appPkgPath, "utf-8"));
  report.appPackageVersion = appPkg.version ?? null;
  if (appPkg.version !== expectedVersion) {
    fail(`zip 内 app version=${appPkg.version}，期望 ${expectedVersion}`);
  }
  ok(`zip 内 app version=${expectedVersion}`);

  const rendererText = ["dist/renderer/index.html", "dist/renderer/uxCopy.js", "dist/renderer/app.js"]
    .map(rel => {
      const p = path.join(tmpAsarDir, rel);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
    })
    .join("\n");

  const foundNew = NEW_UX_MARKERS.filter(m => rendererText.includes(m));
  report.newUxMarkersFound = foundNew.join(", ");
  if (foundNew.length < NEW_UX_MARKERS.length) {
    const missing = NEW_UX_MARKERS.filter(m => !foundNew.includes(m));
    fail(`zip 内缺少新版 UX 文案：${missing.join("、")}`);
  }
  ok(`zip 内包含新版 UX 文案：${foundNew.join("、")}`);

  const foundOld = [
    ...OLD_UX_MARKERS.filter(m => rendererText.includes(m)),
    ...OLD_TAB_MARKERS.filter(m => rendererText.includes(m)),
  ];
  report.oldUxMarkersFound = foundOld.length ? foundOld.join(", ") : "无";
  if (foundOld.length) {
    fail(`zip 内仍含旧版特征：${foundOld.join("、")}`);
  }
  ok("zip 内无旧版特征（v1.0.17 / 快捷操作 / 独立诊断·设置 Tab）");
}

function verifyBuildManifestNotRolledBack(expectedVersion) {
  if (!fs.existsSync(sourceManifestPath)) {
    report.buildManifestAligned = "跳过（无源 manifest）";
    report.risks.push("未找到 client/public/downloads/manifest.json，跳过 build 回退检查。");
    return;
  }
  const source = JSON.parse(fs.readFileSync(sourceManifestPath, "utf-8"));
  if (!fs.existsSync(buildManifestPath)) {
    report.buildManifestAligned = "跳过（无 dist manifest，请先 pnpm build）";
    report.risks.push("未找到 dist/public/downloads/manifest.json，跳过 build 回退检查。");
    return;
  }
  const built = JSON.parse(fs.readFileSync(buildManifestPath, "utf-8"));
  const keys = ["version", "macZipUrl", "macZipSha256", "macZipSizeBytes", "macZipExternal"];
  for (const key of keys) {
    if (JSON.stringify(source[key]) !== JSON.stringify(built[key])) {
      report.buildManifestAligned = false;
      fail(`build 后 manifest.${key} 回退：源=${JSON.stringify(source[key])} 构建=${JSON.stringify(built[key])}`);
    }
  }
  if (source.version !== expectedVersion) {
    fail(`源 manifest.version=${source.version} 与 local-agent ${expectedVersion} 不一致`);
  }
  report.buildManifestAligned = true;
  ok("build 后 manifest 关键字段未回退");
}

async function verifyDirectZipEntry(baseUrl, expectedZipUrl) {
  const directUrl = `${baseUrl}${DIRECT_ZIP_PATH}`;
  let res;
  try {
    res = await fetchWithTimeout(directUrl, { method: "GET", redirect: "manual" }, 120_000);
  } catch (e) {
    fail(`直连 zip 请求失败：${e instanceof Error ? e.message : String(e)}`);
  }

  const status = res.status;
  const location = res.headers.get("location")?.trim() ?? "";
  if (status >= 300 && status < 400 && location) {
    if (!location.includes(`geo-local-agent-v${report.expectedVersion}`) && location !== expectedZipUrl) {
      report.risks.push(`直连 302 Location 与 manifest.macZipUrl 文本不完全相同，但应为同版本 Release：${location}`);
    }
    ok(`直连 ${DIRECT_ZIP_PATH} 返回 ${status} -> ${location.slice(0, 96)}...`);
    report.directZipCheck = "通过（重定向到 Release）";
    return;
  }

  if (!res.ok) {
    fail(`直连 ${DIRECT_ZIP_PATH} HTTP ${status}，应 302 到 Release 或 200 返回真实 zip`);
  }

  const tmpDirect = path.join(root, "tmp/agent-online-download/direct-geo-local-agent-mac.zip");
  if (fs.existsSync(tmpDirect)) fs.unlinkSync(tmpDirect);
  if (!res.body) fail("直连 zip 响应无 body");
  const nodeStream = Readable.fromWeb(res.body);
  await pipeline(nodeStream, fs.createWriteStream(tmpDirect));
  const directSha = sha256File(tmpDirect);
  const contentType = res.headers.get("content-type") ?? "";
  assertNotPlaceholderPayload(tmpDirect, contentType);

  if (typeof report.macZipSha256 === "string" && directSha.toLowerCase() !== report.macZipSha256.toLowerCase()) {
    fail(`直连 zip sha256=${directSha} 与 manifest ${report.macZipSha256} 不一致（可能为旧静态包）`);
  }
  ok(`直连 ${DIRECT_ZIP_PATH} 返回真实 zip，sha256 与 manifest 一致`);
  report.directZipCheck = "通过（静态 zip 与 manifest 一致）";
  fs.unlinkSync(tmpDirect);
}

async function main() {
  ensureArtifactsDir();
  report.expectedVersion = readExpectedVersion();
  ok(`期望版本 local-agent/package.json = ${report.expectedVersion}`);

  verifyBuildManifestNotRolledBack(report.expectedVersion);

  const rawBase = process.env.GEO_WEB_BASE_URL || process.env.AGENT_DOWNLOAD_BASE_URL;
  if (!rawBase || !String(rawBase).trim()) {
    skip("未设置 GEO_WEB_BASE_URL / AGENT_DOWNLOAD_BASE_URL，跳过线上验收。");
  }

  const baseUrl = normalizeBaseUrl(rawBase);
  report.baseUrl = baseUrl;
  const manifestUrl = `${baseUrl}/downloads/manifest.json`;
  report.manifestUrl = manifestUrl;

  if (fs.existsSync(repoZipPath)) {
    report.repoZipSize = fs.statSync(repoZipPath).size;
  }

  let manifestRes;
  try {
    manifestRes = await fetchWithTimeout(manifestUrl, { method: "GET" });
  } catch (e) {
    fail(`manifest 请求失败：${e instanceof Error ? e.message : String(e)}`);
  }

  if (!manifestRes.ok) {
    fail(`manifest HTTP ${manifestRes.status}：${manifestUrl}`);
  }

  let manifest;
  try {
    manifest = await manifestRes.json();
  } catch {
    fail("manifest 响应不是合法 JSON");
  }

  report.macZipUrl = manifest.macZipUrl ?? null;
  report.macDmgUrl = manifest.macDmgUrl ?? null;
  report.macZipSha256 = manifest.macZipSha256 ?? null;
  report.macZipSizeBytes = manifest.macZipSizeBytes ?? null;

  if (manifest.version !== report.expectedVersion) {
    fail(`线上 manifest.version=${manifest.version}，期望 ${report.expectedVersion}`);
  }
  ok(`线上 manifest.version=${report.expectedVersion}`);

  if (!String(manifest.macZipUrl ?? "").includes(`geo-local-agent-v${report.expectedVersion}`)) {
    fail(`线上 manifest.macZipUrl 未指向 v${report.expectedVersion}：${manifest.macZipUrl}`);
  }
  ok(`线上 manifest.macZipUrl 指向 geo-local-agent-v${report.expectedVersion}`);

  if (!isValidMacZipUrl(manifest.macZipUrl)) {
    fail(`manifest.macZipUrl 格式无效：${manifest.macZipUrl}`);
  }
  if (manifest.macDmgUrl != null) {
    fail(`manifest.macDmgUrl 应为 null，实际：${manifest.macDmgUrl}`);
  }
  if (typeof manifest.macZipSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.macZipSha256)) {
    fail("manifest 缺少有效 macZipSha256");
  }

  const zipUrl = resolveZipUrl(manifest.macZipUrl, baseUrl);
  if (!zipUrl) {
    fail(`无法解析 zip URL：macZipUrl=${manifest.macZipUrl}`);
  }
  report.zipUrl = zipUrl;
  report.manifestCheck = "通过";
  ok(`manifest 通过，zipUrl=${zipUrl}`);

  await verifyDirectZipEntry(baseUrl, zipUrl);

  let headRes;
  let headHeaders = {};
  try {
    headRes = await fetchWithTimeout(zipUrl, { method: "HEAD" });
    headHeaders = headersToObject(headRes.headers);
    fs.writeFileSync(
      headersPath,
      JSON.stringify(
        {
          url: zipUrl,
          method: "HEAD",
          status: headRes.status,
          headers: headHeaders,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    report.headMethod = "GET（HEAD 失败）";
    report.risks.push(`HEAD 请求异常：${e instanceof Error ? e.message : String(e)}`);
  }

  let contentLength = headHeaders["content-length"]
    ? Number(headHeaders["content-length"])
    : null;
  let zipStatus = headRes?.status ?? null;
  report.zipHttpStatus = zipStatus;
  report.contentType = headHeaders["content-type"] ?? null;
  report.contentLength = contentLength;

  if (report.contentType?.includes("text/html")) {
    fail("zip HEAD Content-Type 为 text/html，静态资源未真实部署（SPA fallback）");
  }

  const headUsable =
    headRes?.ok && contentLength != null && !Number.isNaN(contentLength) && contentLength > 0;

  if (!headUsable) {
    report.headMethod = "GET（HEAD 不可用或未返回 Content-Length）";
    report.risks.push("HEAD 未返回有效 Content-Length，将全量 GET 后核对文件大小与类型。");
  }

  if (zipStatus !== 200) {
    fail(`zip HTTP status 应为 200，实际：${zipStatus}`);
  }
  ok(`zip HTTP ${zipStatus}`);

  if (contentLength == null || Number.isNaN(contentLength)) {
    report.risks.push("响应未提供 Content-Length，将在下载后校验实际文件大小。");
  } else if (contentLength <= MIN_ZIP_BYTES) {
    fail(`Content-Length 必须 > 50MB，实际：${contentLength} bytes（疑似 HTML 或非 zip）`);
  } else {
    ok(`Content-Length ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
  }

  if (typeof manifest.macZipSizeBytes === "number" && contentLength != null && !Number.isNaN(contentLength)) {
    if (contentLength !== manifest.macZipSizeBytes) {
      report.sizeMatch = false;
      fail(
        `Content-Length 与 manifest.macZipSizeBytes 不一致：HEAD ${contentLength} vs manifest ${manifest.macZipSizeBytes}`,
      );
    }
    report.sizeMatch = true;
    ok("Content-Length 与 manifest.macZipSizeBytes 一致");
  }

  if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath);
  await downloadToFile(zipUrl, tmpZipPath);
  report.onlineZipSize = fs.statSync(tmpZipPath).size;

  assertNotPlaceholderPayload(tmpZipPath, report.contentType);

  if (report.onlineZipSize <= MIN_ZIP_BYTES) {
    fail(`下载文件必须 > 50MB，实际：${report.onlineZipSize} bytes`);
  }
  ok(`下载文件 ${(report.onlineZipSize / 1024 / 1024).toFixed(2)} MB`);

  if (typeof manifest.macZipSizeBytes === "number") {
    if (report.onlineZipSize !== manifest.macZipSizeBytes) {
      report.sizeMatch = false;
      fail(
        `下载体积与 manifest.macZipSizeBytes 不一致：${report.onlineZipSize} vs ${manifest.macZipSizeBytes}`,
      );
    }
    report.sizeMatch = true;
    ok("下载体积与 manifest.macZipSizeBytes 一致");
  }

  report.onlineZipSha256 = sha256File(tmpZipPath);
  if (report.onlineZipSha256.toLowerCase() !== manifest.macZipSha256.toLowerCase()) {
    report.sha256Match = false;
    fail(
      `sha256 与 manifest 不一致：线上 ${report.onlineZipSha256} vs manifest ${manifest.macZipSha256}`,
    );
  }
  report.sha256Match = true;
  ok("sha256 与 manifest.macZipSha256 一致");

  assertZipContainsApp(tmpZipPath);
  inspectZipAppContents(tmpZipPath, report.expectedVersion);

  const unzip = spawnSync("unzip", ["-t", tmpZipPath], { encoding: "utf-8" });
  const unzipOut = (unzip.stdout || "") + (unzip.stderr || "");
  if (unzip.status !== 0 || !/No errors detected/i.test(unzipOut)) {
    report.unzipTest = "失败";
    fail(`unzip -t 未通过：${unzipOut.slice(0, 500)}`);
  }
  report.unzipTest = "通过";
  ok("unzip -t 通过");

  report.conclusion =
    "**通过**：线上 manifest / 直连入口 / Release zip 均指向最新版本，sha/体积/包内版本与 UX 符合预期。";
  writeReport();
  console.log(`\n=== ${PHASE} online PASSED ===\n`);
  console.log(`报告：${reportPath}`);
}

main().catch(e => {
  fail(e instanceof Error ? e.message : String(e));
});

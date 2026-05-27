#!/usr/bin/env node
/**
 * Local-Agent-Online-Zip-Placeholder-P0：线上 Mac zip 真实下载验收
 * 支持 manifest 相对路径或绝对 macZipUrl；校验 sha256 / size / unzip / .app
 *
 * 环境变量（任选其一）：
 * - GEO_WEB_BASE_URL（推荐）
 * - AGENT_DOWNLOAD_BASE_URL（兼容旧名）
 *
 * 未设置时 SKIP exit 0。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const PHASE = "Local-Agent-Online-Zip-Placeholder-P0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(root, "artifacts");
const reportPath = path.join(artifactsDir, "agent-mac-online-download-verify.md");
const headersPath = path.join(artifactsDir, "agent-mac-online-download-headers.json");
const repoZipPath = path.join(root, "client/public/downloads/geo-local-agent-mac.zip");
const tmpZipPath = path.join(root, "tmp/agent-online-download/geo-local-agent-mac.zip");
const MIN_ZIP_BYTES = 50 * 1024 * 1024;
const DEFAULT_RELATIVE_ZIP = "/downloads/geo-local-agent-mac.zip";
const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

/** @type {Record<string, unknown>} */
const report = {
  phase: PHASE,
  baseUrl: null,
  manifestUrl: null,
  manifestCheck: "未执行",
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
    `- **线上域名**：${report.baseUrl ?? "（未设置）"}`,
    `- **manifest URL**：${report.manifestUrl ?? "—"}`,
    `- **manifest 检查**：${report.manifestCheck}`,
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

async function main() {
  ensureArtifactsDir();

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

  if (!isValidMacZipUrl(manifest.macZipUrl)) {
    fail(`manifest.macZipUrl 格式无效：${manifest.macZipUrl}`);
  }
  if (manifest.macDmgUrl != null) {
    fail(`manifest.macDmgUrl 应为 null，实际：${manifest.macDmgUrl}`);
  }
  if (typeof manifest.macZipSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.macZipSha256)) {
    report.risks.push("manifest 缺少有效 macZipSha256，将仅校验体积与 unzip。");
  }

  const zipUrl = resolveZipUrl(manifest.macZipUrl, baseUrl);
  if (!zipUrl) {
    fail(`无法解析 zip URL：macZipUrl=${manifest.macZipUrl}`);
  }
  report.zipUrl = zipUrl;
  report.manifestCheck = "通过";
  ok(`manifest 通过，zipUrl=${zipUrl}`);

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
  } else if (report.repoZipSize != null && !/^https?:\/\//i.test(String(manifest.macZipUrl))) {
    if (report.onlineZipSize !== report.repoZipSize) {
      report.sizeMatch = false;
      fail(
        `文件大小不一致：仓库 ${report.repoZipSize} bytes，线上 ${report.onlineZipSize} bytes`,
      );
    }
    report.sizeMatch = true;
    ok("线上下载 zip 与仓库 zip 大小完全一致");
  }

  report.onlineZipSha256 = sha256File(tmpZipPath);
  if (typeof manifest.macZipSha256 === "string" && /^[a-f0-9]{64}$/i.test(manifest.macZipSha256)) {
    if (report.onlineZipSha256.toLowerCase() !== manifest.macZipSha256.toLowerCase()) {
      report.sha256Match = false;
      fail(
        `sha256 与 manifest 不一致：线上 ${report.onlineZipSha256} vs manifest ${manifest.macZipSha256}`,
      );
    }
    report.sha256Match = true;
    ok("sha256 与 manifest.macZipSha256 一致");
  } else {
    report.sha256Match = "跳过（manifest 无 macZipSha256）";
    report.risks.push("manifest 未提供 macZipSha256，未做哈希校验。");
  }

  assertZipContainsApp(tmpZipPath);

  const unzip = spawnSync("unzip", ["-t", tmpZipPath], { encoding: "utf-8" });
  const unzipOut = (unzip.stdout || "") + (unzip.stderr || "");
  if (unzip.status !== 0 || !/No errors detected/i.test(unzipOut)) {
    report.unzipTest = "失败";
    fail(`unzip -t 未通过：${unzipOut.slice(0, 500)}`);
  }
  report.unzipTest = "通过";
  ok("unzip -t 通过");

  report.conclusion =
    "**通过**：线上 Mac zip 真实可下载（非 HTML/LFS 占位，体积/sha256/完整性符合 manifest）。";
  writeReport();
  console.log(`\n=== ${PHASE} online PASSED ===\n`);
  console.log(`报告：${reportPath}`);
}

main().catch(e => {
  fail(e instanceof Error ? e.message : String(e));
});

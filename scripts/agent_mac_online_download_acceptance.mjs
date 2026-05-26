#!/usr/bin/env node
/**
 * Agent-Mac 线上 Mac zip 真实下载验收（支持 manifest 相对路径或绝对 macZipUrl）
 * 必须设置 AGENT_DOWNLOAD_BASE_URL，禁止 fallback localhost，禁止 mock 成功。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const PHASE = "Agent-Mac-Static-Asset-Delivery-Fix";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(root, "artifacts");
const reportPath = path.join(artifactsDir, "agent-mac-online-download-verify.md");
const headersPath = path.join(artifactsDir, "agent-mac-online-download-headers.json");
const repoZipPath = path.join(root, "client/public/downloads/geo-local-agent-mac.zip");
const tmpZipPath = path.join(root, "tmp/agent-online-download/geo-local-agent-mac.zip");
const MIN_ZIP_BYTES = 50 * 1024 * 1024;
const DEFAULT_RELATIVE_ZIP = "/downloads/geo-local-agent-mac.zip";

/** @type {Record<string, unknown>} */
const report = {
  phase: PHASE,
  baseUrl: null,
  manifestUrl: null,
  manifestCheck: "未执行",
  macZipUrl: null,
  macDmgUrl: null,
  zipUrl: null,
  zipHttpStatus: null,
  contentType: null,
  contentLength: null,
  headMethod: "HEAD",
  repoZipSize: null,
  onlineZipSize: null,
  sizeMatch: null,
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
    `- **zip URL**：${report.zipUrl ?? "—"}`,
    `- **zip HTTP status**：${report.zipHttpStatus ?? "—"}`,
    `- **Content-Type**：${report.contentType ?? "—"}`,
    `- **Content-Length**：${report.contentLength ?? "—"}`,
    `- **HEAD/GET 方式**：${report.headMethod}`,
    `- **仓库 zip 大小（bytes）**：${report.repoZipSize ?? "—"}`,
    `- **线上下载 zip 大小（bytes）**：${report.onlineZipSize ?? "—"}`,
    `- **文件大小完全一致**：${report.sizeMatch ?? "—"}`,
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

function normalizeBaseUrl(raw) {
  const trimmed = String(raw).trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (/localhost|127\.0\.0\.1/i.test(trimmed)) {
    fail("AGENT_DOWNLOAD_BASE_URL 禁止使用 localhost / 127.0.0.1");
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

function assertNotHtmlPayload(filePath, contentType) {
  const head = fs.readFileSync(filePath, { encoding: "utf-8", flag: "r" }).slice(0, 512).toLowerCase();
  if (contentType?.includes("text/html") || head.includes("<!doctype") || head.includes("<html")) {
    fail(
      "zip URL 返回 HTML，说明静态资源未真实部署或被 SPA fallback；请上传真实 zip 并设置 AGENT_MAC_ZIP_URL 或修复 /downloads 静态路由。",
    );
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

async function main() {
  ensureArtifactsDir();

  const rawBase = process.env.AGENT_DOWNLOAD_BASE_URL;
  if (!rawBase || !String(rawBase).trim()) {
    report.conclusion =
      "**未通过**：缺少 AGENT_DOWNLOAD_BASE_URL，无法进行线上真实下载验收。";
    report.errors.push("缺少 AGENT_DOWNLOAD_BASE_URL，无法进行线上真实下载验收。");
    report.risks.push("未配置线上域名时不得宣称 Manus zip 下载链路已通过。");
    console.error("缺少 AGENT_DOWNLOAD_BASE_URL，无法进行线上真实下载验收。");
    writeReport();
    process.exit(1);
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

  if (!isValidMacZipUrl(manifest.macZipUrl)) {
    fail(`manifest.macZipUrl 格式无效：${manifest.macZipUrl}`);
  }
  if (manifest.macDmgUrl != null) {
    fail(`manifest.macDmgUrl 应为 null，实际：${manifest.macDmgUrl}`);
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

  if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath);
  await downloadToFile(zipUrl, tmpZipPath);
  report.onlineZipSize = fs.statSync(tmpZipPath).size;

  assertNotHtmlPayload(tmpZipPath, report.contentType);

  if (report.onlineZipSize <= MIN_ZIP_BYTES) {
    fail(`下载文件必须 > 50MB，实际：${report.onlineZipSize} bytes`);
  }
  ok(`下载文件 ${(report.onlineZipSize / 1024 / 1024).toFixed(2)} MB`);

  if (report.repoZipSize != null) {
    if (report.onlineZipSize !== report.repoZipSize) {
      report.sizeMatch = false;
      fail(
        `文件大小不一致：仓库 ${report.repoZipSize} bytes，线上 ${report.onlineZipSize} bytes`,
      );
    }
    report.sizeMatch = true;
    ok("线上下载 zip 与仓库 zip 大小完全一致");
  } else {
    report.sizeMatch = "跳过（仓库无对照 zip）";
    report.risks.push("仓库无 geo-local-agent-mac.zip，未做字节级对照。");
  }

  const unzip = spawnSync("unzip", ["-t", tmpZipPath], { encoding: "utf-8" });
  const unzipOut = (unzip.stdout || "") + (unzip.stderr || "");
  if (unzip.status !== 0 || !/No errors detected/i.test(unzipOut)) {
    report.unzipTest = "失败";
    fail(`unzip -t 未通过：${unzipOut.slice(0, 500)}`);
  }
  report.unzipTest = "通过";
  ok("unzip -t 通过");

  report.conclusion =
    "**通过**：线上 Mac zip 真实可下载（非 HTML fallback，体积与完整性符合预期）。";
  writeReport();
  console.log(`\n=== ${PHASE} online PASSED ===\n`);
  console.log(`报告：${reportPath}`);
}

main().catch(e => {
  fail(e instanceof Error ? e.message : String(e));
});

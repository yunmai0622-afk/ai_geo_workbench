import fs from "fs";

export const MIN_MAC_ZIP_BYTES = 50 * 1024 * 1024;
export const MIN_WIN_ZIP_BYTES = 50 * 1024 * 1024;
export const MIN_WIN_EXE_BYTES = 30 * 1024 * 1024;

export function isExternalDownloadUrl(url) {
  return typeof url === "string" && /^https:\/\/.+/i.test(url.trim());
}

/** @deprecated use isExternalDownloadUrl */
export const isExternalMacZipUrl = isExternalDownloadUrl;

export function readFileHead(filePath, max = 512) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(max);
    const n = fs.readSync(fd, buf, 0, max, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

export function isHtmlPayload(filePath) {
  const head = readFileHead(filePath).toString("utf-8");
  return /<!doctype html/i.test(head) || /<html[\s>]/i.test(head);
}

export function isZipArchive(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const head = readFileHead(filePath, 4);
  return head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
}

export function isPeExecutable(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const head = readFileHead(filePath, 2);
  return head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a;
}

/** @returns {{ ok: boolean; reason?: string; size?: number }} */
export function inspectZipArtifact(filePath, minBytes) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: "文件不存在" };
  }
  const size = fs.statSync(filePath).size;
  if (size < minBytes) {
    return { ok: false, reason: `体积过小（${size} bytes，需 >= ${minBytes}）`, size };
  }
  if (isHtmlPayload(filePath)) {
    return { ok: false, reason: "内容为 HTML（疑似 SPA fallback / 404 页面）", size };
  }
  if (!isZipArchive(filePath)) {
    return { ok: false, reason: "不是 Zip archive（缺少 PK 魔数）", size };
  }
  return { ok: true, size };
}

export function inspectMacZipArtifact(filePath) {
  return inspectZipArtifact(filePath, MIN_MAC_ZIP_BYTES);
}

export function inspectWinZipArtifact(filePath) {
  return inspectZipArtifact(filePath, MIN_WIN_ZIP_BYTES);
}

export function inspectWinExeArtifact(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: "文件不存在" };
  }
  const size = fs.statSync(filePath).size;
  if (size < MIN_WIN_EXE_BYTES) {
    return { ok: false, reason: `体积过小（${size} bytes，需 >= ${MIN_WIN_EXE_BYTES}）`, size };
  }
  if (isHtmlPayload(filePath)) {
    return { ok: false, reason: "内容为 HTML（疑似 SPA fallback / 404 页面）", size };
  }
  if (!isPeExecutable(filePath)) {
    return { ok: false, reason: "不是 PE 可执行文件（缺少 MZ 魔数）", size };
  }
  return { ok: true, size };
}

export function assertValidMacZipArtifact(filePath, label = "geo-local-agent-mac.zip") {
  const result = inspectMacZipArtifact(filePath);
  if (!result.ok) throw new Error(`${label} 无效：${result.reason}`);
  return result.size;
}

export function assertValidWinZipArtifact(filePath, label = "geo-local-agent-win.zip") {
  const result = inspectWinZipArtifact(filePath);
  if (!result.ok) throw new Error(`${label} 无效：${result.reason}`);
  return result.size;
}

export function assertValidWinExeArtifact(filePath, label = "geo-local-agent-win.exe") {
  const result = inspectWinExeArtifact(filePath);
  if (!result.ok) throw new Error(`${label} 无效：${result.reason}`);
  return result.size;
}

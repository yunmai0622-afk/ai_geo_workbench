#!/usr/bin/env node
/**
 * 将 local-agent/release 打包产物复制到 client/public/downloads/
 * Mac zip 使用 ditto 从 .app 打包，保留 bundle 权限与资源分叉。
 * 支持 AGENT_MAC_ZIP_URL：线上大文件不入 Git 时，manifest 指向外部真实 zip URL。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "local-agent/release");
const localAgentPkgPath = path.join(root, "local-agent/package.json");
const outDir = path.join(root, "client/public/downloads");
const manifestPath = path.join(outDir, "manifest.json");

const DEFAULT_MAC_ZIP = "/downloads/geo-local-agent-mac.zip";
const DEFAULT_GEO_WEB_BASE_URL = "https://aigeoworkb-kzxhj9uy.manus.space";
const externalMacZip = process.env.AGENT_MAC_ZIP_URL?.trim() || null;

function resolveMacZipUrl(prev = {}) {
  if (externalMacZip) return externalMacZip;
  const prevUrl = typeof prev.macZipUrl === "string" ? prev.macZipUrl.trim() : "";
  if (/^https?:\/\//i.test(prevUrl)) return prevUrl;
  return DEFAULT_MAC_ZIP;
}

/** 外链 Release 模式：不得用本地 ditto zip 的 sha/size 覆盖 manifest */
function shouldPreserveExternalMacManifest(prev = {}) {
  if (externalMacZip) return true;
  const prevUrl = typeof prev.macZipUrl === "string" ? prev.macZipUrl.trim() : "";
  if (prev.macZipExternal === true && /^https?:\/\//i.test(prevUrl)) return true;
  if (/^https?:\/\//i.test(prevUrl) && prevUrl !== DEFAULT_MAC_ZIP) return true;
  return false;
}

function readAgentVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(localAgentPkgPath, "utf-8"));
    return typeof pkg.version === "string" ? pkg.version : "1.0.0";
  } catch {
    return "1.0.0";
  }
}

function readExistingManifest() {
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return {};
  }
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function findMacAppBundle(baseDir) {
  const candidates = [
    path.join(baseDir, "mac-arm64"),
    path.join(baseDir, "mac"),
    baseDir,
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const apps = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.endsWith(".app"))
      .map(e => path.join(dir, e.name));
    if (apps.length) return apps[0];
  }
  return null;
}

/** 打包前：清隔离、可执行权限、ad-hoc 签名 */
function prepareMacAppForZip(appPath) {
  spawnSync("xattr", ["-cr", appPath], { stdio: "inherit" });
  const macOsDir = path.join(appPath, "Contents/MacOS");
  if (fs.existsSync(macOsDir)) {
    for (const name of fs.readdirSync(macOsDir)) {
      const p = path.join(macOsDir, name);
      if (fs.statSync(p).isFile()) fs.chmodSync(p, 0o755);
    }
  }
  const frameworksDir = path.join(appPath, "Contents/Frameworks");
  if (fs.existsSync(frameworksDir)) {
    for (const entry of fs.readdirSync(frameworksDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
      const helperMacOs = path.join(frameworksDir, entry.name, "Contents/MacOS");
      if (!fs.existsSync(helperMacOs)) continue;
      for (const name of fs.readdirSync(helperMacOs)) {
        const p = path.join(helperMacOs, name);
        if (fs.statSync(p).isFile()) fs.chmodSync(p, 0o755);
      }
    }
  }
  const sign = spawnSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    encoding: "utf-8",
  });
  if (sign.status !== 0) {
    console.warn("[copy] codesign ad-hoc skipped:", sign.stderr || sign.stdout);
  }
}

/** 使用 ditto 生成 zip：解压后第一层即为 .app */
function packageMacAppZip(appPath, destZip) {
  prepareMacAppForZip(appPath);
  if (fs.existsSync(destZip)) fs.unlinkSync(destZip);
  const ditto = spawnSync(
    "ditto",
    ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, destZip],
    { encoding: "utf-8" },
  );
  if (ditto.status !== 0) {
    throw new Error(`ditto zip failed: ${ditto.stderr || ditto.stdout}`);
  }
}

function writeManifest(copied, extras = {}) {
  const prev = readExistingManifest();
  const preserveExternalMac = shouldPreserveExternalMacManifest(prev);
  const safeExtras = { ...extras };
  if (preserveExternalMac) {
    delete safeExtras.macZipSha256;
    delete safeExtras.macZipSizeBytes;
    delete safeExtras.macZipUrl;
    delete safeExtras.macZipExternal;
  }
  const macZipUrl = safeExtras.macZipUrl ?? resolveMacZipUrl(prev);
  const manifest = {
    version: readAgentVersion(),
    copiedAt: new Date().toISOString(),
    geoWebBaseUrl: prev.geoWebBaseUrl ?? DEFAULT_GEO_WEB_BASE_URL,
    macZipUrl,
    macDmgUrl: null,
    winZipUrl: prev.winZipUrl ?? null,
    winSetupUrl: prev.winSetupUrl ?? null,
    macZipSha256: preserveExternalMac
      ? (prev.macZipSha256 ?? safeExtras.macZipSha256 ?? null)
      : (safeExtras.macZipSha256 ?? prev.macZipSha256 ?? null),
    macZipSizeBytes: preserveExternalMac
      ? (prev.macZipSizeBytes ?? safeExtras.macZipSizeBytes ?? null)
      : (safeExtras.macZipSizeBytes ?? prev.macZipSizeBytes ?? null),
    ...safeExtras,
  };
  const finalMacZipUrl = manifest.macZipUrl;
  if (
    Boolean(externalMacZip) ||
    (/^https?:\/\//i.test(finalMacZipUrl) && finalMacZipUrl !== DEFAULT_MAC_ZIP)
  ) {
    manifest.macZipExternal = true;
  }
  if (copied.length) {
    manifest.files = copied.map(p => path.relative(root, p));
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

if (!fs.existsSync(releaseDir)) {
  const prev = readExistingManifest();
  const macZipUrl = resolveMacZipUrl(prev);
  writeManifest([]);
  console.log(
    externalMacZip || /^https?:\/\//i.test(macZipUrl)
      ? `[copy] 无 local-agent/release，已保留/写入外部 macZipUrl：${macZipUrl}`
      : "[copy] 无 local-agent/release，已保留/写入默认 manifest（相对 macZipUrl）",
  );
  process.exit(0);
}

const files = fs.readdirSync(releaseDir);
const dmg = files.find(f => f.endsWith(".dmg") && !f.endsWith(".blockmap"));
const zipWin = files.find(f => f.endsWith("-win.zip") && !f.endsWith(".blockmap"));
const exeCandidates = files.filter(
  f => f.endsWith(".exe") && !f.endsWith(".blockmap") && !f.toLowerCase().includes("uninstall"),
);
const exe =
  exeCandidates.find(f => /setup/i.test(f)) ??
  exeCandidates.find(f => !f.includes("portable")) ??
  exeCandidates[0];

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const copied = [];
const manifestExtras = {};

if (dmg) {
  const dest = path.join(outDir, "geo-local-agent-mac.dmg");
  fs.copyFileSync(path.join(releaseDir, dmg), dest);
  copied.push(dest);
}

const macApp = findMacAppBundle(releaseDir);
const prevBeforeCopy = readExistingManifest();
const preserveExternalMac = shouldPreserveExternalMacManifest(prevBeforeCopy);

if (macApp && !externalMacZip) {
  const dest = path.join(outDir, "geo-local-agent-mac.zip");
  packageMacAppZip(macApp, dest);
  copied.push(dest);
  const localSha = sha256File(dest);
  const localSize = fs.statSync(dest).size;
  if (!preserveExternalMac) {
    manifestExtras.macZipSha256 = localSha;
    manifestExtras.macZipSizeBytes = localSize;
    manifestExtras.macZipUrl = DEFAULT_MAC_ZIP;
    console.log(`[copy] ditto zip from ${path.relative(root, macApp)} sha256=${localSha}`);
  } else {
    console.log(
      `[copy] ditto zip -> ${path.relative(root, dest)}（保留外链 manifest macZipUrl/sha256/size；本地 sha256=${localSha}）`,
    );
  }
} else if (!externalMacZip) {
  const zipMac = files.find(f => f.endsWith("-mac.zip") && !f.endsWith(".blockmap"));
  if (zipMac) {
    const dest = path.join(outDir, "geo-local-agent-mac.zip");
    fs.copyFileSync(path.join(releaseDir, zipMac), dest);
    copied.push(dest);
    if (!preserveExternalMac) {
      manifestExtras.macZipUrl = DEFAULT_MAC_ZIP;
      manifestExtras.macZipSha256 = sha256File(dest);
      manifestExtras.macZipSizeBytes = fs.statSync(dest).size;
    }
    console.warn("[copy] 未找到 .app，回退复制 electron-builder zip");
  }
}

if (zipWin) {
  const dest = path.join(outDir, "geo-local-agent-win.zip");
  fs.copyFileSync(path.join(releaseDir, zipWin), dest);
  copied.push(dest);
}

if (exe) {
  const dest = path.join(outDir, "geo-local-agent-win.exe");
  fs.copyFileSync(path.join(releaseDir, exe), dest);
  copied.push(dest);
}

writeManifest(copied, manifestExtras);

if (!dmg && !macApp && !externalMacZip && !manifestExtras.macZipSha256) {
  console.error("未找到 Mac .app / .dmg，且未设置 AGENT_MAC_ZIP_URL");
  process.exit(1);
}

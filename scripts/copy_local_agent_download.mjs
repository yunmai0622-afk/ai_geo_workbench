#!/usr/bin/env node
/**
 * 将 local-agent/release 打包产物复制到 client/public/downloads/
 * Mac zip 使用 ditto 从 .app 打包；Windows 复制 electron-builder zip/nsis。
 * 支持 AGENT_*_URL：大文件可走外部 HTTPS，manifest 写入 sha256/size。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import {
  assertValidMacZipArtifact,
  assertValidWinExeArtifact,
  assertValidWinZipArtifact,
  inspectMacZipArtifact,
  inspectWinExeArtifact,
  inspectWinZipArtifact,
  isExternalDownloadUrl,
} from "./lib/localAgentDownloadArtifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "local-agent/release");
const localAgentPkgPath = path.join(root, "local-agent/package.json");
const outDir = path.join(root, "client/public/downloads");
const manifestPath = path.join(outDir, "manifest.json");
const macZipDest = path.join(outDir, "geo-local-agent-mac.zip");
const winZipDest = path.join(outDir, "geo-local-agent-win.zip");
const winExeDest = path.join(outDir, "geo-local-agent-win.exe");

const DEFAULT_MAC_ZIP = "/downloads/geo-local-agent-mac.zip";
const DEFAULT_WIN_ZIP = "/downloads/geo-local-agent-win.zip";
const DEFAULT_WIN_SETUP = "/downloads/geo-local-agent-win.exe";

const externalMacZip = process.env.AGENT_MAC_ZIP_URL?.trim() || null;
const externalWinZip = process.env.AGENT_WIN_ZIP_URL?.trim() || null;
const externalWinSetup = process.env.AGENT_WIN_SETUP_URL?.trim() || null;

const macZipUrl = externalMacZip || DEFAULT_MAC_ZIP;
const winZipUrl = externalWinZip || DEFAULT_WIN_ZIP;
const winSetupUrl = externalWinSetup || DEFAULT_WIN_SETUP;

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

function macZipManifestExtras(zipPath) {
  const size = assertValidMacZipArtifact(zipPath);
  return { macZipSha256: sha256File(zipPath), macZipSizeBytes: size };
}

function winZipManifestExtras(zipPath) {
  const size = assertValidWinZipArtifact(zipPath);
  return { winZipSha256: sha256File(zipPath), winZipSizeBytes: size };
}

function winExeManifestExtras(exePath) {
  const size = assertValidWinExeArtifact(exePath);
  return { winSetupSha256: sha256File(exePath), winSetupSizeBytes: size };
}

function writeManifest(copied, extras = {}) {
  const prev = readExistingManifest();
  const manifest = {
    version: readAgentVersion(),
    copiedAt: new Date().toISOString(),
    files: copied.length ? copied.map(p => path.relative(root, p)) : prev.files ?? [],
    macZipUrl,
    macDmgUrl: null,
    winZipUrl,
    winSetupUrl,
    ...extras,
  };
  if (externalMacZip) manifest.macZipExternal = true;
  if (externalWinZip) manifest.winZipExternal = true;
  if (externalWinSetup) manifest.winSetupExternal = true;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

function failArtifacts(message) {
  console.error(`[copy] ${message}`);
  console.error(
    "[copy] 修复：cd local-agent && npm run package:mac / package:win；或设置 AGENT_MAC_ZIP_URL / AGENT_WIN_ZIP_URL / AGENT_WIN_SETUP_URL",
  );
  process.exit(1);
}

function finalizeArtifacts(copied, manifestExtras) {
  const extras = { ...manifestExtras };

  if (!isExternalDownloadUrl(macZipUrl)) {
    const mac = inspectMacZipArtifact(macZipDest);
    if (!mac.ok) {
      failArtifacts(`Mac ${macZipUrl} 需要有效 zip：${mac.reason}`);
    }
    Object.assign(extras, macZipManifestExtras(macZipDest));
  }

  if (!isExternalDownloadUrl(winZipUrl)) {
    const winZ = inspectWinZipArtifact(winZipDest);
    if (!winZ.ok) {
      failArtifacts(`Windows ${winZipUrl} 需要有效 zip：${winZ.reason}`);
    }
    Object.assign(extras, winZipManifestExtras(winZipDest));
  }

  if (!isExternalDownloadUrl(winSetupUrl)) {
    const winE = inspectWinExeArtifact(winExeDest);
    if (!winE.ok) {
      failArtifacts(`Windows ${winSetupUrl} 需要有效 exe：${winE.reason}`);
    }
    Object.assign(extras, winExeManifestExtras(winExeDest));
  }

  writeManifest(copied, extras);
}

if (!fs.existsSync(releaseDir)) {
  if (isExternalDownloadUrl(macZipUrl) || isExternalDownloadUrl(winZipUrl) || isExternalDownloadUrl(winSetupUrl)) {
    writeManifest([], {});
    console.log("[copy] 无 local-agent/release，已按 AGENT_*_URL 更新 manifest");
    process.exit(0);
  }
  finalizeArtifacts([], {});
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
if (macApp && !externalMacZip) {
  packageMacAppZip(macApp, macZipDest);
  copied.push(macZipDest);
  console.log(`[copy] ditto mac zip from ${path.relative(root, macApp)}`);
} else if (!externalMacZip) {
  const zipMac = files.find(f => f.endsWith("-mac.zip") && !f.endsWith(".blockmap"));
  if (zipMac) {
    fs.copyFileSync(path.join(releaseDir, zipMac), macZipDest);
    copied.push(macZipDest);
    console.warn("[copy] 未找到 .app，回退复制 electron-builder mac zip");
  }
}

if (zipWin && !externalWinZip) {
  fs.copyFileSync(path.join(releaseDir, zipWin), winZipDest);
  copied.push(winZipDest);
  console.log(`[copy] win zip from ${zipWin}`);
}

if (exe && !externalWinSetup) {
  fs.copyFileSync(path.join(releaseDir, exe), winExeDest);
  copied.push(winExeDest);
  console.log(`[copy] win setup from ${exe}`);
}

finalizeArtifacts(copied, manifestExtras);

if (
  !dmg &&
  !macApp &&
  !zipWin &&
  !exe &&
  !isExternalDownloadUrl(macZipUrl) &&
  !isExternalDownloadUrl(winZipUrl) &&
  !isExternalDownloadUrl(winSetupUrl)
) {
  failArtifacts("未找到任何 release 产物，且未设置 AGENT_*_URL");
}

#!/usr/bin/env node
/**
 * 将 local-agent/release 打包产物复制到 client/public/downloads/
 * 支持 AGENT_MAC_ZIP_URL：线上大文件不入 Git 时，manifest 指向外部真实 zip URL。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "local-agent/release");
const outDir = path.join(root, "client/public/downloads");
const manifestPath = path.join(outDir, "manifest.json");

const DEFAULT_MAC_ZIP = "/downloads/geo-local-agent-mac.zip";
const externalMacZip = process.env.AGENT_MAC_ZIP_URL?.trim() || null;
const macZipUrl = externalMacZip || DEFAULT_MAC_ZIP;

function readExistingManifest() {
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeManifest(copied, sourceDir) {
  const prev = readExistingManifest();
  const manifest = {
    version: prev.version ?? "1.0.0",
    copiedAt: new Date().toISOString(),
    sourceDir: sourceDir ?? prev.sourceDir ?? null,
    files: copied.length ? copied.map(p => path.relative(root, p)) : prev.files ?? [],
    macZipUrl,
    macDmgUrl: null,
    winZipUrl: prev.winZipUrl ?? null,
    winSetupUrl: prev.winSetupUrl ?? null,
  };
  if (externalMacZip) {
    manifest.macZipExternal = true;
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

if (!fs.existsSync(releaseDir)) {
  writeManifest([], null);
  console.log(
    externalMacZip
      ? "[copy] 无 local-agent/release，已按 AGENT_MAC_ZIP_URL 更新 manifest"
      : "[copy] 无 local-agent/release，已保留/写入默认 manifest（相对 macZipUrl）",
  );
  process.exit(0);
}

const files = fs.readdirSync(releaseDir);
const dmg = files.find(f => f.endsWith(".dmg") && !f.endsWith(".blockmap"));
const zipMac = files.find(f => f.endsWith("-mac.zip") && !f.endsWith(".blockmap"));
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

if (dmg) {
  const dest = path.join(outDir, "geo-local-agent-mac.dmg");
  fs.copyFileSync(path.join(releaseDir, dmg), dest);
  copied.push(dest);
}

if (zipMac) {
  const dest = path.join(outDir, "geo-local-agent-mac.zip");
  fs.copyFileSync(path.join(releaseDir, zipMac), dest);
  copied.push(dest);
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

writeManifest(copied, releaseDir);

if (!dmg && !zipMac && !externalMacZip) {
  console.error("未找到 Mac .dmg 或 .zip，且未设置 AGENT_MAC_ZIP_URL");
  process.exit(1);
}

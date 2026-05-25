#!/usr/bin/env node
/**
 * 将 local-agent/release 打包产物复制到 client/public/downloads/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "local-agent/release");
const outDir = path.join(root, "client/public/downloads");

if (!fs.existsSync(releaseDir)) {
  console.error("缺少 local-agent/release，请先 cd local-agent && npm run package:mac");
  process.exit(1);
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

const manifest = {
  version: "1.0.0",
  copiedAt: new Date().toISOString(),
  sourceDir: releaseDir,
  files: copied.map(p => path.relative(root, p)),
  macZipUrl: zipMac ? "/downloads/geo-local-agent-mac.zip" : null,
  /** 线上 dmg 曾出现传输损坏；manifest 暂不暴露，仅保留 zip 下载入口 */
  macDmgUrl: null,
  winZipUrl: zipWin ? "/downloads/geo-local-agent-win.zip" : null,
  winSetupUrl: exe ? "/downloads/geo-local-agent-win.exe" : null,
};

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));

if (!dmg && !zipMac) {
  console.error("未找到 Mac .dmg 或 .zip");
  process.exit(1);
}

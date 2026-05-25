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
const exe = files.find(f => f.endsWith(".exe") && f.includes("Setup") && !f.endsWith(".blockmap"));

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

/** Windows 安装包仅在 CI/Windows 环境打包后复制；默认不发布假链接 */
const includeWin = process.env.GEO_AGENT_INCLUDE_WIN === "1";
if (includeWin && zipWin) {
  const dest = path.join(outDir, "geo-local-agent-win.zip");
  fs.copyFileSync(path.join(releaseDir, zipWin), dest);
  copied.push(dest);
}

if (includeWin && exe) {
  const dest = path.join(outDir, "geo-local-agent-win-setup.exe");
  fs.copyFileSync(path.join(releaseDir, exe), dest);
  copied.push(dest);
}

const manifest = {
  copiedAt: new Date().toISOString(),
  sourceDir: releaseDir,
  files: copied.map(p => path.relative(root, p)),
  macDmgUrl: dmg ? "/downloads/geo-local-agent-mac.dmg" : null,
  macZipUrl: zipMac ? "/downloads/geo-local-agent-mac.zip" : null,
  winZipUrl: includeWin && zipWin ? "/downloads/geo-local-agent-win.zip" : null,
  winSetupUrl: includeWin && exe ? "/downloads/geo-local-agent-win-setup.exe" : null,
};

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));

if (!dmg && !zipMac) {
  console.error("未找到 Mac .dmg 或 .zip");
  process.exit(1);
}

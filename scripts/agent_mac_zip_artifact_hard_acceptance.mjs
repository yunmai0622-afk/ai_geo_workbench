#!/usr/bin/env node
/**
 * Local-Agent-Download-Artifact-Hard-Acceptance：Mac + Windows 本地/构建产物硬验收
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
  MIN_MAC_ZIP_BYTES,
  MIN_WIN_EXE_BYTES,
  MIN_WIN_ZIP_BYTES,
} from "./lib/localAgentDownloadArtifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downloadsDir = path.join(root, "client/public/downloads");
const distDir = path.join(root, "dist/public/downloads");
const manifestPath = path.join(downloadsDir, "manifest.json");

const ARTIFACTS = {
  macZip: {
    public: path.join(downloadsDir, "geo-local-agent-mac.zip"),
    dist: path.join(distDir, "geo-local-agent-mac.zip"),
    urlKey: "macZipUrl",
    shaKey: "macZipSha256",
    sizeKey: "macZipSizeBytes",
    defaultUrl: "/downloads/geo-local-agent-mac.zip",
    assert: assertValidMacZipArtifact,
    inspect: inspectMacZipArtifact,
    hasContent: zipPath => {
      const list = spawnSync("unzip", ["-l", zipPath], { encoding: "utf-8" });
      return list.status === 0 && /\.app\//i.test(list.stdout) && /Contents\/MacOS\//i.test(list.stdout);
    },
    contentLabel: ".app / MacOS",
  },
  winZip: {
    public: path.join(downloadsDir, "geo-local-agent-win.zip"),
    dist: path.join(distDir, "geo-local-agent-win.zip"),
    urlKey: "winZipUrl",
    shaKey: "winZipSha256",
    sizeKey: "winZipSizeBytes",
    defaultUrl: "/downloads/geo-local-agent-win.zip",
    assert: assertValidWinZipArtifact,
    inspect: inspectWinZipArtifact,
    hasContent: zipPath => {
      const list = spawnSync("unzip", ["-l", zipPath], { encoding: "utf-8" });
      return list.status === 0 && /\.exe$/im.test(list.stdout);
    },
    contentLabel: "portable .exe",
  },
  winExe: {
    public: path.join(downloadsDir, "geo-local-agent-win.exe"),
    dist: path.join(distDir, "geo-local-agent-win.exe"),
    urlKey: "winSetupUrl",
    shaKey: "winSetupSha256",
    sizeKey: "winSetupSizeBytes",
    defaultUrl: "/downloads/geo-local-agent-win.exe",
    assert: assertValidWinExeArtifact,
    inspect: inspectWinExeArtifact,
    hasContent: () => true,
    contentLabel: "PE installer",
  },
};

let failed = 0;
function ok(msg) {
  console.log("[OK]", msg);
}
function fail(msg) {
  failed++;
  console.error("[FAIL]", msg);
}

function verifyManifestFile(manifest, spec, filePath, label) {
  const url = manifest[spec.urlKey];
  if (isExternalDownloadUrl(url)) {
    ok(`${label} 使用外部 HTTPS，跳过本地文件硬校验`);
    return;
  }
  if (url !== spec.defaultUrl) {
    fail(`${label} url 非预期：${url}`);
    return;
  }
  try {
    const size = spec.assert(filePath);
    ok(`${label} public 有效（${(size / 1024 / 1024).toFixed(1)} MB）`);
    if (manifest[spec.shaKey]) {
      const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
      if (hash === manifest[spec.shaKey]) ok(`${label} sha256 一致`);
      else fail(`${label} sha256 不一致`);
    }
    if (manifest[spec.sizeKey] && manifest[spec.sizeKey] !== size) {
      fail(`${label} sizeBytes 不一致`);
    } else if (manifest[spec.sizeKey]) {
      ok(`${label} sizeBytes 一致`);
    }
    if (spec.urlKey.includes("Zip")) {
      const unzip = spawnSync("unzip", ["-t", filePath], { encoding: "utf-8" });
      if (unzip.status === 0 && /No errors detected/i.test(unzip.stdout + unzip.stderr)) {
        ok(`${label} unzip -t 通过`);
      } else {
        fail(`${label} unzip -t 失败`);
      }
    }
    if (spec.hasContent(filePath)) ok(`${label} 内含 ${spec.contentLabel}`);
    else fail(`${label} 内容结构不完整`);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

if (!fs.existsSync(manifestPath)) {
  fail("manifest.json 不存在");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (manifest.sourceDir) fail("manifest 含 sourceDir");
  else ok("manifest 无 sourceDir");
  if (JSON.stringify(manifest).includes("/Users/")) fail("manifest 含本地绝对路径");
  else ok("manifest 无本地绝对路径");

  verifyManifestFile(manifest, ARTIFACTS.macZip, ARTIFACTS.macZip.public, "Mac zip");
  verifyManifestFile(manifest, ARTIFACTS.winZip, ARTIFACTS.winZip.public, "Win zip");
  verifyManifestFile(manifest, ARTIFACTS.winExe, ARTIFACTS.winExe.public, "Win setup exe");
}

for (const [name, spec] of Object.entries(ARTIFACTS)) {
  if (!fs.existsSync(spec.dist)) {
    console.log(`[INFO] dist 无 ${path.basename(spec.dist)}`);
    continue;
  }
  const dist = spec.inspect(spec.dist);
  if (dist.ok) ok(`dist ${name} 有效（${((dist.size ?? 0) / 1024 / 1024).toFixed(1)} MB）`);
  else fail(`dist ${name} 无效：${dist.reason}`);
}

console.log(
  `\n--- hard acceptance: ${failed} failed (mac zip>=${MIN_MAC_ZIP_BYTES}, win zip>=${MIN_WIN_ZIP_BYTES}, win exe>=${MIN_WIN_EXE_BYTES}) ---\n`,
);
if (failed > 0) process.exit(1);
console.log("=== agent_mac_zip_artifact_hard_acceptance PASSED ===\n");

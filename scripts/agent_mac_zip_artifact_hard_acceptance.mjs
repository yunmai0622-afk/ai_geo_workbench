#!/usr/bin/env node
/**
 * Local-Agent-Zip-Artifact-Hard-Acceptance-P0：本地 + 构建输出 zip 硬验收
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import {
  assertValidMacZipArtifact,
  inspectMacZipArtifact,
  isExternalMacZipUrl,
  MIN_MAC_ZIP_BYTES,
} from "./lib/macAgentZipArtifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicZip = path.join(root, "client/public/downloads/geo-local-agent-mac.zip");
const distZip = path.join(root, "dist/public/downloads/geo-local-agent-mac.zip");
const manifestPath = path.join(root, "client/public/downloads/manifest.json");

let failed = 0;
function ok(msg) {
  console.log("[OK]", msg);
}
function fail(msg) {
  failed++;
  console.error("[FAIL]", msg);
}

function hasAppInZip(zipPath) {
  const list = spawnSync("unzip", ["-l", zipPath], { encoding: "utf-8" });
  if (list.status !== 0) return false;
  return /\.app\//i.test(list.stdout) && /Contents\/MacOS\//i.test(list.stdout);
}

if (!fs.existsSync(manifestPath)) {
  fail("manifest.json 不存在");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (manifest.sourceDir) fail("manifest 含 sourceDir");
  else ok("manifest 无 sourceDir");
  if (JSON.stringify(manifest).includes("/Users/")) fail("manifest 含本地绝对路径");
  else ok("manifest 无本地绝对路径");
  if (!manifest.macZipUrl) fail("manifest 缺少 macZipUrl");
  else ok(`manifest.macZipUrl=${manifest.macZipUrl}`);

  if (isExternalMacZipUrl(manifest.macZipUrl)) {
    ok("macZipUrl 为外部 HTTPS，跳过本地 zip 体积硬校验");
  } else if (manifest.macZipUrl === "/downloads/geo-local-agent-mac.zip") {
    try {
      const size = assertValidMacZipArtifact(publicZip);
      ok(`public zip 有效（${(size / 1024 / 1024).toFixed(1)} MB）`);
      if (manifest.macZipSha256) {
        const hash = crypto.createHash("sha256").update(fs.readFileSync(publicZip)).digest("hex");
        if (hash === manifest.macZipSha256) ok("macZipSha256 与 public zip 一致");
        else fail(`macZipSha256 不一致：manifest=${manifest.macZipSha256} file=${hash}`);
      }
      if (manifest.macZipSizeBytes && manifest.macZipSizeBytes !== size) {
        fail(`macZipSizeBytes 不一致：manifest=${manifest.macZipSizeBytes} file=${size}`);
      } else if (manifest.macZipSizeBytes) {
        ok("macZipSizeBytes 与 public zip 一致");
      }
      const unzip = spawnSync("unzip", ["-t", publicZip], { encoding: "utf-8" });
      if (unzip.status === 0 && /No errors detected/i.test(unzip.stdout + unzip.stderr)) {
        ok("unzip -t public zip 通过");
      } else {
        fail(`unzip -t 失败：${unzip.stderr || unzip.stdout}`);
      }
      if (hasAppInZip(publicZip)) ok("zip 内含 .app / MacOS");
      else fail("zip 内未找到完整 .app");
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  } else {
    fail(`macZipUrl 非预期相对路径或 HTTPS：${manifest.macZipUrl}`);
  }
}

if (fs.existsSync(distZip)) {
  const dist = inspectMacZipArtifact(distZip);
  if (dist.ok) ok(`dist zip 有效（${((dist.size ?? 0) / 1024 / 1024).toFixed(1)} MB）`);
  else fail(`dist zip 无效：${dist.reason}`);
} else {
  console.log("[INFO] dist/public/downloads/geo-local-agent-mac.zip 不存在（尚未 build 或 zip 未复制进 dist）");
}

console.log(`\n--- hard acceptance: ${failed} failed (min zip ${MIN_MAC_ZIP_BYTES} bytes) ---\n`);
if (failed > 0) process.exit(1);
console.log("=== agent_mac_zip_artifact_hard_acceptance PASSED ===\n");

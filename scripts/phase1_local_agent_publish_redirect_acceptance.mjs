#!/usr/bin/env node
/**
 * Phase 1 闸门：Local Agent 客户端 → GEO Web 发布相关跳转路径验收（静态）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const reportPath = path.join(artifacts, "phase1-publish-redirect-report.json");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

function must(cond, msg) {
  if (!cond) {
    console.error("[FAIL]", msg);
    process.exit(1);
  }
}

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  must(ok, `${name}: ${detail}`);
  console.log("[OK]", name);
}

const publishPath = "/content-publishing";
const platformPath = "/enterprise-profile#platform-accounts";

check(
  "shared/geoWebPaths.ts exists",
  fs.existsSync(path.join(root, "shared/geoWebPaths.ts")),
  "missing shared/geoWebPaths.ts",
);

const main = read("local-agent/src/main.ts");
const appJs = read("local-agent/src/renderer/app.js");
const nav = read("local-agent/src/agent/geoWebNavigation.ts");

check("main uses openExternal", main.includes("shell.openExternal") && main.includes("agent:openGeoWeb"), "IPC missing");
check("renderer calls openGeoWeb", appJs.includes("openGeoWeb") && appJs.includes("publishRecords"), "UI missing");
check("nav path publish records", nav.includes(publishPath), publishPath);
check("nav path platform accounts", nav.includes(platformPath), platformPath);
check("no asset-center in agent UI", !appJs.includes("/asset-center"), "stale path in app.js");

const weekly = read("client/src/pages/WeeklyContentPage.tsx");
const appTsx = read("client/src/App.tsx");
check("weekly bind uses enterprise-profile", weekly.includes(platformPath), platformPath);
check("app redirects asset-center", appTsx.includes("/asset-center"), "redirect route");

const asset = read("client/src/pages/AssetCenter.tsx");
check("asset center platform-accounts anchor", asset.includes('id="platform-accounts"'), "missing section id");

fs.mkdirSync(artifacts, { recursive: true });
const report = {
  phase: 1,
  name: "Local Agent publish redirect",
  passed: true,
  checkedAt: new Date().toISOString(),
  paths: { publishPath, platformPath },
  checks,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log("\nWrote", reportPath);

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("\n--- pnpm check ---");
run("pnpm", ["check"]);
console.log("\n--- pnpm test (vitest) ---");
run("pnpm", ["test"]);
console.log("\n--- pnpm build ---");
run("pnpm", ["build"]);
console.log("\n--- local-agent typecheck/build/test ---");
run("npm", ["run", "typecheck"], path.join(root, "local-agent"));
run("npm", ["run", "build"], path.join(root, "local-agent"));
run("npm", ["run", "test"], path.join(root, "local-agent"));

console.log("\n=== Phase 1 publish redirect acceptance PASSED ===\n");

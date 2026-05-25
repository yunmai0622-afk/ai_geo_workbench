#!/usr/bin/env node
/**
 * Agent-Migration-3：Chrome 插件 legacy 降级与主 UI 清理验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

function must(cond, msg) {
  if (!cond) {
    console.error("[FAIL]", msg);
    process.exit(1);
  }
  console.log("[OK]", msg);
}

const mainUi = [
  "client/src/pages/WeeklyContentPage.tsx",
  "client/src/components/PlatformAccountBindingSection.tsx",
  "client/src/components/LocalAgentDownloadCard.tsx",
  "client/src/pages/V12FlowPages.tsx",
].map(read).join("\n");

must(!/Chrome\s*插件|浏览器插件|重载插件|下载插件|安装插件|插件版本/.test(mainUi), "main UI no extension primary copy");
must(!mainUi.includes("browser-extension.zip"), "no browser-extension.zip in main UI");
must(!mainUi.includes("downloadExtension"), "no downloadExtension in client");
must(mainUi.includes("本地发布客户端"), "local agent copy present");
must(mainUi.includes("检测客户端"), "detect client button");
must(fs.existsSync(path.join(root, "content-growth-publish-extension/README_LEGACY.md")), "README_LEGACY");
must(fs.existsSync(path.join(root, "content-growth-publish-extension/manifest.json")), "extension source kept");
must(read("client/src/components/LocalAgentDownloadCard.tsx").includes("geo-local-agent-mac"), "mac agent download");
must(
  read("client/src/components/LocalAgentDownloadCard.tsx").includes("Windows") &&
    read("client/src/components/LocalAgentDownloadCard.tsx").includes("即将支持"),
  "win fallback or download",
);

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("\n--- pnpm check ---");
run("pnpm", ["check"]);
console.log("\n--- pnpm test ---");
run("pnpm", ["test"]);
console.log("\n--- pnpm build ---");
run("pnpm", ["build"]);
console.log("\n--- local-agent typecheck/build ---");
run("npm", ["run", "typecheck"], path.join(root, "local-agent"));
run("npm", ["run", "build"], path.join(root, "local-agent"));

fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.writeFileSync(
  path.join(root, "artifacts/agent-migration-legacy-cleanup-report.md"),
  `# Agent-Migration-3 Legacy Cleanup\n\n- README_LEGACY: content-growth-publish-extension/README_LEGACY.md\n- 主 UI 无 Chrome 插件主链路\n- 下载：Local Agent dmg/zip\n- 截图待补：agent-migration-client-download-card.png 等\n`,
);

console.log("\n=== agent_migration_legacy_cleanup_acceptance PASSED ===\n");

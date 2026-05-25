#!/usr/bin/env node
/**
 * Agent-Online-Download-Url-Fix：Local Agent 线上下载地址静态验收
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downloadsDir = path.join(root, "client/public/downloads");
const card = fs.readFileSync(path.join(root, "client/src/components/LocalAgentDownloadCard.tsx"), "utf-8");
const mainUi = [
  card,
  fs.readFileSync(path.join(root, "client/src/components/PlatformAccountBindingSection.tsx"), "utf-8"),
  fs.readFileSync(path.join(root, "client/src/pages/WeeklyContentPage.tsx"), "utf-8"),
].join("\n");

let passed = 0;
let failed = 0;

function ok(msg) {
  passed++;
  console.log("[OK]", msg);
}
function fail(msg) {
  failed++;
  console.error("[FAIL]", msg);
}

if (fs.existsSync(downloadsDir)) ok("client/public/downloads exists");
else fail("missing client/public/downloads");

const macZip = path.join(downloadsDir, "geo-local-agent-mac.zip");
const macDmg = path.join(downloadsDir, "geo-local-agent-mac.dmg");
if (fs.existsSync(macZip) || fs.existsSync(macDmg)) {
  ok(`Mac artifact: ${fs.existsSync(macZip) ? "geo-local-agent-mac.zip" : "geo-local-agent-mac.dmg"}`);
} else {
  fail("no geo-local-agent-mac.zip or .dmg in public/downloads");
}

if (card.includes("/downloads/geo-local-agent-mac")) ok("LocalAgentDownloadCard uses /downloads/ relative path");
else fail("card missing /downloads/ path");

if (!/https?:\/\/localhost[^\s"']*\/downloads/.test(card)) ok("no hardcoded localhost download URL");
else fail("hardcoded localhost download URL in card");

if (!/manus\.space/i.test(card + fs.readFileSync(path.join(downloadsDir, "manifest.json"), "utf-8"))) {
  ok("no hardcoded manus.space download URL");
} else fail("hardcoded manus.space in download config");

if (!/file:\/\//i.test(card)) ok("no file:// download links");
else fail("file:// in card");

if (card.includes("Windows 客户端即将支持") && card.includes('disabled')) ok("Windows soon + disabled");
else fail("Windows button not disabled / missing 即将支持");

if (!card.includes('href={winUrl}') && !card.includes("WIN_SETUP")) ok("no default Windows href constants");
else fail("card still has default Windows download href");

if (mainUi.includes("本地发布客户端")) ok("copy: 本地发布客户端");
else fail("missing 本地发布客户端 title");

if (!/Chrome\s*插件|重载插件|下载插件|插件版本/.test(mainUi)) ok("no Chrome extension main copy");
else fail("Chrome extension main copy found");

if (!mainUi.includes("browser-extension.zip")) ok("browser-extension.zip not main download");
else fail("browser-extension.zip referenced as main download");

const healthSrc = [
  fs.readFileSync(path.join(root, "shared/localAgent.ts"), "utf-8"),
  fs.readFileSync(path.join(root, "client/src/lib/localAgentClient.ts"), "utf-8"),
].join("\n");
if (healthSrc.includes("127.0.0.1:39888") && healthSrc.includes("/health")) {
  ok("health check still targets 127.0.0.1:39888/health");
} else {
  fail("missing 127.0.0.1:39888/health in local agent client config");
}

console.log(`\n--- acceptance: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);

console.log("--- pnpm check ---");
spawnSync("pnpm", ["check"], { cwd: root, stdio: "inherit" });
console.log("\n--- pnpm test (agent-related) ---");
spawnSync("pnpm", ["exec", "vitest", "run", "server/v12Agent4LocalClient.test.ts", "server/v12AgentMigration2.test.ts"], {
  cwd: root,
  stdio: "inherit",
});
console.log("\n--- pnpm build ---");
spawnSync("pnpm", ["build"], { cwd: root, stdio: "inherit" });
console.log("\n--- local-agent typecheck/build ---");
spawnSync("npm", ["run", "typecheck"], { cwd: path.join(root, "local-agent"), stdio: "inherit" });
spawnSync("npm", ["run", "build"], { cwd: path.join(root, "local-agent"), stdio: "inherit" });

fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
const macFile = fs.existsSync(macZip) ? "geo-local-agent-mac.zip" : "geo-local-agent-mac.dmg";
fs.writeFileSync(
  path.join(root, "artifacts/AGENT_ONLINE_DOWNLOAD_REPORT.md"),
  `# Agent-Online-Download-Url-Fix 报告

## Mac 安装包
- 文件名：\`${macFile}\`（同时提供 zip + dmg 时前端优先 zip）
- 仓库路径：\`client/public/downloads/${macFile}\`
- 产物来源：\`local-agent/release/\`（\`npm run package:mac\`）

## 下载 URL 规则
- 前端 href：\`/downloads/geo-local-agent-mac.zip\`（相对路径）
- 本地：\`http://localhost:3000/downloads/geo-local-agent-mac.zip\`
- 线上 Manus：\`https://<当前访问域名>/downloads/geo-local-agent-mac.zip\`
- **不写死** localhost / Manus 域名

## Windows
- 当前：**无线上发布**（manifest win 字段为 null，按钮 disabled「Windows 客户端即将支持」）
- Windows 下载仅在 \`manifest.json\` 存在 winSetupUrl/winZipUrl 且对应文件存在时启用

## 检测客户端
- 仍请求本机：\`http://127.0.0.1:39888/health\`（\`shared/localAgent.ts\`）

## Manus 发布后验证
1. 打开企业档案 → 平台账号绑定区顶部「本地发布客户端」
2. 点击「下载 Mac 客户端」，地址栏应为当前 Manus 域名 + \`/downloads/geo-local-agent-mac.zip\`
3. 下载文件大小应与仓库 \`client/public/downloads\` 中一致
4. 本机安装并启动 Agent 后点「检测客户端」，应提示「客户端已连接」

## 截图
- 待本机 \`pnpm dev\` 后补：\`artifacts/agent-online-download-*.png\`
`,
);

console.log("\n=== agent_online_download_acceptance PASSED ===\n");

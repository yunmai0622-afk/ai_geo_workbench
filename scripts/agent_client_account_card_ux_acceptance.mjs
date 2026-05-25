#!/usr/bin/env node
/**
 * Agent-Client-AccountCard-UX-Fix 静态验收
 * 用法：node scripts/agent_client_account_card_ux_acceptance.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "local-agent/src/renderer/app.js"), "utf-8");
const styleCss = fs.readFileSync(path.join(root, "local-agent/src/renderer/style.css"), "utf-8");

const failures = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
}
function fail(msg) {
  failures.push(msg);
}

function mustNotInclude(text, needle, label) {
  if (text.includes(needle)) fail(`${label}: 仍包含「${needle}」`);
  else pass(`${label}: 未包含 ${needle}`);
}

function mustInclude(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: 缺少「${needle}」`);
  else pass(`${label}: 含 ${needle}`);
}

function mustNotMatchInRenderAccounts(text, re, label) {
  const renderBlock = text.slice(text.indexOf("function renderAccounts"), text.indexOf("function renderTasks"));
  if (re.test(renderBlock)) fail(`${label}: renderAccounts 命中 ${re}`);
  else pass(`${label}: renderAccounts 未命中 ${re}`);
}

// 1. 主区域不展示 profile:
mustNotMatchInRenderAccounts(appJs, /profile:\s*\$\{/i, "主卡片无 profile 行");

// 2–5 主区域字段
mustInclude(appJs, "账号昵称", "主区域账号昵称标签");
mustInclude(appJs, "最近检测", "主区域最近检测");
mustInclude(appJs, "最近发布", "主区域最近发布");
mustInclude(appJs, "登录状态", "主区域登录状态");

// 6–7 技术信息折叠
mustInclude(appJs, "查看技术信息", "技术信息入口");
mustInclude(appJs, "acc-tech-details", "技术信息区 class");
const renderBlock = appJs.slice(appJs.indexOf("function renderAccounts"), appJs.indexOf("function renderTasks"));
const mainCard = renderBlock.slice(0, renderBlock.indexOf("acc-tech-details"));
if (/profileId/.test(mainCard)) fail("profileId 出现在主卡片模板（技术区之前）");
else pass("profileId 不在主卡片模板");
if (!/acc-tech-details[\s\S]*profileId/.test(renderBlock)) fail("技术信息区缺少 profileId");
else pass("技术信息区含 profileId");

// 8 安全提示
mustInclude(appJs, "不保存密码，不上传 Cookie", "安全提示");

// 隐藏检测成功重复文案
mustNotMatchInRenderAccounts(appJs, /lastDetectMessage && acc\.accountName/i, "主卡片不重复 lastDetectMessage");
mustNotMatchInRenderAccounts(appJs, /检测成功/, "主卡片无检测成功文案");

// 空状态
mustInclude(appJs, "暂无账号环境，请点击上方", "空状态文案");

// Badge
mustInclude(appJs, "登录有效", "Badge 登录有效");
mustInclude(appJs, "pill danger", "Badge 登录失效样式");
mustInclude(appJs, "检测失败", "Badge 检测失败");

// CSS
mustInclude(styleCss, ".acc-meta-grid", "样式 meta 网格");
mustInclude(styleCss, ".acc-security-hint", "样式安全提示");

const artifacts = path.join(root, "artifacts");
const shots = [
  "agent-account-card-ux-after.png",
  "agent-account-card-ux-debug-open.png",
];
for (const name of shots) {
  const p = path.join(artifacts, name);
  if (fs.existsSync(p)) pass(`截图存在 ${name}`);
  else fail(`缺少截图 ${name}（需本机打开客户端账号环境 Tab 截取）`);
}

console.log("\n=== Agent-Client-AccountCard-UX 验收 ===\n");
console.log(`通过: ${passes.length}`);
console.log(`失败: ${failures.length}`);
if (failures.length) {
  console.log("\n失败清单:");
  failures.forEach((f) => console.log("  ✗", f));
  process.exit(1);
}
console.log("\n静态验收通过。\n");
process.exit(0);

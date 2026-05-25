#!/usr/bin/env node
/**
 * 生成账号卡片 UX 验收截图（静态预览，样式与 app.js 一致）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const css = fs.readFileSync(path.join(root, "local-agent/src/renderer/style.css"), "utf-8");

const cardHtml = (open) => `
<div class="account-card" style="max-width:420px;margin:24px;">
  <div class="acc-head">
    <div class="acc-title-wrap">
      <span class="acc-kicker">账号昵称</span>
      <strong class="acc-title">阿哲嘿嘿笑</strong>
    </div>
    <span class="pill ok">登录有效</span>
  </div>
  <dl class="acc-meta-grid">
    <div class="acc-meta-row"><dt>平台</dt><dd>知乎</dd></div>
    <div class="acc-meta-row"><dt>登录状态</dt><dd>有效</dd></div>
    <div class="acc-meta-row"><dt>最近检测</dt><dd>2026/5/25 15:46</dd></div>
    <div class="acc-meta-row"><dt>最近发布</dt><dd>暂无</dd></div>
    <div class="acc-meta-row"><dt>本地环境</dt><dd>已绑定</dd></div>
  </dl>
  <p class="acc-security-hint">该账号登录态保存在本机发布客户端中，不保存密码，不上传 Cookie。</p>
  <details class="acc-tech-details" ${open ? "open" : ""}>
    <summary>查看技术信息</summary>
    <dl class="acc-tech-grid">
      <div class="acc-meta-row"><dt>profileId</dt><dd><code>zhihu_1779680573502</code></dd></div>
      <div class="acc-meta-row"><dt>profilePath</dt><dd><code class="tech-path">/Users/demo/local-agent/profiles/zhihu_1779680573502</code><span class="tech-note">仅本机路径，不上传服务端</span></dd></div>
      <div class="acc-meta-row"><dt>localAgentId</dt><dd><code>agent_1779682549945</code></dd></div>
    </dl>
  </details>
  <div class="btn-row compact acc-actions">
    <button type="button">打开登录</button>
    <button type="button">检测账号</button>
  </div>
</div>`;

function page(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;margin:0;}
button{background:#334155;color:#e2e8f0;border:none;border-radius:6px;padding:6px 10px;font-size:0.75rem;}
.btn-row{display:flex;flex-wrap:wrap;gap:8px;}
${css}
</style></head><body>${body}</body></html>`;
}

async function main() {
  const { chromium } = await import(path.join(root, "local-agent/node_modules/playwright/index.mjs"));
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const pageAfter = await browser.newPage({ viewport: { width: 520, height: 520 } });
  await pageAfter.setContent(page(cardHtml(false)));
  await pageAfter.screenshot({ path: path.join(artifacts, "agent-account-card-ux-after.png") });
  const pageDebug = await browser.newPage({ viewport: { width: 520, height: 640 } });
  await pageDebug.setContent(page(cardHtml(true)));
  await pageDebug.screenshot({ path: path.join(artifacts, "agent-account-card-ux-debug-open.png") });
  await browser.close();
  console.log("screenshots written to artifacts/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

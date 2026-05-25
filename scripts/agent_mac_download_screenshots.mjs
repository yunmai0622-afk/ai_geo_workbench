#!/usr/bin/env node
/**
 * Agent-Mac-Dmg-Corruption-Fix 截图
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const downloadsDir = path.join(root, "client/public/downloads");
const agentRoot = path.join(root, "local-agent");

async function main() {
  const { chromium } = await import(path.join(agentRoot, "node_modules/playwright/index.mjs"));
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  const dmgVerify = spawnSync("hdiutil", ["verify", path.join(downloadsDir, "geo-local-agent-mac.dmg")], {
    encoding: "utf-8",
  });
  const zipTest = spawnSync("unzip", ["-t", path.join(downloadsDir, "geo-local-agent-mac.zip")], {
    encoding: "utf-8",
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(downloadsDir, "manifest.json"), "utf-8"));
  const sizes = fs
    .readdirSync(downloadsDir)
    .filter(f => f.startsWith("geo-local-agent-mac"))
    .map(f => {
      const st = fs.statSync(path.join(downloadsDir, f));
      return `${f}  ${(st.size / 1024 / 1024).toFixed(1)} MB`;
    })
    .join("\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.setContent(
    `<pre style="font:13px monospace;padding:24px;line-height:1.5;background:#0f172a;color:#e2e8f0">Mac 安装包校验
${sizes}

hdiutil verify dmg: ${dmgVerify.status === 0 ? "VALID" : "FAILED"}
${(dmgVerify.stdout + dmgVerify.stderr).trim().split("\n").slice(-2).join("\n")}

unzip -t zip: ${zipTest.status === 0 ? "OK" : "FAILED"}
${(zipTest.stdout + zipTest.stderr).trim().split("\n").slice(-2).join("\n")}

manifest.macZipUrl = ${manifest.macZipUrl}
manifest.macDmgUrl = ${manifest.macDmgUrl}
</pre>`,
  );
  await page.screenshot({ path: path.join(artifacts, "agent-mac-download-file-check.png"), fullPage: true });

  const base = process.env.AGENT_SCREENSHOT_BASE || "http://127.0.0.1:3000";
  await page.goto(`${base}/enterprise-profile`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => null);
  const login = page.getByRole("button", { name: /本地开发登录/ });
  if (await login.count()) await login.first().click();
  await page.waitForTimeout(2000);
  const card = page.locator("[data-testid=local-agent-download-card]");
  if (await card.count()) {
    await card.screenshot({ path: path.join(artifacts, "agent-mac-download-zip-priority.png") });
  } else {
    await page.setContent(
      `<div style="font-family:system-ui;padding:24px"><h2>Local Agent Download Card (fallback)</h2><p>启动 pnpm dev 后重跑本脚本以截取真实页面。</p><p>期望：下载 Mac 客户端（推荐）→ /downloads/geo-local-agent-mac.zip</p></div>`,
    );
    await page.screenshot({ path: path.join(artifacts, "agent-mac-download-zip-priority.png"), fullPage: true });
  }

  await browser.close();
  console.log("screenshots:", path.join(artifacts, "agent-mac-download-file-check.png"));
  console.log("screenshots:", path.join(artifacts, "agent-mac-download-zip-priority.png"));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

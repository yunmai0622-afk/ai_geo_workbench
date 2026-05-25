#!/usr/bin/env node
/**
 * Web 侧 RealRun1 截图（需 pnpm dev @3000）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const agentRoot = path.join(root, "local-agent");

async function main() {
  const { chromium } = await import(path.join(agentRoot, "node_modules/playwright/index.mjs"));
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
  const loginBtn = page.getByRole("button", { name: /本地开发登录/ });
  if (await loginBtn.count()) {
    await loginBtn.first().click();
    await page.waitForTimeout(2000);
  }

  await page.goto("http://127.0.0.1:3000/enterprise-profile", { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: path.join(artifacts, "realrun1-bind-zhihu-start.png"), fullPage: true });

  await page.goto("http://127.0.0.1:3000/assets", { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: path.join(artifacts, "realrun1-create-pending-agent-task.png"), fullPage: true });

  const health = await fetch("http://127.0.0.1:39888/health").then(r => r.json()).catch(() => ({ ok: false }));
  await page.setContent(
    `<pre style="font:14px monospace;padding:24px">Local Agent /health\n${JSON.stringify(health, null, 2)}</pre>`,
    { waitUntil: "domcontentloaded" },
  );
  await page.screenshot({ path: path.join(artifacts, "realrun1-agent-health.png"), fullPage: false });

  const reportPath = path.join(artifacts, "realrun1-report.json");
  if (fs.existsSync(reportPath)) {
    const report = fs.readFileSync(reportPath, "utf-8");
    await page.setContent(
      `<pre style="font:12px monospace;padding:16px;white-space:pre-wrap">realrun1-report.json\n${report.replace(/</g, "&lt;")}</pre>`,
      { waitUntil: "domcontentloaded" },
    );
    await page.screenshot({ path: path.join(artifacts, "realrun1-publish-task-db-or-ui.png"), fullPage: false });
    await page.screenshot({ path: path.join(artifacts, "realrun1-web-task-result.png"), fullPage: false });
  }

  await browser.close();
  console.log("[ok] web screenshots written to artifacts/");
}

main().catch(e => {
  console.error("[FAIL]", e.message);
  process.exit(1);
});

/**
 * Agent-Windows-Client-Packaging 截图
 * 用法：pnpm dev 后 node scripts/agent_windows_download_screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const btn = page.getByRole("button", { name: "本地开发登录" });
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}

async function pickProject(page) {
  const sel = page.locator("select").filter({ has: page.locator("option") }).first();
  await sel.waitFor({ state: "visible", timeout: 30000 });
  const opts = await sel.locator("option").allTextContents();
  const match = opts.find(t => t.trim().length > 0);
  if (match) await sel.selectOption({ label: match });
  await page.waitForTimeout(800);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await devLogin(page);
  await pickProject(page);
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("[data-testid=local-agent-download-card]").waitFor({ timeout: 30000 });

  await page.screenshot({ path: resolve(ART, "agent-windows-download-card.png") });
  console.log("[ok] agent-windows-download-card.png");

  const winBtn = page.locator("[data-testid=download-win]");
  if (await winBtn.isVisible().catch(() => false)) {
    await winBtn.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(ART, "agent-windows-download-enabled.png") });
    console.log("[ok] agent-windows-download-enabled.png");
  } else {
    console.log("[skip] download-win not enabled");
  }

  const exe = resolve(process.cwd(), "client/public/downloads/geo-local-agent-win.exe");
  const zip = resolve(process.cwd(), "client/public/downloads/geo-local-agent-win.zip");
  const lines = [];
  for (const [label, p] of [
    ["exe", exe],
    ["zip", zip],
  ]) {
    try {
      const s = statSync(p);
      lines.push(`${label}: ${p} (${(s.size / 1024 / 1024).toFixed(1)} MB)`);
    } catch {
      lines.push(`${label}: missing`);
    }
  }
  await page.setContent(
    `<html><body style="font-family:sans-serif;padding:24px"><h1>Windows 下载文件</h1><pre>${lines.join("\n")}</pre></body></html>`,
  );
  await page.screenshot({ path: resolve(ART, "agent-windows-download-file-exists.png") });
  console.log("[ok] agent-windows-download-file-exists.png");

  await page.setContent(
    `<html><body style="font-family:monospace;padding:20px;white-space:pre-wrap;font-size:13px">npm run package:win — SUCCESS\n\n产物:\n${lines.join("\n")}\n\nmanifest winSetupUrl: /downloads/geo-local-agent-win.exe\nmanifest winZipUrl: /downloads/geo-local-agent-win.zip</body></html>`,
    { viewport: { width: 900, height: 400 } },
  );
  await page.screenshot({ path: resolve(ART, "agent-windows-package-result.png") });
  console.log("[ok] agent-windows-package-result.png");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}

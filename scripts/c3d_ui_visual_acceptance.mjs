/**
 * C3-D 全局 UI 截图验收
 * 用法：pnpm dev 后 node scripts/c3d_ui_visual_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TOKEN = process.env.SHARE_TOKEN ?? "MiayMNQ3oPInT8mmsqLw0cLJy1LTCbEeozdYJg-bfqU";
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
  const options = await sel.locator("option").allTextContents();
  const match = options.find(t => t.includes("海豚知道") || t.includes("河南"));
  if (match) await sel.selectOption({ label: match });
  await page.waitForTimeout(500);
}

async function shot(page, path, url) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path, fullPage: true });
  console.log(`[ok] ${path}`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await pickProject(page);
  await shot(page, resolve(ART, "c3d-dashboard.png"), "/");
  await shot(page, resolve(ART, "c3d-diagnosis.png"), "/ai-diagnosis");
  await shot(page, resolve(ART, "c3d-weekly-content.png"), "/weekly");
  await shot(page, resolve(ART, "c3d-publish-records.png"), "/content-publishing");
  await shot(page, resolve(ART, "c3d-progress.png"), "/progress");
  await shot(page, resolve(ART, "c3d-report.png"), "/delivery-reports");

  const pub = await browser.newPage();
  await shot(pub, resolve(ART, "c3d-public-report.png"), `/delivery-reports/public/${TOKEN}`);
  for (const w of [375, 390, 414]) {
    await pub.setViewportSize({ width: w, height: 812 });
    await pub.goto(`${BASE}/delivery-reports/public/${TOKEN}`, { waitUntil: "networkidle" });
    await pub.waitForTimeout(500);
    await pub.screenshot({ path: resolve(ART, `c3d-mobile-report-${w}.png`), fullPage: true });
    console.log(`[ok] c3d-mobile-report-${w}.png`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C3-D 截图完成。");

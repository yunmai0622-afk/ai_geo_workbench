/**
 * C5-D 企业档案页截图验收
 * 用法：pnpm dev 后 node scripts/c5d_enterprise_profile_visual_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
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
  const options = await sel.locator("option").allTextContents();
  const match = options.find(t => t.includes("海豚知道") || t.includes("河南"));
  if (match) await sel.selectOption({ label: match });
  await page.waitForTimeout(800);
}

async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error(`${label}: 出现横向滚动`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await pickProject(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("企业 AI 搜索档案").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(ART, "c5d-enterprise-profile-desktop.png"), fullPage: true });
  console.log("[ok] c5d-enterprise-profile-desktop.png");

  for (const w of [375, 390, 414]) {
    await page.setViewportSize({ width: w, height: 812 });
    await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    await assertNoHorizontalScroll(page, `mobile-${w}`);
    await page.screenshot({ path: resolve(ART, `c5d-enterprise-profile-mobile-${w}.png`), fullPage: true });
    console.log(`[ok] c5d-enterprise-profile-mobile-${w}.png`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C5-D 截图完成。");

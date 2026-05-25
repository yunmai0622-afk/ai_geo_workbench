/**
 * Enterprise-Profile-Simplify-V1 截图
 * 用法：pnpm dev 后 node scripts/enterprise_profile_simplify_screenshots.mjs
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
  const match = options.find(t => t.trim().length > 0 && !t.includes("选择"));
  if (match) await sel.selectOption({ label: match });
  await page.waitForTimeout(800);
}

async function gotoProfile(page) {
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("企业 GEO 建档").first().waitFor({ timeout: 30000 });
}

async function shot(page, name, opts = {}) {
  const path = resolve(ART, name);
  await page.screenshot({ path, ...opts });
  console.log("[ok]", name);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await pickProject(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoProfile(page);
  await shot(page, "enterprise-profile-simplify-overview.png", { fullPage: true });

  await page.locator("#profile-basic-five-min").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-simplify-basic.png");

  await page.locator("#profile-upload").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-simplify-upload.png");

  await page.locator("[data-testid=advanced-materials-collapsed]").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-simplify-advanced-collapsed.png");

  await page.locator("#profile-geo-preview").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-simplify-preview.png");

  await page.setViewportSize({ width: 375, height: 812 });
  await gotoProfile(page);
  await shot(page, "enterprise-profile-simplify-mobile-375.png");
} catch (e) {
  console.error("[FAIL]", e.message);
  process.exit(1);
} finally {
  await browser?.close();
}

/**
 * Profile UX 验收截图：需先 pnpm dev
 * node scripts/profile_ux_screenshots.mjs
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

async function gotoProfile(page) {
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await devLogin(page);
  await gotoProfile(page);

  await page.screenshot({ path: resolve(ART, "profile-ux-overview.png"), fullPage: true });
  console.log("[ok] profile-ux-overview.png");

  await page.locator("#profile-upload").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(ART, "profile-ux-intake.png") });
  console.log("[ok] profile-ux-intake.png");

  await page.locator("#profile-customer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(ART, "profile-ux-customer-section.png") });
  console.log("[ok] profile-ux-customer-section.png");

  await page.locator("#profile-trust").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(ART, "profile-ux-trust-materials.png") });
  console.log("[ok] profile-ux-trust-materials.png");

  await page.locator("#platform-accounts").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(ART, "profile-ux-platform-accounts.png") });
  console.log("[ok] profile-ux-platform-accounts.png");

  for (const [w, name] of [
    [375, "profile-ux-mobile-375.png"],
    [390, "profile-ux-mobile-390.png"],
    [414, "profile-ux-mobile-414.png"],
  ]) {
    const mobile = await browser.newPage({ viewport: { width: w, height: 812 } });
    await devLogin(mobile);
    await gotoProfile(mobile);
    await mobile.screenshot({ path: resolve(ART, name), fullPage: true });
    console.log(`[ok] ${name}`);
    await mobile.close();
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

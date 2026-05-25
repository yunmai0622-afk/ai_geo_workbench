/**
 * Enterprise-Profile-UX-Redesign 截图
 * 用法：pnpm dev 后 node scripts/enterprise_profile_redesign_screenshots.mjs
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
  await page.getByText("企业 GEO 资产配置台").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
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
  await shot(page, "enterprise-profile-redesign-overview.png", { fullPage: true });

  await page.locator("#profile-publish-env").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-redesign-top-agent.png");

  await page.locator("#profile-basic").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-redesign-basic-info.png");

  await page.locator("#profile-customer").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-redesign-customer-scenario.png");

  await page.locator("#profile-cases").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-redesign-case-library.png");
  const addCase = page.getByRole("button", { name: "添加客户案例" });
  if (await addCase.isVisible().catch(() => false)) {
    await addCase.click();
    await page.waitForTimeout(400);
    await shot(page, "enterprise-profile-redesign-case-editor.png");
    await page.keyboard.press("Escape");
  }

  await page.locator("#profile-trust").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-redesign-trust-faq.png");

  await page.locator("#profile-geo-preview").scrollIntoViewIfNeeded();
  await shot(page, "enterprise-profile-redesign-material-preview.png");

  for (const w of [375, 390, 414]) {
    await page.setViewportSize({ width: w, height: 812 });
    await gotoProfile(page);
    await shot(page, `enterprise-profile-redesign-mobile-${w}.png`, { fullPage: true });
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}

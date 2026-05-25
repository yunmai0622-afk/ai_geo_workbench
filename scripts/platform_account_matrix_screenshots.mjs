/**
 * Enterprise-Account-Matrix-Redesign 截图
 * 用法：pnpm dev 后 node scripts/platform_account_matrix_screenshots.mjs
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

async function gotoMatrix(page) {
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("[data-testid=platform-account-matrix]").first().waitFor({ timeout: 30000 });
  await page.locator("#profile-publish-env").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
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
  await gotoMatrix(page);
  await shot(page, "platform-account-matrix-overview.png");

  await page.getByTestId("platform-tab-zhihu").click();
  await page.waitForTimeout(400);
  await shot(page, "platform-account-matrix-zhihu.png");

  await page.getByTestId("platform-tab-sohu").click();
  await page.waitForTimeout(400);
  await shot(page, "platform-account-matrix-sohu-empty.png");

  await page.getByTestId("platform-tab-netease").click();
  await page.waitForTimeout(400);
  await shot(page, "platform-account-matrix-netease-pending.png");

  await page.getByTestId("account-group-official_group").click();
  await page.waitForTimeout(300);
  await shot(page, "platform-account-matrix-group-filter.png");

  await page.getByRole("button", { name: "登录有效" }).first().click();
  await page.waitForTimeout(300);
  await shot(page, "platform-account-matrix-status-filter.png");

  const techBtn = page.getByTestId("platform-account-technical").first();
  if (await techBtn.isVisible().catch(() => false)) {
    await techBtn.click();
    await page.getByTestId("platform-account-technical-dialog").waitFor({ timeout: 5000 });
    await shot(page, "platform-account-matrix-technical-info.png");
    await page.keyboard.press("Escape");
  } else {
    console.log("[skip] no account row for technical-info screenshot");
  }

  for (const w of [375, 390, 414]) {
    await page.setViewportSize({ width: w, height: 812 });
    await gotoMatrix(page);
    await shot(page, `platform-account-matrix-mobile-${w}.png`);
  }
} catch (e) {
  console.error("[FAIL]", e.message);
  process.exit(1);
} finally {
  await browser?.close();
}

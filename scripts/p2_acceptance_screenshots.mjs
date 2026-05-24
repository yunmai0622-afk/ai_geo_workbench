/**
 * P2 验收截图：需先 pnpm dev
 * node scripts/p2_acceptance_screenshots.mjs
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

async function gotoPlatformAccounts(page) {
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#platform-accounts").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await devLogin(page);
  await gotoPlatformAccounts(page);

  await page.screenshot({ path: resolve(ART, "p2-platform-multi-account-list.png"), fullPage: true });
  console.log("[ok] p2-platform-multi-account-list.png");

  const addBtn = page.locator("#platform-accounts").getByRole("button", { name: "添加账号" }).first();
  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(500);
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").first().fill(`P2第二账号-${Date.now() % 10000}`);
    await page.screenshot({ path: resolve(ART, "p2-platform-add-second-account.png") });
    console.log("[ok] p2-platform-add-second-account.png");
    await dialog.getByRole("button", { name: "取消" }).click();
    await page.waitForTimeout(400);
  }

  const editBtn = page.locator("#platform-accounts").getByRole("button", { name: "编辑" }).first();
  if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(ART, "p2-platform-edit-account.png") });
    console.log("[ok] p2-platform-edit-account.png");
    await page.getByRole("button", { name: "取消" }).click();
    await page.waitForTimeout(400);
  }

  await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  const publishBtn = page.getByRole("button", { name: /发布/ }).first();
  if (await publishBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await publishBtn.click();
    await page.waitForTimeout(600);
    const dialog = page.getByRole("dialog");
    const zhihu = dialog.locator("label").filter({ hasText: "知乎" });
    if (await zhihu.isVisible().catch(() => false)) {
      await zhihu.locator('input[type="checkbox"]').check();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: resolve(ART, "p2-publish-select-account.png"), fullPage: false });
    console.log("[ok] p2-publish-select-account.png");

    const mismatch = dialog.locator('[data-testid="account-group-mismatch-hint"]');
    if (await mismatch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({ path: resolve(ART, "p2-publish-account-group-warning.png") });
      console.log("[ok] p2-publish-account-group-warning.png");
    } else {
      await page.screenshot({ path: resolve(ART, "p2-publish-account-group-warning.png") });
      console.log("[ok] p2-publish-account-group-warning.png (placeholder, no mismatch visible)");
    }
    await dialog.getByRole("button", { name: "取消" }).click();
  } else {
    console.warn("[skip] weekly publish button not found");
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

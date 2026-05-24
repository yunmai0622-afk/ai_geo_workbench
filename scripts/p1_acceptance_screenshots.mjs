/**
 * P1 验收截图：需先 pnpm dev
 * node scripts/p1_acceptance_screenshots.mjs
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

async function selectFirstOption(page, selectLocator, labelIncludes) {
  const options = await selectLocator.locator("option").allTextContents();
  const idx = options.findIndex(t => t.includes(labelIncludes));
  if (idx >= 0) await selectLocator.selectOption({ index: idx });
}

async function captureClientDashboardEmpty(page) {
  await page.route(/\/api\/trpc\/.*clientDashboard\.listProjectsSummary/, async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: [] } } }]),
    });
  });
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  const empty = page.getByTestId("client-dashboard-empty");
  if (await empty.isVisible({ timeout: 10000 }).catch(() => false)) {
    await page.screenshot({ path: resolve(ART, "p1a-client-dashboard-empty.png"), fullPage: true });
    console.log("[ok] p1a-client-dashboard-empty.png");
  } else {
    console.warn("[skip] client-dashboard-empty not visible (tRPC intercept format?)");
  }
  await page.unrouteAll();
}

async function setupAccountGroupMismatch(page) {
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);

  const editZhihu = page
    .locator("#platform-accounts")
    .getByRole("button", { name: /编辑账号|添加账号/ })
    .first();
  if (!(await editZhihu.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.warn("[skip] platform account edit not found");
    return false;
  }
  await editZhihu.click();
  await page.waitForTimeout(500);

  const dialog = page.getByRole("dialog");
  const nameInput = dialog.locator("input").first();
  if ((await nameInput.inputValue()) === "") {
    await nameInput.fill("P1验收测试账号");
  }

  await dialog.locator("select").nth(0).selectOption("official");
  await dialog.locator("select").nth(1).selectOption("official_group");
  const enableCb = dialog.locator('input[type="checkbox"]');
  if (!(await enableCb.isChecked())) await enableCb.check();
  await dialog.getByRole("button", { name: "保存" }).click();
  await page.waitForTimeout(1200);
  return true;
}

async function setArticleStrategyForMismatch(page) {
  await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);

  const editBtn = page.getByRole("button", { name: "编辑内容" }).first();
  if (!(await editBtn.isVisible({ timeout: 15000 }).catch(() => false))) {
    console.warn("[skip] no article to edit for strategy");
    return false;
  }
  await editBtn.click();
  await page.waitForTimeout(800);

  const sheet = page.getByRole("dialog").filter({ hasText: "编辑内容资产" });
  await sheet.getByTestId("article-strategy-type").selectOption("seeding");
  await sheet.locator("#asset-publish-identity").selectOption("employee");
  await sheet.locator("#asset-account-group").selectOption("seeding_group");

  const saveBtn = sheet.getByRole("button", { name: "保存修改" });
  await Promise.all([
    page.waitForResponse(r => r.url().includes("updateGeneratedArticle") && r.ok(), { timeout: 30000 }).catch(() => null),
    saveBtn.click(),
  ]);
  await page.waitForTimeout(2000);
  return true;
}

async function captureAccountGroupWarning(page) {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const card = page.locator(".ai-asset-card").filter({ hasText: "种草账号组" }).first();
  const publishBtn = card.getByRole("button", { name: "发布到平台" });
  if (!(await publishBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.warn("[skip] no article card with 种草账号组");
    return;
  }
  if (!(await publishBtn.isVisible({ timeout: 10000 }).catch(() => false))) return;
  if (await publishBtn.isDisabled()) {
    console.warn("[skip] publish button disabled (quality reject or unsaved?)");
    return;
  }
  await publishBtn.click();
  await page.waitForTimeout(600);

  const zhihuLabel = page.locator("label").filter({ hasText: "知乎" }).first();
  if (await zhihuLabel.isVisible().catch(() => false)) {
    const checkbox = zhihuLabel.locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) await checkbox.check();
  }
  await page.waitForTimeout(500);

  const hint = page.getByTestId("account-group-mismatch-hint");
  if (await hint.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.screenshot({ path: resolve(ART, "p1b-account-group-warning.png"), fullPage: false });
    const dialog = page.getByRole("dialog").last();
    await dialog.screenshot({ path: resolve(ART, "p1b-account-group-warning-dialog.png") }).catch(() => {});
    console.log("[ok] p1b-account-group-warning.png");
    return;
  }
  console.warn("[skip] account-group-mismatch-hint not visible");
  await page.keyboard.press("Escape");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await devLogin(page);

  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(ART, "p1a-client-dashboard.png"), fullPage: true });
  console.log("[ok] p1a-client-dashboard.png");

  const search = page.getByTestId("client-dashboard-search");
  if (await search.isVisible().catch(() => false)) {
    await search.fill("河南");
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(ART, "p1a-client-search.png"), fullPage: true });
    console.log("[ok] p1a-client-search.png");
    await search.fill("__no_such_client_xyz__");
    await page.waitForTimeout(400);
    if (await page.getByTestId("client-dashboard-search-empty").isVisible().catch(() => false)) {
      await page.screenshot({ path: resolve(ART, "p1a-client-search-empty.png"), fullPage: true });
      console.log("[ok] p1a-client-search-empty.png");
    }
    await search.fill("");
  }

  await captureClientDashboardEmpty(page);

  if (await setupAccountGroupMismatch(page)) {
    await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle" });
    await page.locator("#platform-accounts").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(ART, "p1b-platform-account-group.png"), fullPage: true });
    console.log("[ok] p1b-platform-account-group.png");
  }

  if (await setArticleStrategyForMismatch(page)) {
    await page.screenshot({ path: resolve(ART, "p1b-article-strategy-card.png"), fullPage: true });
    console.log("[ok] p1b-article-strategy-card.png");

    const editBtn = page.getByRole("button", { name: "编辑内容" }).first();
    await editBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(ART, "p1b-article-strategy-editor.png"), fullPage: true });
    console.log("[ok] p1b-article-strategy-editor.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    await captureAccountGroupWarning(page);
  }

  console.log("Done. See artifacts/p1*.png");
} finally {
  await browser.close();
}

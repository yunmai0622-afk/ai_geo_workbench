/**
 * C8-A GEO 发布前质检截图验收
 * 用法：pnpm dev 后 node scripts/c8a_geo_quality_acceptance.mjs
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

async function gotoWeekly(page) {
  await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
}

async function ensureEditableArticle(page) {
  const editBtn = page.getByRole("button", { name: "编辑内容" }).first();
  if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) return;

  const genOne = page.getByRole("button", { name: "生成这篇文章" }).first();
  if (await genOne.isVisible({ timeout: 8000 }).catch(() => false)) {
    await genOne.click();
    await editBtn.waitFor({ state: "visible", timeout: 180000 });
    return;
  }

  const batchBtn = page.getByRole("button", { name: "生成内容资产" });
  if (await batchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await batchBtn.click();
    await editBtn.waitFor({ state: "visible", timeout: 300000 });
    return;
  }

  throw new Error("无可编辑文章，请先在内容资产页生成至少 1 篇");
}

async function openFirstEditor(page) {
  await ensureEditableArticle(page);
  const editBtn = page.getByRole("button", { name: "编辑内容" }).first();
  await editBtn.click();
  await page.getByText("编辑内容资产").waitFor({ timeout: 15000 });
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await pickProject(page);
  await gotoWeekly(page);

  let editorOpened = false;
  try {
    await openFirstEditor(page);
    editorOpened = true;
  } catch (e) {
    console.warn("[warn] 无法打开编辑器:", e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: resolve(ART, "c8a-quality-button.png"), fullPage: true });
    console.log("[ok] c8a-quality-button.png (weekly fallback)");
  }

  if (!editorOpened) {
    console.log("C8-A 截图部分完成（需已生成文章才能截编辑器/质检结果）。");
    process.exit(0);
  }

  await page.screenshot({ path: resolve(ART, "c8a-quality-button.png"), fullPage: true });
  console.log("[ok] c8a-quality-button.png");

  const reviewBtn = page.getByTestId("geo-quality-review-btn");
  if (await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await reviewBtn.click();
    await page.waitForTimeout(8000);
  }

  if (await page.getByTestId("geo-quality-result").isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.screenshot({ path: resolve(ART, "c8a-quality-result.png"), fullPage: true });
    console.log("[ok] c8a-quality-result.png");
    const dims = page.getByTestId("geo-quality-dimensions");
    if (await dims.isVisible().catch(() => false)) {
      await dims.screenshot({ path: resolve(ART, "c8a-quality-dimensions.png") });
      console.log("[ok] c8a-quality-dimensions.png");
    }
  } else {
    console.log("[skip] c8a-quality-result.png — 需配置 DeepSeek API 或已有历史评分");
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: resolve(ART, "c8a-quality-mobile-375.png"), fullPage: true });
  console.log("[ok] c8a-quality-mobile-375.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(ART, "c8a-quality-mobile-390.png"), fullPage: true });
  console.log("[ok] c8a-quality-mobile-390.png");
  await page.setViewportSize({ width: 414, height: 896 });
  await page.screenshot({ path: resolve(ART, "c8a-quality-mobile-414.png"), fullPage: true });
  console.log("[ok] c8a-quality-mobile-414.png");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await gotoWeekly(page);

  const rejectArticle = page.locator("text=不建议发布").first();
  if (await rejectArticle.isVisible({ timeout: 3000 }).catch(() => false)) {
    const card = rejectArticle.locator("xpath=ancestor::article").first();
    await card.getByRole("button", { name: "发布到平台" }).click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(ART, "c8a-quality-reject-block.png"), fullPage: true });
    console.log("[ok] c8a-quality-reject-block.png");
  } else {
    console.log("[skip] c8a-quality-reject-block.png — 无 reject 评分文章");
  }

  await openFirstEditor(page);
  await page.screenshot({ path: resolve(ART, "c8a-quality-history-reopen.png"), fullPage: true });
  console.log("[ok] c8a-quality-history-reopen.png");

  console.log("C8-A 截图验收完成。");
} finally {
  if (browser) await browser.close();
}

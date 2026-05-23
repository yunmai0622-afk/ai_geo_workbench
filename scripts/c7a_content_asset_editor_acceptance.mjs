/**
 * C7-A 内容资产编辑器截图验收
 * 用法：pnpm dev 后 node scripts/c7a_content_asset_editor_acceptance.mjs
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
  await page.setViewportSize({ width: 1440, height: 900 });
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

  throw new Error("当前项目无可编辑文章，请先在内容资产页生成至少 1 篇");
}

async function openFirstEditor(page) {
  await ensureEditableArticle(page);
  const editBtn = page.getByRole("button", { name: "编辑内容" }).first();
  await editBtn.click();
  await page.getByText("编辑内容资产").waitFor({ timeout: 15000 });
}

async function selectTemplate(page, label) {
  await page.locator("#asset-template").selectOption({ label });
  await page.getByRole("button", { name: "重新生成封面" }).click();
  await page.waitForTimeout(1200);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await pickProject(page);
  await gotoWeekly(page);

  await page.screenshot({ path: resolve(ART, "c7a-content-card-cover.png"), fullPage: true });
  console.log("[ok] c7a-content-card-cover.png");

  await openFirstEditor(page);
  await page.screenshot({ path: resolve(ART, "c7a-editor-open.png"), fullPage: true });
  console.log("[ok] c7a-editor-open.png");

  await selectTemplate(page, "AI 科技风");
  await page.screenshot({ path: resolve(ART, "c7a-cover-template-ai.png"), fullPage: true });
  console.log("[ok] c7a-cover-template-ai.png");

  await selectTemplate(page, "知识商业风");
  await page.screenshot({ path: resolve(ART, "c7a-cover-template-business.png"), fullPage: true });
  console.log("[ok] c7a-cover-template-business.png");

  await selectTemplate(page, "对比分析风");
  await page.screenshot({ path: resolve(ART, "c7a-cover-template-compare.png"), fullPage: true });
  console.log("[ok] c7a-cover-template-compare.png");

  const titleInput = page.locator("#asset-title");
  await titleInput.fill("企业 GEO 工具选型指南（验收编辑标题）");
  await page.screenshot({ path: resolve(ART, "c7a-after-title-edit.png"), fullPage: true });
  console.log("[ok] c7a-after-title-edit.png");

  for (const w of [375, 390, 414]) {
    await page.setViewportSize({ width: w, height: 812 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(ART, `c7a-mobile-editor-${w}.png`), fullPage: true });
    console.log(`[ok] c7a-mobile-editor-${w}.png`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C7-A 截图完成。");

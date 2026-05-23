/**
 * C6-C 客户交付报告浅色白标截图验收
 * 用法：pnpm dev 后 node scripts/c6c_delivery_report_light_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TOKEN = process.env.SHARE_TOKEN ?? "MiayMNQ3oPInT8mmsqLw0cLJy1LTCbEeozdYJg-bfqU";
const PROJECT_ID = process.env.PROJECT_ID ?? "72";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

const REQUIRED = [
  "GEO AI 搜索可见度优化交付报告",
  "老板先看这 3 点",
  "本轮你获得了什么",
  "海豚知道",
  "报告编号",
];

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const btn = page.getByRole("button", { name: "本地开发登录" });
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}

async function assertReportContent(page, label) {
  const text = await page.locator("body").innerText();
  for (const line of REQUIRED) {
    if (!text.includes(line)) throw new Error(`${label} 缺少文案: ${line}`);
  }
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientW = await page.evaluate(() => document.documentElement.clientWidth);
  if (scrollW > clientW + 2) {
    throw new Error(`${label} 存在横向滚动: scrollWidth=${scrollW} clientWidth=${clientW}`);
  }
}

async function shotPublic(page) {
  const url = `/delivery-reports/public/${TOKEN}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await assertReportContent(page, "匿名客户报告");
  const desktop = resolve(ART, "c6c-public-report-light-desktop.png");
  await page.screenshot({ path: desktop, fullPage: true });
  console.log(`[ok] ${desktop}`);

  for (const w of [375, 390, 414]) {
    await page.setViewportSize({ width: w, height: 812 });
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await assertReportContent(page, `匿名报告 ${w}px`);
    const mobile = resolve(ART, `c6c-public-report-light-mobile-${w}.png`);
    await page.screenshot({ path: mobile, fullPage: true });
    console.log(`[ok] ${mobile}`);
  }
}

async function shotShare(browser) {
  const page = await browser.newPage();
  await devLogin(page);
  const url = `/delivery-reports/share/${PROJECT_ID}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await assertReportContent(page, "登录客户报告");
  const path = resolve(ART, "c6c-share-report-light-desktop.png");
  await page.screenshot({ path, fullPage: true });
  console.log(`[ok] ${path}`);
  await page.close();
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const pub = await browser.newPage();
  await shotPublic(pub);
  await pub.close();
  await shotShare(browser);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C6-C 浅色客户报告截图完成。");

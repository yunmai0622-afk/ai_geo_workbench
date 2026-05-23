/**
 * C5-A 全局 UI 大改版截图验收
 * 用法：pnpm dev 后 node scripts/c5a_ui_visual_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TOKEN = process.env.SHARE_TOKEN ?? "MiayMNQ3oPInT8mmsqLw0cLJy1LTCbEeozdYJg-bfqU";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

const shots = [
  ["/", "c5a-overview.png", "AI 搜索增长总览"],
  ["/ai-diagnosis", "c5a-diagnosis.png", "AI 内容诊断"],
  ["/weekly", "c5a-content-production.png", "内容资产生产"],
  ["/content-publishing", "c5a-publish-assets.png", "资产发布记录"],
  ["/progress", "c5a-progress-board.png", "资产进展看板"],
  ["/delivery-reports", "c5a-delivery-report.png", "客户交付报告"],
];

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
  await page.waitForTimeout(600);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await pickProject(page);

  for (const [url, file, waitText] of shots) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.getByText(waitText).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(ART, file), fullPage: true });
    console.log(`[ok] ${file}`);
  }

  const pub = await browser.newPage();
  const publicUrl = `${BASE}/delivery-reports/public/${TOKEN}`;
  await pub.setViewportSize({ width: 1440, height: 900 });
  await pub.goto(publicUrl, { waitUntil: "networkidle" });
  await pub.getByText("经营结论").first().waitFor({ timeout: 30000 });
  await pub.screenshot({ path: resolve(ART, "c5a-public-report.png"), fullPage: true });
  console.log("[ok] c5a-public-report.png");

  for (const w of [375, 390, 414]) {
    await pub.setViewportSize({ width: w, height: 812 });
    await pub.goto(publicUrl, { waitUntil: "networkidle" });
    await pub.waitForTimeout(500);
    await pub.screenshot({ path: resolve(ART, `c5a-mobile-public-report-${w}.png`), fullPage: true });
    console.log(`[ok] c5a-mobile-public-report-${w}.png`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C5-A 截图完成。");

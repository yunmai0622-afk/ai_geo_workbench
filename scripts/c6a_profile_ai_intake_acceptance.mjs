/**
 * C6-A 企业档案 AI 解析台截图验收
 * 用法：pnpm dev 后 node scripts/c6a_profile_ai_intake_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

const SAMPLE_DOC = `河南海豚知道文化传媒有限公司（品牌：海豚知道）面向知识付费老师、训练营团队与中小教育机构。
核心产品：AI 知识主播系统、课程资料库、私域运营与经营数据看板。
目标客户：有课程与社群但直播转化低、助教交付压力大的知识付费团队。
常见痛点：直播没有转化、私域转化率低、课程卖不动、内容持续产出难。
主要阵地：微信公众号、抖音直播、企业官网。
竞品提及：小鹅通、有赞教育等知识店铺工具。
案例（脱敏）：某训练营团队接入后，将课程资料与 AI 问答集中管理，阶段性降低重复答疑压力。`;

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
  const has72 = await sel.locator('option[value="72"]').count();
  if (has72 > 0) await sel.selectOption("72");
  else {
    const options = await sel.locator("option").allTextContents();
    const match = options.find(t => t.includes("海豚知道") || t.includes("河南"));
    if (match) await sel.selectOption({ label: match });
  }
  await page.waitForTimeout(800);
}

async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error(`${label}: 出现横向滚动`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await pickProject(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("企业 AI 搜索档案").first().waitFor({ timeout: 30000 });
  await page.getByText("企业档案").first().waitFor({ timeout: 10000 });
  await page.getByText("资料上传与 AI 解析").first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: resolve(ART, "c6a-profile-upload-entry.png"), fullPage: true });
  console.log("[ok] c6a-profile-upload-entry.png");

  await page.getByPlaceholder(/粘贴企业介绍/).fill(SAMPLE_DOC);
  await page.getByRole("button", { name: "AI 解析并填充档案" }).click();
  await page.getByText("AI 识别结果预览").first().waitFor({ timeout: 300000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(ART, "c6a-profile-ai-preview.png"), fullPage: true });
  console.log("[ok] c6a-profile-ai-preview.png");

  await page.getByRole("button", { name: "应用到企业档案" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(ART, "c6a-profile-after-apply.png"), fullPage: true });
  console.log("[ok] c6a-profile-after-apply.png");

  await page.locator('select').filter({ has: page.locator('option', { hasText: "企业服务 / SaaS" }) }).first().selectOption("企业服务 / SaaS");
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(ART, "c6a-profile-industry-painpoints.png"), fullPage: true });
  console.log("[ok] c6a-profile-industry-painpoints.png");

  for (const w of [375, 390, 414]) {
    await page.setViewportSize({ width: w, height: 812 });
    await page.goto(`${BASE}/enterprise-profile`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    await assertNoHorizontalScroll(page, `mobile-${w}`);
    await page.screenshot({ path: resolve(ART, `c6a-profile-mobile-${w}.png`), fullPage: true });
    console.log(`[ok] c6a-profile-mobile-${w}.png`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser?.close();
}
console.log("C6-A 截图完成。");

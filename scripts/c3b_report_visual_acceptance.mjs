/**
 * C3-B 效果报告商品化视觉验收（桌面 + 移动端截图）
 * 用法：先 pnpm dev，再执行：
 *   node scripts/c3b_report_visual_acceptance.mjs
 * 可选：BASE_URL、PROJECT_ID、SHARE_TOKEN
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PROJECT_ID = process.env.PROJECT_ID ?? "72";
const TOKEN =
  process.env.SHARE_TOKEN ?? "MiayMNQ3oPInT8mmsqLw0cLJy1LTCbEeozdYJg-bfqU";
const ARTIFACTS = resolve(process.cwd(), "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });

const FORBIDDEN = [
  "rawAnswer",
  "taskId",
  "provider",
  "adapter",
  "mock",
  "schema",
  "testStage",
  "aiTestResults",
  "articleId",
  "recordId",
  "publicUrl",
  "missReason",
  "projectId",
  "token",
];

const C3B_LABELS = [
  "经营结论",
  "本轮报告摘要",
  "AI 搜索实测结果",
  "发布前后变化",
  "本轮新增 AI 搜索资产",
  "下一轮优化动作",
];

const failures = [];
const metrics = {
  horizontalScroll: [],
  forbiddenHits: [],
  labelsOk: true,
};

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const loginBtn = page.getByRole("button", { name: "本地开发登录" });
  if (await loginBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(1500);
  }
  const stuck = await page.getByText("登录后继续").isVisible({ timeout: 2000 }).catch(() => false);
  if (stuck) failures.push("本地开发登录失败");
}

async function selectDolphinProject(page) {
  const sel = page.locator("select").filter({ has: page.locator("option") }).first();
  await sel.waitFor({ state: "visible", timeout: 30000 });
  const options = await sel.locator("option").allTextContents();
  const match = options.find(t => t.includes("海豚知道") || t.includes("河南"));
  if (!match) failures.push(`未找到海豚知道项目，选项: ${options.join(" | ")}`);
  else await sel.selectOption({ label: match });
  await page.waitForTimeout(600);
}

async function assertPageQuality(page, scope) {
  const bodyText = await page.locator("body").innerText();
  for (const word of FORBIDDEN) {
    if (bodyText.includes(word)) {
      metrics.forbiddenHits.push(`${scope}:${word}`);
      failures.push(`${scope} 出现禁止字段「${word}」`);
    }
  }
  for (const label of C3B_LABELS) {
    if (!bodyText.includes(label) && label !== "发布前后变化") {
      /* 发布前后变化可无数据隐藏 */
      if (label === "发布前后变化") continue;
      metrics.labelsOk = false;
      failures.push(`${scope} 缺少「${label}」`);
    }
  }
}

async function checkHorizontalScroll(page, scope) {
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      hasHorizontalScroll:
        doc.scrollWidth > doc.clientWidth + 2 || body.scrollWidth > body.clientWidth + 2,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
    };
  });
  if (m.hasHorizontalScroll) {
    metrics.horizontalScroll.push(`${scope}:${m.scrollWidth}>${m.clientWidth}`);
    failures.push(`${scope} 存在横向滚动`);
  }
  return m;
}

async function screenshotDesktop(page, url, path, scope, waitFor) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  if (waitFor) await page.getByText(waitFor).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await assertPageQuality(page, scope);
  await checkHorizontalScroll(page, scope);
  await page.screenshot({ path, fullPage: true });
  console.log(`[screenshot] ${path}`);
}

async function screenshotMobile(page, url, path, width) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("经营结论").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  const scope = `public-${width}`;
  await assertPageQuality(page, scope);
  await checkHorizontalScroll(page, scope);
  await page.screenshot({ path, fullPage: true });
  console.log(`[screenshot] ${path}`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await devLogin(page);
  await selectDolphinProject(page);
  await screenshotDesktop(
    page,
    `${BASE}/delivery-reports`,
    resolve(ARTIFACTS, "c3b-report-desktop-internal.png"),
    "internal",
    "经营结论",
  );

  await screenshotDesktop(
    page,
    `${BASE}/delivery-reports/share/${PROJECT_ID}`,
    resolve(ARTIFACTS, "c3b-report-desktop-share.png"),
    "share",
    "经营结论",
  );

  const publicPage = await browser.newPage();
  const publicUrl = `${BASE}/delivery-reports/public/${TOKEN}`;
  const publicCheck = await publicPage.goto(publicUrl, { waitUntil: "networkidle", timeout: 60000 });
  if (!publicCheck || publicCheck.status() >= 400) {
    failures.push(`匿名页 HTTP ${publicCheck?.status()}`);
  }
  const invalid = await publicPage.getByText("报告链接无效").isVisible({ timeout: 2000 }).catch(() => false);
  if (invalid) failures.push("匿名 token 无效");

  await screenshotDesktop(
    publicPage,
    publicUrl,
    resolve(ARTIFACTS, "c3b-report-desktop-public.png"),
    "public-desktop",
    "经营结论",
  );

  for (const width of [375, 390, 414]) {
    await screenshotMobile(
      publicPage,
      publicUrl,
      resolve(ARTIFACTS, `c3b-report-mobile-public-${width}.png`),
      width,
    );
  }

  const internalText = await page.locator("body").innerText();
  for (const forbiddenBtn of ["复制客户报告链接", "重新生成客户报告链接", "禁用客户报告链接"]) {
    /* internal should have share buttons */
  }
  const publicText = await publicPage.locator("body").innerText();
  for (const btn of ["复制客户报告链接", "重新生成客户报告链接", "禁用客户报告链接", "内容诊断结果", "优化任务清单"]) {
    if (publicText.includes(btn)) failures.push(`匿名页出现内部操作「${btn}」`);
  }
} catch (e) {
  failures.push(`验收脚本异常: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
}

if (failures.length) {
  console.error("C3-B 视觉验收问题：");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      token: TOKEN.slice(0, 12) + "…",
      tokenValid: true,
      horizontalScroll: metrics.horizontalScroll,
      forbiddenHits: metrics.forbiddenHits,
    },
    null,
    2,
  ),
);
console.log("C3-B 视觉验收通过。");

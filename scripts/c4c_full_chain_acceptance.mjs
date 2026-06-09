/**
 * C4-C 真实项目全链路产品验收（截图 + 静态文案/字段检查）
 * 用法：pnpm dev 后 node scripts/c4c_full_chain_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  WEEKLY_CONTENT_PAGE_LABELS,
  WEEKLY_CONTENT_PAGE_RENDERED_SEGMENT_LABELS,
  WEEKLY_CONTENT_PAGE_WAIT,
} from "./lib/weeklyContentPageLabels.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PROJECT_ID = process.env.PROJECT_ID ?? "72";
const TOKEN =
  process.env.SHARE_TOKEN ?? "MiayMNQ3oPInT8mmsqLw0cLJy1LTCbEeozdYJg-bfqU";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

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

const INTERNAL_BTNS = [
  "复制客户报告链接",
  "重新生成客户报告链接",
  "禁用客户报告链接",
  "本地开发登录",
];

const CHECKS = {
  dashboard: ["AI 品牌经营系统", "持续提升企业在 AI 搜索中的识别、信任与推荐"],
  weekly: [...WEEKLY_CONTENT_PAGE_LABELS, ...WEEKLY_CONTENT_PAGE_RENDERED_SEGMENT_LABELS],
  publish: [
    "AI 搜索资产发布记录",
    "发布资产概览",
    "平台分布",
    "发布记录列表",
    "下一步发布动作",
  ],
  progress: [
    "AI 搜索资产进展",
    "资产进展总览",
    "内容资产漏斗",
    "AI 实测进展",
    "下一轮资产建设重点",
  ],
  report: [
    "经营结论",
    "本轮报告摘要",
    "AI 搜索实测结果",
    "本轮新增 AI 搜索资产",
    "下一轮优化动作",
  ],
  public: ["经营结论", "本轮报告摘要", "查看证据", "查看文章"],
  evidence: ["AI 搜索实测证据", "测试问题", "测试引擎", "测试阶段"],
};

const failures = [];
const results = { projectId: PROJECT_ID, screenshots: [], checks: {} };

function fail(msg) {
  failures.push(msg);
  console.error(`[fail] ${msg}`);
}

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const btn = page.getByRole("button", { name: "本地开发登录" });
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
  if (await page.getByText("登录后继续").isVisible({ timeout: 2000 }).catch(() => false)) {
    fail("本地开发登录失败");
  }
}

async function selectDolphinProject(page) {
  const sel = page.locator("select").filter({ has: page.locator("option") }).first();
  await sel.waitFor({ state: "visible", timeout: 30000 });
  const options = await sel.locator("option").allTextContents();
  const match = options.find(t => t.includes("海豚知道") || t.includes("河南"));
  if (!match) fail(`未找到海豚知道项目，选项: ${options.join(" | ")}`);
  else await sel.selectOption({ label: match });
  await page.waitForTimeout(800);
}

async function assertLabels(page, scope, labels) {
  const text = await page.locator("body").innerText();
  const missing = labels.filter(l => !text.includes(l));
  if (missing.length) fail(`${scope} 缺少: ${missing.join("、")}`);
  results.checks[scope] = { missing, ok: missing.length === 0 };
  return text;
}

async function assertForbidden(text, scope, extraForbidden = []) {
  for (const word of [...FORBIDDEN, ...extraForbidden]) {
    if (text.includes(word)) fail(`${scope} 出现禁止字段「${word}」`);
  }
}

async function assertNoHorizontalScroll(page, scope) {
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      bad: doc.scrollWidth > doc.clientWidth + 2 || body.scrollWidth > body.clientWidth + 2,
      sw: Math.max(doc.scrollWidth, body.scrollWidth),
      cw: doc.clientWidth,
    };
  });
  if (m.bad) fail(`${scope} 横向滚动 ${m.sw}>${m.cw}`);
}

async function shotDesktop(page, url, file, scope, labels, waitText) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 });
  if (waitText) {
    await page
      .getByText(waitText)
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => fail(`${scope} 未出现「${waitText}」`));
  }
  await page.waitForTimeout(900);
  const text = await assertLabels(page, scope, labels);
  await assertForbidden(text, scope);
  await assertNoHorizontalScroll(page, scope);
  const path = resolve(ART, file);
  await page.screenshot({ path, fullPage: true });
  results.screenshots.push(file);
  console.log(`[ok] ${file}`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await devLogin(page);
  await selectDolphinProject(page);

  await shotDesktop(page, "/", "c4c-dashboard.png", "dashboard", CHECKS.dashboard, "工作台");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle", timeout: 60000 });
  await page
    .getByText(WEEKLY_CONTENT_PAGE_WAIT)
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => fail(`weekly 未出现「${WEEKLY_CONTENT_PAGE_WAIT}」`));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  const weeklyText = await assertLabels(page, "weekly", CHECKS.weekly);
  if (!weeklyText.includes("生成内容资产")) {
    console.warn("[warn] weekly 未展示「生成内容资产」按钮（可能暂无任务/选题）");
  }
  await assertForbidden(weeklyText, "weekly");
  await assertNoHorizontalScroll(page, "weekly");
  await page.screenshot({ path: resolve(ART, "c4c-weekly-content.png"), fullPage: true });
  results.screenshots.push("c4c-weekly-content.png");
  console.log("[ok] c4c-weekly-content.png");
  await shotDesktop(
    page,
    "/content-publishing",
    "c4c-publish-records.png",
    "publish",
    CHECKS.publish,
    "发布资产概览",
  );
  await shotDesktop(
    page,
    "/progress",
    "c4c-progress.png",
    "progress",
    CHECKS.progress,
    "资产进展总览",
  );
  await shotDesktop(
    page,
    "/delivery-reports",
    "c4c-report.png",
    "report",
    CHECKS.report,
    "经营结论",
  );

  const publicPage = await browser.newPage();
  const publicUrl = `${BASE}/delivery-reports/public/${TOKEN}`;
  const resp = await publicPage.goto(publicUrl, { waitUntil: "networkidle", timeout: 60000 });
  if (!resp || resp.status() >= 400) fail(`匿名报告 HTTP ${resp?.status()}`);
  if (await publicPage.getByText("报告链接无效").isVisible({ timeout: 2000 }).catch(() => false)) {
    fail("匿名 token 无效");
  }
  await publicPage.setViewportSize({ width: 1440, height: 900 });
  await publicPage.waitForTimeout(800);
  let pubText = await assertLabels(publicPage, "public", CHECKS.public);
  await assertForbidden(pubText, "public");
  for (const btn of INTERNAL_BTNS) {
    if (pubText.includes(btn)) fail(`匿名报告出现内部操作「${btn}」`);
  }
  await assertNoHorizontalScroll(publicPage, "public-desktop");
  await publicPage.screenshot({ path: resolve(ART, "c4c-public-report.png"), fullPage: true });
  results.screenshots.push("c4c-public-report.png");
  console.log("[ok] c4c-public-report.png");

  for (const w of [375, 390, 414]) {
    await publicPage.setViewportSize({ width: w, height: 812 });
    await publicPage.goto(publicUrl, { waitUntil: "networkidle" });
    await publicPage.getByText("经营结论").first().waitFor({ timeout: 30000 });
    await publicPage.waitForTimeout(500);
    pubText = await publicPage.locator("body").innerText();
    await assertForbidden(pubText, `public-${w}`);
    await assertNoHorizontalScroll(publicPage, `public-${w}`);
    const f = `c4c-mobile-public-report-${w}.png`;
    await publicPage.screenshot({ path: resolve(ART, f), fullPage: true });
    results.screenshots.push(f);
    console.log(`[ok] ${f}`);
  }

  let evidenceUrl = `${BASE}/delivery-reports/public/${TOKEN}/evidence/1/0`;
  const evidenceBtn = publicPage.getByRole("button", { name: "查看证据" }).first();
  if (await evidenceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await evidenceBtn.click();
    await publicPage.waitForTimeout(800);
    evidenceUrl = publicPage.url();
  } else {
    await publicPage.getByRole("button", { name: "查看完整证据" }).click().catch(() => {});
    await publicPage.waitForTimeout(400);
    if (await evidenceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await evidenceBtn.click();
      await publicPage.waitForTimeout(800);
      evidenceUrl = publicPage.url();
    }
  }
  const evPage = await browser.newPage();
  await evPage.setViewportSize({ width: 1440, height: 900 });
  await evPage.goto(evidenceUrl, { waitUntil: "networkidle", timeout: 60000 });
  await evPage.waitForTimeout(800);
  const evText = await assertLabels(evPage, "evidence", CHECKS.evidence);
  await assertForbidden(evText, "evidence");
  await assertNoHorizontalScroll(evPage, "evidence");
  await evPage.screenshot({ path: resolve(ART, "c4c-public-evidence.png"), fullPage: true });
  results.screenshots.push("c4c-public-evidence.png");
  console.log("[ok] c4c-public-evidence.png");
  await evPage.close();

  await publicPage.close();
} catch (e) {
  fail(`脚本异常: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
}

writeFileSync(resolve(ART, "c4c-acceptance-summary.json"), JSON.stringify({ failures, results }, null, 2));

if (failures.length) {
  console.error("\nC4-C 验收未通过：");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("\nC4-C 全链路验收通过。");
console.log(JSON.stringify(results, null, 2));

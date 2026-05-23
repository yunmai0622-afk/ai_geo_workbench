/**
 * C3-A-Fix 匿名客户报告页移动端硬验收（375 / 390 / 414）
 * 用法：先启动 pnpm dev，再执行：
 *   SHARE_TOKEN=<token> node scripts/c3a_mobile_public_report_acceptance.mjs
 * 可选：BASE_URL=http://127.0.0.1:3000
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TOKEN = process.env.SHARE_TOKEN ?? "";
const WIDTHS = [375, 390, 414];

if (!TOKEN || TOKEN.length < 16) {
  console.error("缺少 SHARE_TOKEN（长度至少 16）。请从内部页复制客户报告链接中的 token。");
  process.exit(1);
}

const url = `${BASE_URL}/delivery-reports/public/${TOKEN}`;
const forbidden = [
  "articleId",
  "recordId",
  "projectId",
  "publicUrl",
  "复制客户报告链接",
  "重新生成客户报告链接",
  "禁用客户报告链接",
];

const failures = [];

async function checkViewport(page, width) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const hasHorizontalScroll = doc.scrollWidth > doc.clientWidth + 2 || body.scrollWidth > body.clientWidth + 2;
    const text = document.body.innerText ?? "";
    return {
      hasHorizontalScroll,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      hasHero: text.includes("AI 搜索可见度评分"),
      hasAiTest: text.includes("AI 搜索实测结果"),
      hasPublished: text.includes("本轮新增 AI 搜索资产"),
      hasSuggestions: text.includes("下一轮优化动作"),
      hasViewArticle: text.includes("查看文章") || text.includes("本轮暂无发布记录"),
      hasEvidence: text.includes("查看证据") || text.includes("暂无证据"),
    };
  });

  const bodyText = await page.locator("body").innerText();
  for (const word of forbidden) {
    if (bodyText.includes(word)) failures.push(`${width}px：页面出现禁止字段「${word}」`);
  }

  if (metrics.hasHorizontalScroll) {
    failures.push(`${width}px：存在横向滚动（scroll ${metrics.scrollWidth} > client ${metrics.clientWidth}）`);
  }
  for (const [key, label] of [
    ["hasHero", "顶部英雄区"],
    ["hasAiTest", "AI 搜索实测结果"],
    ["hasPublished", "本轮新增 AI 搜索资产"],
    ["hasSuggestions", "下一轮优化动作"],
  ]) {
    if (!metrics[key]) failures.push(`${width}px：缺少${label}`);
  }
  if (!metrics.hasViewArticle) failures.push(`${width}px：缺少查看文章或空状态文案`);
  if (!metrics.hasEvidence) failures.push(`${width}px：缺少查看证据或暂无证据提示`);

  const shotPath = `artifacts/c3a-mobile-public-${width}.png`;
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`[ok] ${width}px 截图：${shotPath}`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  for (const width of WIDTHS) {
    await checkViewport(page, width);
  }
} catch (error) {
  failures.push(`浏览器验收失败：${error instanceof Error ? error.message : String(error)}`);
} finally {
  await browser?.close();
}

if (failures.length > 0) {
  console.error("C3-A-Fix 移动端验收失败：");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("C3-A-Fix 移动端验收通过：375 / 390 / 414 无横向滚动，五区块与按钮可见。");

/**
 * C7-C 多平台发布真实验收记录（需已登录各平台 + 插件 v1.2.0 + 绑定账号）
 * 用法：pnpm dev 后 node scripts/c7c_platform_publish_acceptance.mjs
 * 输出：artifacts/c7c-publish-*.json 与 artifacts/c7c-*-result.png
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

const PLATFORMS = [
  { slug: "zhihu", url: "https://zhuanlan.zhihu.com/write", json: "c7c-publish-zhihu.json", shot: "c7c-zhihu-result.png" },
  {
    slug: "baijiahao",
    url: "https://baijiahao.baidu.com/builder/rc/edit?type=news",
    json: "c7c-publish-baijiahao.json",
    shot: "c7c-baijiahao-result.png",
  },
  {
    slug: "toutiao",
    url: "https://mp.toutiao.com/profile_v4/graphic/publish",
    json: "c7c-publish-toutiao.json",
    shot: "c7c-toutiao-result.png",
  },
  { slug: "sohu", url: "https://mp.sohu.com/mpfe/v3/submit", json: "c7c-publish-sohu.json", shot: "c7c-sohu-result.png" },
];

function detectPageState(page) {
  const url = page.url();
  if (/passport|login|signin|auth/i.test(url)) {
    return { errorType: "login_required", step: "detect_account", finalStatus: "blocked" };
  }
  return null;
}

async function probePlatform(browser, platform) {
  const page = await browser.newPage();
  const record = {
    platform: platform.slug,
    taskId: null,
    projectId: null,
    projectName: null,
    expectedAccountName: null,
    detectedAccountName: null,
    accountVerificationStatus: null,
    openedPublishPage: false,
    filledTitle: false,
    filledContent: false,
    uploadedCover: false,
    publishSuccess: false,
    draftSaved: false,
    finalStatus: "manual_required",
    failureStep: null,
    errorType: null,
    errorMessage: "需在已登录浏览器 + 插件环境完成端到端发布验收",
    probedAt: new Date().toISOString(),
    probeUrl: platform.url,
  };

  try {
    await page.goto(platform.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    record.openedPublishPage = true;
    const blocked = detectPageState(page);
    if (blocked) {
      Object.assign(record, blocked);
      record.errorMessage = "未登录或登录失效，需人工登录后重测";
    } else {
      const hasTitle = await page
        .locator('textarea[placeholder*="标题"], input[placeholder*="标题"], .public-DraftEditor-content')
        .first()
        .isVisible()
        .catch(() => false);
      const hasEditor = await page
        .locator('.public-DraftEditor-content, .ProseMirror, [contenteditable="true"], .ql-editor')
        .first()
        .isVisible()
        .catch(() => false);
      record.filledTitle = false;
      record.filledContent = false;
      if (!hasTitle && !hasEditor) {
        record.errorType = "editor_not_found";
        record.failureStep = "wait_editor_ready";
        record.errorMessage = "探测页未找到标题/正文编辑器（可能需插件 content script 填充）";
        record.finalStatus = "failed";
      } else {
        record.errorType = null;
        record.errorMessage = "页面可访问；完整自动发布请使用插件任务验收";
        record.finalStatus = "probe_ok";
      }
    }
    await page.screenshot({ path: resolve(ART, platform.shot), fullPage: true });
  } catch (e) {
    record.errorType = "timeout";
    record.failureStep = "open_publish_page";
    record.errorMessage = e instanceof Error ? e.message : String(e);
    record.finalStatus = "failed";
  } finally {
    await page.close();
  }

  writeFileSync(resolve(ART, platform.json), JSON.stringify(record, null, 2), "utf-8");
  console.log(`[ok] ${platform.json} status=${record.finalStatus} errorType=${record.errorType ?? "-"}`);
}

const browser = await chromium.launch({ headless: true });
for (const p of PLATFORMS) {
  await probePlatform(browser, p);
}
await browser.close();
console.log("C7-C 探测验收完成（完整发布需插件 + 已登录会话）。");

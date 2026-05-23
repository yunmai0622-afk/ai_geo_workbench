/**
 * C7-C-Verify 多平台发布真实环境验收
 *
 * 推荐（已登录 Chrome）：
 *   PLAYWRIGHT_USER_DATA_DIR="$HOME/Library/Application Support/Google/Chrome" \
 *   PLAYWRIGHT_PROFILE="Default" \
 *   node scripts/c7c_verify_publish_real.mjs
 *
 * 无登录态时仅探测（login_required）：
 *   node scripts/c7c_verify_publish_real.mjs
 *
 * 可选：读取最近发布任务（需 pnpm dev + VERIFY_API_KEY）
 *   VERIFY_API_KEY=xxx BASE_URL=http://127.0.0.1:3000 node scripts/c7c_verify_publish_real.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

const PLATFORMS = [
  { platform: "zhihu", publishUrl: "https://zhuanlan.zhihu.com/write" },
  {
    platform: "baijiahao",
    publishUrl: "https://baijiahao.baidu.com/builder/rc/edit?type=news",
  },
  { platform: "toutiao", publishUrl: "https://mp.toutiao.com/profile_v4/graphic/publish" },
  { platform: "sohu", publishUrl: "https://mp.sohu.com/mpfe/v3/submit" },
];

function baseRecord(platform) {
  return {
    phase: "C7-C-Verify",
    pluginVersionExpected: "1.2.0",
    projectId: process.env.VERIFY_PROJECT_ID ? Number(process.env.VERIFY_PROJECT_ID) : null,
    projectName: process.env.VERIFY_PROJECT_NAME ?? null,
    platform: platform.platform,
    taskId: null,
    expectedAccountName: process.env[`VERIFY_EXPECTED_${platform.platform.toUpperCase()}`] ?? null,
    detectedAccountName: null,
    accountVerificationStatus: null,
    openedPublishPage: false,
    accountDetected: false,
    accountVerified: false,
    filledTitle: false,
    filledContent: false,
    uploadedCover: false,
    submittedPublishOrDraft: false,
    finalStatus: "failed",
    failureStep: null,
    errorType: null,
    errorMessage: null,
    captchaOrSecurityVerify: false,
    blockingDialog: false,
    verifiedAt: new Date().toISOString(),
    publishUrl: platform.publishUrl,
    note: null,
  };
}

function detectLogin(url, bodyText) {
  if (/passport|login|signin|auth|sso/i.test(url)) return true;
  if (/请登录|立即登录|扫码登录/.test(bodyText) && /登录|密码/.test(bodyText)) return true;
  return false;
}

function detectCaptcha(bodyText) {
  return /验证码|安全验证|人机验证|滑块验证|图形验证/.test(bodyText);
}

async function probeEditors(page) {
  const titleSel =
    'textarea[placeholder*="标题"], input[placeholder*="标题"], .title-wrapper textarea';
  const editorSel =
    '.public-DraftEditor-content, .ProseMirror, [contenteditable="true"], .ql-editor';
  const hasTitle = await page.locator(titleSel).first().isVisible().catch(() => false);
  const hasEditor = await page.locator(editorSel).first().isVisible().catch(() => false);
  return { hasTitle, hasEditor };
}

async function tryDetectAccountName(page, platform) {
  const selectors = {
    zhihu: ['[data-za-detail-view-element_name="User"]', 'a[href*="/people/"]'],
    baijiahao: [".user-name", '[class*="userName"]'],
    toutiao: [".user-name", '[class*="username"]'],
    sohu: [".user-name", '[class*="nickname"]'],
  };
  for (const sel of selectors[platform] ?? []) {
    const text = await page.locator(sel).first().textContent().catch(() => null);
    const t = text?.trim();
    if (t && t.length >= 2 && t.length <= 60 && !/登录|注册/.test(t)) return t;
  }
  return null;
}

async function fetchLatestTask(platform) {
  const apiKey = process.env.VERIFY_API_KEY;
  const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
  if (!apiKey) return null;
  try {
    const input = encodeURIComponent(JSON.stringify({ json: { apiKey } }));
    const res = await fetch(`${base.replace(/\/$/, "")}/api/trpc/publishTasks.pending?input=${input}`);
    const data = await res.json();
    const tasks = data?.result?.data?.json?.tasks ?? [];
    return tasks.find(t => t.platform === platform) ?? null;
  } catch {
    return null;
  }
}

async function launchBrowser() {
  const userDataDir = process.env.PLAYWRIGHT_USER_DATA_DIR;
  const profile = process.env.PLAYWRIGHT_PROFILE ?? "Default";
  if (userDataDir && existsSync(userDataDir)) {
    console.log(`[verify] 使用 Chrome 用户数据目录: ${userDataDir} profile=${profile}`);
    return chromium.launchPersistentContext(resolve(userDataDir, profile), {
      headless: false,
      channel: "chrome",
      args: ["--disable-blink-features=AutomationControlled"],
    });
  }
  console.log("[verify] 未设置 PLAYWRIGHT_USER_DATA_DIR，使用无登录态 Chromium");
  const browser = await chromium.launch({ headless: true });
  return {
    newPage: () => browser.newPage(),
    close: () => browser.close(),
  };
}

const fixLog = [];

async function verifyPlatform(context, platform) {
  const record = baseRecord(platform);
  const page = await context.newPage();

  const pending = await fetchLatestTask(platform.platform);
  if (pending) {
    record.taskId = pending.id;
    record.projectId = pending.projectId ?? record.projectId;
    record.projectName = pending.projectName ?? record.projectName;
    record.expectedAccountName = pending.expectedAccountName ?? record.expectedAccountName;
  }

  try {
    await page.goto(platform.publishUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(4000);
    record.openedPublishPage = true;

    const url = page.url();
    const bodyText = await page.locator("body").innerText().catch(() => "");

    if (detectCaptcha(bodyText)) {
      record.captchaOrSecurityVerify = true;
      record.errorType = "captcha_or_verify";
      record.failureStep = "detect_account";
      record.errorMessage = "检测到验证码或安全验证，需人工完成后重测";
      record.finalStatus = "failed";
    } else if (detectLogin(url, bodyText)) {
      record.errorType = "login_required";
      record.failureStep = "detect_account";
      record.errorMessage = "未登录或登录失效";
      record.finalStatus = "failed";
    } else {
      const detected = await tryDetectAccountName(page, platform.platform);
      if (detected) {
        record.detectedAccountName = detected;
        record.accountDetected = true;
        if (record.expectedAccountName) {
          record.accountVerified = detected.includes(record.expectedAccountName) ||
            record.expectedAccountName.includes(detected);
          record.accountVerificationStatus = record.accountVerified ? "matched" : "mismatched";
        } else {
          record.accountVerificationStatus = "unknown";
        }
      }

      const { hasTitle, hasEditor } = await probeEditors(page);
      if (!hasTitle && !hasEditor) {
        record.errorType = "editor_not_found";
        record.failureStep = "wait_editor_ready";
        record.errorMessage = "未找到标题或正文编辑器";
        record.finalStatus = "failed";
        fixLog.push({
          platform: platform.platform,
          step: "wait_editor_ready",
          action: "需在用插件执行发布任务后根据控制台 selector 日志最小修复适配器",
        });
      } else {
        record.note =
          "页面已登录且编辑器可见；完整 published/draft_saved 需通过 GEO 系统创建发布任务并由插件 v1.2.0 执行后查看任务状态";
        record.finalStatus = "probe_editor_ok";
        record.errorType = null;
        record.errorMessage = null;
      }
    }

    const shot = resolve(ART, `c7c-verify-${platform.platform}-result.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const jsonPath = resolve(ART, `c7c-verify-${platform.platform}.json`);
    writeFileSync(jsonPath, JSON.stringify(record, null, 2), "utf-8");
    console.log(
      `[ok] c7c-verify-${platform.platform}.json finalStatus=${record.finalStatus} errorType=${record.errorType ?? "-"}`,
    );
  } catch (e) {
    record.errorType = "timeout";
    record.failureStep = "open_publish_page";
    record.errorMessage = e instanceof Error ? e.message : String(e);
    record.finalStatus = "failed";
    writeFileSync(
      resolve(ART, `c7c-verify-${platform.platform}.json`),
      JSON.stringify(record, null, 2),
      "utf-8",
    );
  } finally {
    await page.close();
  }

  return record;
}

const manifestPath = resolve(process.cwd(), "content-growth-publish-extension/manifest.json");
let pluginVersion = "unknown";
if (existsSync(manifestPath)) {
  try {
    pluginVersion = JSON.parse(readFileSync(manifestPath, "utf-8")).version;
  } catch {
    /* ignore */
  }
}

const context = await launchBrowser();
const summary = { pluginVersion, platforms: [] };
for (const p of PLATFORMS) {
  summary.platforms.push(await verifyPlatform(context, p));
}
await context.close();

writeFileSync(resolve(ART, "c7c-verify-summary.json"), JSON.stringify(summary, null, 2), "utf-8");
if (fixLog.length) {
  writeFileSync(resolve(ART, "c7c-verify-fix-log.json"), JSON.stringify(fixLog, null, 2), "utf-8");
}
console.log("C7-C-Verify 完成。若需 published/draft_saved，请在已登录 Chrome + 插件 v1.2.0 下从内容资产页发起发布。");

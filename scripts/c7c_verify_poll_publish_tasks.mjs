/**
 * C7-C-Verify 第四步：轮询发布任务最终状态（插件执行后运行）
 *
 * 前置：pnpm dev、插件 v1.2.0 已重载、已在内容资产页对四平台各提交一次发布
 *
 * VERIFY_API_KEY=你的extensionApiKey \
 * BASE_URL=http://127.0.0.1:3000 \
 * VERIFY_ARTICLE_ID=文章ID \
 * VERIFY_PROJECT_ID=项目ID \
 * node scripts/c7c_verify_poll_publish_tasks.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

const apiKey = process.env.VERIFY_API_KEY;
const base = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const articleId = Number(process.env.VERIFY_ARTICLE_ID);
const projectId = Number(process.env.VERIFY_PROJECT_ID);
const platforms = ["zhihu", "baijiahao", "toutiao", "sohu"];

if (!apiKey || !articleId || !projectId) {
  console.error("需要 VERIFY_API_KEY、VERIFY_ARTICLE_ID、VERIFY_PROJECT_ID");
  process.exit(1);
}

async function fetchLatestTasks() {
  const input = encodeURIComponent(JSON.stringify({ json: { articleId, projectId } }));
  const url = `${base}/api/trpc/publishTasks.latestByArticle?input=${input}`;
  const res = await fetch(url, { headers: { cookie: process.env.VERIFY_COOKIE ?? "" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.result?.data?.json?.tasks ?? [];
}

function mapTaskToVerifyRecord(task) {
  const status = task.status;
  const passed = status === "completed" || status === "draft_saved";
  return {
    phase: "C7-C-Verify-E2E",
    pluginVersion: "1.2.0",
    projectId,
    projectName: null,
    platform: task.platform,
    taskId: task.id,
    expectedAccountName: task.expectedAccountName ?? null,
    detectedAccountName: task.detectedAccountName ?? null,
    accountVerificationStatus: task.accountVerificationStatus ?? null,
    openedPublishPage: null,
    accountDetected: Boolean(task.detectedAccountName),
    accountVerified: task.accountVerificationStatus === "matched",
    filledTitle: null,
    filledContent: null,
    uploadedCover: null,
    submittedPublishOrDraft: passed,
    finalStatus: status === "completed" ? "published" : status === "draft_saved" ? "draft_saved" : "failed",
    failureStep: null,
    errorType: passed ? null : "submit_failed",
    errorMessage: task.errorMessage ?? null,
    resultUrl: task.resultUrl ?? null,
    captchaOrSecurityVerify: /captcha|验证码|安全验证/i.test(task.errorMessage ?? ""),
    verifiedAt: new Date().toISOString(),
    note: "来自 publish_tasks 表回写；填标题/正文/封面需对照插件控制台 step 日志",
  };
}

const tasks = await fetchLatestTasks();
const byPlatform = {};
for (const p of platforms) {
  const latest = tasks.filter(t => t.platform === p).sort((a, b) => b.id - a.id)[0];
  if (!latest) {
    byPlatform[p] = { platform: p, finalStatus: "no_task", note: "未找到该平台的发布任务" };
    continue;
  }
  const record = mapTaskToVerifyRecord(latest);
  writeFileSync(resolve(ART, `c7c-verify-${p}.json`), JSON.stringify(record, null, 2));
  byPlatform[p] = record;
  console.log(`[${p}] taskId=${latest.id} status=${latest.status} verification=${latest.accountVerificationStatus}`);
}

const allPass = platforms.every(p => {
  const s = byPlatform[p]?.finalStatus;
  return s === "published" || s === "draft_saved";
});

writeFileSync(
  resolve(ART, "c7c-verify-summary.json"),
  JSON.stringify({ pluginVersion: "1.2.0", allPass, platforms: byPlatform }, null, 2),
);
console.log(allPass ? "结论：四平台均有 published 或 draft_saved" : "结论：尚未全部通过，见各平台 JSON");

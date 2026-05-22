/**
 * C1-F 浏览器 UI 路径验收（Playwright）
 * - 默认只做 UI 路径，不等真实 AI 完成（API 链路见 C1-E）
 * - C1F_TRIGGER_AI=1 时仅验证点击能触发请求，最多等 60 秒
 */
import { chromium } from "playwright";

const BASE = process.env.C1F_BASE_URL ?? "http://localhost:3000";
const PROJECT_NAME = "河南海豚知道文化传媒有限公司";
const TRIGGER_WAIT_MS = Number(process.env.C1F_TRIGGER_WAIT_MS ?? "60000");
const FORBIDDEN = [
  "before_publish",
  "after_publish",
  "manual_check",
  "testStage",
  "rawAnswer",
  "taskId",
  "provider",
  "adapter",
  "mock",
  "schema",
  "aiTestResults",
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const loginBtn = page.getByRole("button", { name: "本地开发登录" });
  if (await loginBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
  }
  const stillLogin = await page.getByText("登录后继续").isVisible({ timeout: 2000 }).catch(() => false);
  assert(!stillLogin, "本地开发登录未成功，仍停留在登录页");
}

async function selectProject(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const sel = page.locator("select").filter({ has: page.locator("option") }).first();
  await sel.waitFor({ state: "visible", timeout: 30000 });
  const options = await sel.locator("option").allTextContents();
  const match = options.find(t => t.includes("海豚知道") || t.includes("河南"));
  assert(match, `项目下拉中未找到目标项目，选项: ${options.join(" | ")}`);
  await sel.selectOption({ label: match });
  await page.waitForTimeout(500);
}

async function assertNoForbidden(page, scope = "页面") {
  const text = await page.locator("body").innerText();
  for (const word of FORBIDDEN) {
    assert(!text.includes(word), `${scope} 暴露工程字段: ${word}`);
  }
}

/** 点击「立即实测」，最多等 TRIGGER_WAIT_MS；不等待 AI 全部完成 */
async function triggerRunCheck(page, recordEl, stageLabel) {
  const stageSelect = recordEl.locator("select").first();
  await stageSelect.selectOption({ label: stageLabel });

  const mutationPromise = page.waitForResponse(
    res => res.url().includes("/api/trpc") && res.url().includes("aiMentionCheck.run"),
    { timeout: TRIGGER_WAIT_MS },
  );

  const runBtn = recordEl.getByRole("button", { name: /立即实测/ });
  await runBtn.click();

  let loadingSeen = false;
  try {
    await recordEl.getByRole("button", { name: "实测中…" }).waitFor({ timeout: 8000 });
    loadingSeen = true;
  } catch {
    /* 可能极快返回 */
  }

  let requestTriggered = false;
  try {
    const resp = await mutationPromise;
    requestTriggered = resp.status() < 500;
  } catch {
    requestTriggered = loadingSeen;
  }

  const completed = await recordEl
    .getByRole("button", { name: "立即实测" })
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  const note =
    completed && requestTriggered
      ? "请求已触发且按钮已恢复（可能已完成）"
      : "真实 AI 调用耗时较长，浏览器 UI 触发成功，但未等待完成";

  return { requestTriggered, loadingSeen, completedWithinCap: completed, note };
}

async function main() {
  const report = {
    baseUrl: BASE,
    projectName: PROJECT_NAME,
    monitoringRecordId: null,
    uiPathPass: false,
    apiPathNote: "C1-E 已通过 tRPC 真实 API；本轮浏览器不等 AI 完成",
    steps: {},
    stuckCause:
      "此前 C1F_RUN_AI=1 时 Playwright 等待「立即实测」恢复或 Toast 最长 600s；真实 AI（豆包+DeepSeek+Kimi×5 题）单次常需 7–15 分钟，导致长时间 loading 与进程挂起。",
    forbiddenExposed: [],
    codeFixApplied: true,
  };

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.C1F_CHROME_CHANNEL ?? "chrome",
  }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await devLogin(page);
    report.steps.login = "ok";

    await page.goto(`${BASE}/inclusion-monitoring`, { waitUntil: "networkidle" });
    await page.getByText("收录监测", { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
    await selectProject(page);
    await assertNoForbidden(page, "收录监测");

    await page.waitForSelector("#monitoring-record-1, [id^='monitoring-record-']", { timeout: 20000 });
    const recordEl =
      (await page.locator("#monitoring-record-1").count()) > 0
        ? page.locator("#monitoring-record-1")
        : page.locator("[id^='monitoring-record-']").first();
    report.monitoringRecordId =
      (await recordEl.getAttribute("id"))?.replace("monitoring-record-", "") ?? "unknown";

    assert(await recordEl.locator("label", { hasText: "测试阶段" }).isVisible(), "无测试阶段");
    const stageSelect = recordEl.locator("select").first();
    report.steps.testStageDefault =
      (await stageSelect.inputValue()) === "manual_check" ? "人工复测" : await stageSelect.inputValue();

    for (const label of ["发布前测试", "发布后复测", "人工复测"]) {
      await stageSelect.selectOption({ label });
    }
    report.steps.testStageSelect = "ok";

    const detailCount = await recordEl.getByRole("button", { name: "查看证据" }).count();
    report.steps.existingEvidenceLinks = detailCount;

    if (process.env.C1F_TRIGGER_AI === "1") {
      const t1 = await triggerRunCheck(page, recordEl, "发布前测试");
      report.steps.triggerBeforePublish = t1;
      assert(t1.requestTriggered || t1.loadingSeen, "发布前测试：未观察到 loading 或 trpc 请求");
    } else {
      report.steps.triggerBeforePublish = "skipped(仅 UI 路径)";
    }

    const pageErrors = [];
    page.on("pageerror", err => pageErrors.push(String(err.message)));
    report.steps.pageErrors = pageErrors;

    await page.goto(`${BASE}/delivery-reports`, { waitUntil: "networkidle" });
    await selectProject(page);
    await assertNoForbidden(page, "交付报告");
    await page.getByRole("heading", { name: "AI 搜索实测结果" }).waitFor();
    await page.getByText("发布前后复测对比").waitFor();
    const table = page.locator("table").filter({ hasText: "发布前" });
    assert((await table.count()) > 0, "对比表未展示");
    report.steps.deliveryCompareTable = true;

    await page.getByRole("button", { name: "查看证据" }).first().click();
    await page.waitForURL(/\/geo\/evidence\//, { timeout: 15000 });
    await assertNoForbidden(page, "证据详情");
    report.steps.evidenceFromReport = "ok";

    report.uiPathPass = true;
    report.success = true;
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    report.success = false;
    report.error = String(e?.message ?? e);
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();

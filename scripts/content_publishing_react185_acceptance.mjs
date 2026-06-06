#!/usr/bin/env node
/**
 * GEO-V1.1 content publishing React #185 runtime acceptance
 * 用法：pnpm dev 后 node scripts/content_publishing_react185_acceptance.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PROJECT_ID = Number(process.env.PUBLISH_ACCEPT_PROJECT_ID ?? "72");
const REACT_185 = /Minified React error #185|Maximum update depth exceeded/i;
const ERROR_BOUNDARY = /页面遇到了意外问题|publish-center-render-fallback/;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function trpcJson(payload) {
  return JSON.stringify([{ result: { data: { json: payload } } }]);
}

async function devLogin(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  const btn = page.getByRole("button", { name: "本地开发登录" });
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}

function installPublishMocks(page) {
  const zhihuAccountGroup = {
    platform: "zhihu",
    accounts: [
      {
        id: 901,
        accountName: "验收知乎账号",
        isEnabled: true,
        localProfileId: "profile-zhihu-1",
        sessionStatus: "expired",
        lastLoginAt: null,
      },
    ],
  };

  const handlers = [
    {
      match: /geo\.projects\.list/,
      body: trpcJson([{ id: PROJECT_ID, enterpriseName: "React185验收企业" }]),
    },
    {
      match: /geo\.platformAccounts\.list/,
      body: trpcJson({ accounts: [zhihuAccountGroup] }),
    },
    {
      match: /publishTasks\.listRecentByProject/,
      body: trpcJson({ tasks: [] }),
    },
    {
      match: /geo\.publishRecords\.listWithStatus/,
      body: trpcJson([]),
    },
    {
      match: /geo\.articles\.list/,
      body: trpcJson([]),
    },
    {
      match: /geo\.articles\.latestQualityScores/,
      body: trpcJson([]),
    },
    {
      match: /geo\.articles\.retestQueue/,
      body: trpcJson({ items: [] }),
    },
    {
      match: /geo\.articles\.rewritePool/,
      body: trpcJson({ items: [] }),
    },
    {
      match: /geo\.articles\.inclusionMonitoringRecords/,
      body: trpcJson([]),
    },
    {
      match: /publishTasks\.projectStats/,
      body: trpcJson({ platformSuccessRates: [] }),
    },
    {
      match: /geo\.workspace\.summary/,
      body: trpcJson({
        boundPublishAccountCount: 1,
        articleCount: 0,
        publishRecordCount: 0,
        aiTestResultCount: 0,
        geoScore: null,
        brandMentionRate: null,
      }),
    },
  ];

  return page.route("**/api/trpc/**", async route => {
    const url = route.request().url();
    const hit = handlers.find(h => h.match.test(url));
    if (!hit) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: hit.body,
    });
  });
}

async function main() {
  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", err => pageErrors.push(err.message));

  try {
    await devLogin(page);
    await installPublishMocks(page);

    await page.goto(`${BASE}/content-publishing?projectId=${PROJECT_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.getByText("平台适配发布").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(10000);

    const bodyText = await page.locator("body").innerText();
    const allErrors = [...consoleErrors, ...pageErrors];

    assert(!allErrors.some(e => REACT_185.test(e)), `检测到 React #185: ${allErrors.join(" | ")}`);
    assert(!ERROR_BOUNDARY.test(bodyText), "页面进入错误边界");
    assert(bodyText.includes("平台适配发布"), "页面标题丢失");

    const checkBtn = page.getByTestId("publish-ready-refresh");
    await checkBtn.click();
    await page.waitForTimeout(3000);
    const afterCheckText = await page.locator("body").innerText();
    assert(afterCheckText.includes("平台适配发布"), "点击检测本地客户端后白屏");
    assert(!ERROR_BOUNDARY.test(afterCheckText), "点击检测本地客户端后进入错误边界");

    const refreshAccountBtn = page.getByTestId("local-agent-status-primary-action");
    if (await refreshAccountBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await refreshAccountBtn.click();
      await page.waitForTimeout(3000);
      const afterRefreshText = await page.locator("body").innerText();
      assert(afterRefreshText.includes("平台适配发布"), "点击刷新账号状态后白屏");
      assert(!ERROR_BOUNDARY.test(afterRefreshText), "点击刷新账号状态后进入错误边界");
    }

    const finalErrors = [...consoleErrors, ...pageErrors];
    assert(!finalErrors.some(e => REACT_185.test(e)), `交互后检测到 React #185: ${finalErrors.join(" | ")}`);

    console.log("[OK] content_publishing_react185_acceptance passed");
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("[FAIL] content_publishing_react185_acceptance:", err.message);
  process.exit(1);
});

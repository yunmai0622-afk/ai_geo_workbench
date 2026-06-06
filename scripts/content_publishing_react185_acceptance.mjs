#!/usr/bin/env node
/**
 * GEO-V1.1 content publishing React #185 runtime acceptance
 * 用法：pnpm dev 后 node scripts/content_publishing_react185_acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PROJECT_ID = Number(process.env.PUBLISH_ACCEPT_PROJECT_ID ?? "72");
const USE_MOCK = process.env.PUBLISH_ACCEPT_USE_MOCK !== "0";
const ART = resolve(process.cwd(), "artifacts");
mkdirSync(ART, { recursive: true });

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
    const responsePromise = page
      .waitForResponse(res => res.url().includes("auth.devLogin") && res.status() < 500, {
        timeout: 15000,
      })
      .catch(() => null);
    await btn.click();
    await responsePromise;
    await page.waitForTimeout(2000);
  }
  const stillLogin = await page.getByText("登录后继续").isVisible({ timeout: 2000 }).catch(() => false);
  assert(!stillLogin, "本地开发登录未成功，仍停留在登录页");
}

function trpcResult(payload) {
  return { result: { data: { json: payload } } };
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

  const projectRow = { id: PROJECT_ID, enterpriseName: "React185验收企业" };
  const handlers = [
    {
      match: /auth\.me/,
      payload: { id: 1, name: "dev", role: "user", openId: "dev-open-id", email: "dev@local" },
    },
    { match: /auth\.devLogin/, payload: { ok: true } },
    { match: /geo\.projects\.list/, payload: [projectRow] },
    {
      match: /geo\.clientDashboard\.listProjectsSummary/,
      payload: [
        {
          id: PROJECT_ID,
          enterpriseName: "React185验收企业",
          industry: "文化传媒",
          website: "https://example.com",
          region: "中国",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          articleCount: 0,
          publishCount: 0,
          aiTestCount: 0,
          lastDiagnosisAt: null,
          lastMeasuredAt: null,
          latestGeoScore: null,
          t0BrandMentionRate: null,
          archivedAt: null,
        },
      ],
    },
    { match: /geo\.subscription\.usage/, payload: { atLimit: { project: false } } },
    { match: /geo\.platformAccounts\.list/, payload: { accounts: [zhihuAccountGroup] } },
    { match: /publishTasks\.listRecentByProject/, payload: { tasks: [] } },
    { match: /geo\.publishRecords\.listWithStatus/, payload: [] },
    { match: /geo\.articles\.list/, payload: [] },
    { match: /geo\.articles\.latestQualityScores/, payload: [] },
    { match: /geo\.articles\.retestQueue/, payload: { items: [] } },
    { match: /geo\.articles\.rewritePool/, payload: { items: [] } },
    { match: /geo\.articles\.inclusionMonitoringRecords/, payload: [] },
    { match: /publishTasks\.projectStats/, payload: { platformSuccessRates: [] } },
    {
      match: /geo\.workspace\.summary/,
      payload: {
        boundPublishAccountCount: 1,
        articleCount: 0,
        publishRecordCount: 0,
        aiTestResultCount: 0,
        geoScore: null,
        brandMentionRate: null,
      },
    },
    { match: /geo\.growthSuggestions/, payload: { suggestions: [] } },
    {
      match: /geo\.assetLibrary\.summary/,
      payload: { profile: { brandName: "React185验收企业" } },
    },
  ];

  return page.route("**/api/trpc/**", async route => {
    const url = route.request().url();
    const pathMatch = url.match(/\/api\/trpc\/([^?]+)/);
    const procedures = pathMatch ? decodeURIComponent(pathMatch[1]).split(",") : [];
    const results = procedures.map(proc => {
      const hit = handlers.find(h => h.match.test(proc));
      return trpcResult(hit ? hit.payload : null);
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results.length > 0 ? results : [trpcResult(null)]),
    });
  });
}

async function dismissIntroModal(page) {
  const startBtn = page.getByTestId("geo-intro-modal-start");
  if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startBtn.click({ force: true });
    await page.waitForTimeout(600);
  }
}

async function openPublishPage(page, projectId = PROJECT_ID) {
  await page.goto(`${BASE}/workspace?projectId=${projectId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await dismissIntroModal(page);
  await page.waitForTimeout(2000);

  const navItem = page.getByText("平台适配发布", { exact: true });
  if (await navItem.isVisible({ timeout: 8000 }).catch(() => false)) {
    await navItem.click();
  } else {
    await page.goto(`${BASE}/content-publishing?projectId=${projectId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  }
  await dismissIntroModal(page);
  await page.waitForTimeout(1500);

  await page
    .getByTestId("publish-center-page")
    .or(page.getByText("平台适配发布"))
    .first()
    .waitFor({ state: "visible", timeout: 45000 });
}

async function resolveProjectId(page) {
  if (USE_MOCK) return PROJECT_ID;
  const url = page.url();
  const fromUrl = url.match(/projectId=(\d+)/);
  if (fromUrl) return Number(fromUrl[1]);
  return PROJECT_ID;
}

async function main() {
  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", err => pageErrors.push(err.message));

  try {
    await page.addInitScript(id => {
      sessionStorage.setItem("activeProjectId", String(id));
      localStorage.setItem("geo-v1.1-intro-modal:seen", "1");
    }, PROJECT_ID);
    if (USE_MOCK) {
      await installPublishMocks(page);
    } else {
      await devLogin(page);
    }

    await openPublishPage(page, PROJECT_ID);
    await page.waitForTimeout(10000);

    const bodyText = await page.locator("body").innerText();
    const allErrors = [...consoleErrors, ...pageErrors];

    assert(!allErrors.some(e => REACT_185.test(e)), `检测到 React #185: ${allErrors.join(" | ")}`);
    assert(!bodyText.includes("页面遇到了意外问题"), "页面进入全局错误边界");
    assert(bodyText.includes("平台适配发布"), "页面标题丢失");

    const checkBtn = page.getByTestId("publish-ready-refresh");
    if (await checkBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkBtn.click();
      await page.waitForTimeout(3000);
      const afterCheckText = await page.locator("body").innerText();
      assert(afterCheckText.includes("平台适配发布"), "点击检测本地客户端后白屏");
      assert(!ERROR_BOUNDARY.test(afterCheckText), "点击检测本地客户端后进入错误边界");
    }

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

    const report = {
      projectId: await resolveProjectId(page),
      usedMock: USE_MOCK,
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      passedAt: new Date().toISOString(),
    };
    writeFileSync(resolve(ART, "content-publishing-react185-acceptance.json"), JSON.stringify(report, null, 2));
    console.log("[OK] content_publishing_react185_acceptance passed", report);
  } catch (err) {
    await page.screenshot({ path: resolve(ART, "content-publishing-react185-failure.png"), fullPage: true });
    if (consoleErrors.length > 0) {
      console.error("[console.error]", consoleErrors.slice(0, 10).join("\n"));
    }
    if (pageErrors.length > 0) {
      console.error("[pageerror]", pageErrors.slice(0, 10).join("\n"));
    }
    console.error("[debug] url=", page.url());
    console.error("[debug] body=", (await page.locator("body").innerText()).slice(0, 800));
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("[FAIL] content_publishing_react185_acceptance:", err.message);
  process.exit(1);
});

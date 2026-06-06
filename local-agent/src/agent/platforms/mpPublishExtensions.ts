import fs from "fs";
import os from "os";
import path from "path";
import type { Page } from "playwright";
import { getAccountByProfileId } from "../storage";
import { getOrLaunchContext } from "./browserSession";
import {
  accountNamesMatch,
  fillFirstSelector,
  isLoginUrl,
  isPendingPublishAccountName,
  shouldBlockPublishForAccountNameMismatch,
  stepLog,
  type BasePlatformPublisher,
  type LocalPublishResult,
  type LocalPublishTask,
  type PublishStepLog,
} from "./basePublisher";

export type MpPublishSubStep = {
  step: string;
  status: PublishStepLog["status"];
  message?: string;
};

export function formatMpSelectorMiss(
  platformTag: string,
  fieldLabel: "标题" | "正文",
  selectors: string[],
): string {
  const preview = selectors.slice(0, 6).join(" | ");
  const suffix = selectors.length > 6 ? ` 等共 ${selectors.length} 个` : "";
  return `[${platformTag}] 未找到${fieldLabel}输入（已尝试：${preview}${suffix}）`;
}

export type MpPublishArticleConfig = {
  platformTag: string;
  publishButtonPattern: RegExp;
  publishButtonSkip?: RegExp;
  toolbarSelectorHints?: string[];
  confirmDialogText?: RegExp;
  confirmButtonPattern?: RegExp;
  successTextPattern: RegExp;
  publishErrorPattern: RegExp;
  extractPublicUrl: (url: string) => string | null;
  skipCover?: boolean;
  /** 点击打开封面上传面板的按钮/文案匹配 */
  coverTriggerPattern?: RegExp;
  coverFileInputSelectors?: string[];
  softWritePageWarnings?: boolean;
  fillContent?: (
    page: Page,
    content: string,
    selectors: string[],
  ) => Promise<{ ok: boolean; selector?: string }>;
  fillTitle?: (
    page: Page,
    title: string,
    selectors: string[],
  ) => Promise<{ ok: boolean; selector?: string }>;
};

function parseCoverPayload(task: LocalPublishTask): { buffer: Buffer; ext: string } | null {
  const decodeBase64 = (raw: string, mime?: string): { buffer: Buffer; ext: string } | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const dataMatch = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    const b64 = dataMatch?.[2] ?? trimmed;
    const mimeType = dataMatch?.[1] ?? mime ?? "image/png";
    try {
      const buffer = Buffer.from(b64, "base64");
      if (!buffer.length) return null;
      const ext = mimeType.includes("svg")
        ? ".svg"
        : mimeType.includes("jpeg") || mimeType.includes("jpg")
          ? ".jpg"
          : ".png";
      return { buffer, ext };
    } catch {
      return null;
    }
  };

  if (task.coverBase64?.trim()) {
    return decodeBase64(task.coverBase64.trim());
  }
  if (task.coverImageUrl?.trim()) {
    const url = task.coverImageUrl.trim();
    if (url.startsWith("data:")) return decodeBase64(url);
  }
  return null;
}

async function resolveCoverTempFile(
  task: LocalPublishTask,
  platformTag: string,
): Promise<{ filePath: string; cleanup: () => void } | null> {
  const parsed = parseCoverPayload(task);
  if (parsed) {
    const filePath = path.join(os.tmpdir(), `geo-${platformTag}-cover-${Date.now()}${parsed.ext}`);
    fs.writeFileSync(filePath, parsed.buffer);
    return { filePath, cleanup: () => fs.unlink(filePath, () => undefined) };
  }

  const url = task.coverImageUrl?.trim();
  if (!url || url.startsWith("data:") || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return null;
    const ct = res.headers.get("content-type") ?? "";
    const ext = ct.includes("jpeg") || ct.includes("jpg") ? ".jpg" : ".png";
    const filePath = path.join(os.tmpdir(), `geo-${platformTag}-cover-${Date.now()}${ext}`);
    fs.writeFileSync(filePath, buffer);
    return { filePath, cleanup: () => fs.unlink(filePath, () => undefined) };
  } catch {
    return null;
  }
}

/** 封面上传（复用知乎思路）；失败不阻断发布 */
export async function uploadPlatformCover(
  page: Page,
  task: LocalPublishTask,
  config: MpPublishArticleConfig,
): Promise<{ ok: boolean; message: string; selector?: string }> {
  if (config.skipCover) {
    return { ok: false, message: `[${config.platformTag}] cover_skipped_by_platform` };
  }

  const resolved = await resolveCoverTempFile(task, config.platformTag);
  if (!resolved) {
    return { ok: false, message: `[${config.platformTag}] no_cover_payload` };
  }

  const fileInputSelectors = config.coverFileInputSelectors ?? [
    'input[type="file"][accept*="image"]',
    '[class*="cover"] input[type="file"]',
    '[class*="Cover"] input[type="file"]',
    'input[type="file"]',
  ];
  const triggerPattern =
    config.coverTriggerPattern ?? /上传封面|添加封面|更换封面|封面图|设置封面/i;

  try {
    const trigger = page.getByRole("button", { name: triggerPattern }).first();
    if (await trigger.isVisible({ timeout: 800 }).catch(() => false)) {
      await trigger.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(600);
    } else {
      const textTrigger = page.getByText(triggerPattern).first();
      if (await textTrigger.isVisible({ timeout: 800 }).catch(() => false)) {
        await textTrigger.click({ timeout: 3000 }).catch(() => undefined);
        await page.waitForTimeout(600);
      }
    }

    for (const selector of fileInputSelectors) {
      const input = page.locator(selector).first();
      if ((await input.count()) === 0) continue;
      try {
        await input.setInputFiles(resolved.filePath, { timeout: 8000 });
        await page.waitForTimeout(1500);
        return { ok: true, message: "cover_file_set", selector };
      } catch {
        /* next */
      }
    }
    return {
      ok: false,
      message: `[${config.platformTag}] cover_input_not_found（未找到 file input，已尝试 ${fileInputSelectors.length} 个选择器）`,
    };
  } finally {
    resolved.cleanup();
  }
}

async function clickMpPublishButton(page: Page, config: MpPublishArticleConfig): Promise<boolean> {
  const skip = config.publishButtonSkip ?? /草稿|预览|取消|删除|保存|设置|存草稿/i;
  const scopes: ReturnType<Page["locator"]>[] = [];

  if (config.toolbarSelectorHints?.length) {
    for (const hint of config.toolbarSelectorHints) {
      scopes.push(page.locator(hint).first());
    }
  }
  scopes.push(
    page.locator("header").first(),
    page.locator('[class*="toolbar"], [class*="Toolbar"], [class*="footer"], [class*="Footer"]').first(),
  );

  for (const scope of scopes) {
    if (!(await scope.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const buttons = scope.getByRole("button");
    const count = await buttons.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const btn = buttons.nth(i);
      if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;
      const text = ((await btn.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
      if (!config.publishButtonPattern.test(text) || skip.test(text)) continue;
      if (await btn.isDisabled().catch(() => false)) continue;
      await btn.click({ timeout: 5000 });
      return true;
    }
  }

  const roleButtons = page.getByRole("button", { name: config.publishButtonPattern });
  const roleCount = await roleButtons.count().catch(() => 0);
  for (let i = 0; i < roleCount; i += 1) {
    const btn = roleButtons.nth(i);
    if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;
    if (await btn.isDisabled().catch(() => false)) continue;
    await btn.click({ timeout: 5000 });
    return true;
  }

  const allButtons = page.getByRole("button");
  for (let i = 0; i < (await allButtons.count()); i += 1) {
    const btn = allButtons.nth(i);
    if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const text = ((await btn.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    if (!config.publishButtonPattern.test(text) || skip.test(text)) continue;
    if (await btn.isDisabled().catch(() => false)) continue;
    await btn.click({ timeout: 5000 });
    return true;
  }

  return false;
}

async function confirmMpPublishDialogIfPresent(
  page: Page,
  config: MpPublishArticleConfig,
): Promise<{ clicked: boolean; message: string }> {
  const dialogFilter = config.confirmDialogText ?? /发布|确认|定时|原创/i;
  const dialog = page
    .locator('[role="dialog"], [class*="Modal"], [class*="modal"], [class*="dialog"]')
    .filter({ hasText: dialogFilter })
    .first();
  if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
    return { clicked: false, message: `[${config.platformTag}] 无发布确认弹窗` };
  }

  const confirmPattern = config.confirmButtonPattern ?? /^确认发布$|^发布$|^立即发布$|^提交$|^确定$/;
  const confirm = dialog
    .getByRole("button", { name: confirmPattern })
    .or(dialog.locator("button").filter({ hasText: confirmPattern }))
    .first();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirm.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    return { clicked: true, message: `[${config.platformTag}] 已点击确认发布` };
  }
  return { clicked: false, message: `[${config.platformTag}] 检测到弹窗但未找到确认按钮` };
}

async function waitForMpPublishSuccess(page: Page, config: MpPublishArticleConfig, timeoutMs = 18000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText().catch(() => "");
    if (config.successTextPattern.test(body)) return true;
    if (config.extractPublicUrl(page.url())) return true;
    await page.waitForTimeout(500);
  }
  try {
    await page.getByText(config.successTextPattern).first().waitFor({ state: "visible", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function extractPublishErrorLine(body: string, pattern: RegExp): string {
  return (
    body
      .split("\n")
      .map(line => line.trim())
      .find(line => pattern.test(line)) ?? "发布失败"
  );
}

/** 参考 zhihu attemptPublishArticle：点击发布 → 确认弹窗 → 等待成功 → 提取 publicUrl */
export async function attemptMpPublishArticle(
  page: Page,
  config: MpPublishArticleConfig,
): Promise<{
  published: boolean;
  publicUrl?: string;
  errorType?: string;
  message?: string;
  subSteps: MpPublishSubStep[];
}> {
  const subSteps: MpPublishSubStep[] = [];
  const tag = config.platformTag;

  await page.waitForTimeout(800);

  const clicked = await clickMpPublishButton(page, config);
  if (!clicked) {
    const msg = `[${tag}] 未找到写作页「发布」按钮（pattern: ${String(config.publishButtonPattern)}）`;
    subSteps.push({ step: "click_publish_button", status: "failed", message: msg });
    return {
      published: false,
      errorType: "publish_button_not_found",
      message: msg,
      subSteps,
    };
  }
  subSteps.push({ step: "click_publish_button", status: "ok", message: `[${tag}] 已点击发布` });

  await page.waitForTimeout(800);
  const confirm = await confirmMpPublishDialogIfPresent(page, config);
  subSteps.push({
    step: "confirm_publish_dialog",
    status: confirm.clicked ? "ok" : "skipped",
    message: confirm.message,
  });
  await page.waitForTimeout(500);

  const successVisible = await waitForMpPublishSuccess(page, config, 18000);
  const body = await page.locator("body").innerText().catch(() => "");
  const currentUrl = page.url();

  if (!successVisible) {
    if (config.publishErrorPattern.test(body)) {
      const line = extractPublishErrorLine(body, config.publishErrorPattern).slice(0, 240);
      const msg = `[${tag}] 平台返回：${line}`;
      subSteps.push({ step: "wait_publish_success", status: "failed", message: msg });
      return {
        published: false,
        errorType: "publish_failed",
        message: msg,
        subSteps,
      };
    }
    const fallbackUrl = config.extractPublicUrl(currentUrl);
    if (fallbackUrl) {
      subSteps.push({
        step: "wait_publish_success",
        status: "ok",
        message: `[${tag}] URL 已跳转但未检测到成功文案`,
      });
      subSteps.push({
        step: "extract_public_url",
        status: "ok",
        message: fallbackUrl,
      });
      return {
        published: true,
        publicUrl: fallbackUrl,
        message: `[${tag}] url_redirect_without_success_hint`,
        subSteps,
      };
    }
    const msg = `[${tag}] 等待发布成功提示超时（18秒），当前 URL：${currentUrl.split("?")[0]}`;
    subSteps.push({ step: "wait_publish_success", status: "failed", message: msg });
    return {
      published: false,
      errorType: "publish_timeout",
      message: msg,
      subSteps,
    };
  }

  subSteps.push({
    step: "wait_publish_success",
    status: "ok",
    message: `[${tag}] 检测到发布成功提示`,
  });

  let publicUrl = config.extractPublicUrl(currentUrl);
  if (!publicUrl) {
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(500);
      publicUrl = config.extractPublicUrl(page.url());
      if (publicUrl) break;
    }
  }

  if (!publicUrl && config.successTextPattern.test(body)) {
    const msg = `[${tag}] 发布成功但未从 URL 提取公开链接（${page.url().split("?")[0]}）`;
    subSteps.push({ step: "extract_public_url", status: "failed", message: msg });
    return {
      published: true,
      errorType: "public_url_missing",
      message: msg,
      subSteps,
    };
  }

  if (!publicUrl) {
    const msg = `[${tag}] 发布成功提示已出现，但 URL 不符合公开链接规则：${page.url().split("?")[0]}`;
    subSteps.push({ step: "extract_public_url", status: "failed", message: msg });
    return {
      published: false,
      errorType: "public_url_extract_failed",
      message: msg,
      subSteps,
    };
  }

  subSteps.push({ step: "extract_public_url", status: "ok", message: publicUrl });
  return {
    published: true,
    publicUrl,
    message: `[${tag}] publish_success`,
    subSteps,
  };
}

export async function fillFirstSelectorInPageOrFrames(
  page: Page,
  selectors: string[],
  value: string,
): Promise<{ ok: boolean; selector?: string }> {
  const main = await fillFirstSelector(page, selectors, value, true);
  if (main.ok) return main;

  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      for (const sel of selectors) {
        const loc = frame.locator(sel).first();
        if ((await loc.count()) === 0) continue;
        try {
          await loc.click({ timeout: 3000 });
          await loc.fill(value, { timeout: 8000 });
          return { ok: true, selector: `frame:${sel}` };
        } catch {
          try {
            await loc.click({ timeout: 3000 });
            await frame.page().keyboard.type(value, { delay: 5 });
            return { ok: true, selector: `frame:${sel}` };
          } catch {
            /* next */
          }
        }
      }
    } catch {
      /* cross-origin */
    }
  }
  return { ok: false };
}

export type MpPublishFlowHooks = {
  titleSelectors: string[];
  contentSelectors: string[];
  writeUrlReady: (url: string) => boolean;
  detectAccount: (page: Page) => Promise<string | null>;
  extraWritePageChecks?: (page: Page) => Promise<string | null>;
  attemptSaveDraft: (page: Page) => Promise<{
    saved: boolean;
    draftUrl?: string;
    message?: string;
  }>;
  urls: BasePlatformPublisher["urls"];
};

/** 扩展 base 发布流：填稿 + 封面 + attemptPublishArticle */
export async function executeMpPublishTask(
  hooks: MpPublishFlowHooks,
  task: LocalPublishTask,
  mpConfig: MpPublishArticleConfig,
): Promise<LocalPublishResult> {
  const logs: PublishStepLog[] = [];
  const profileId = task.localProfileId;
  const publishAction = task.action === "save_draft" ? "save_draft" : "publish";
  logs.push(stepLog("publish_action", "ok", publishAction));

  try {
    const context = await getOrLaunchContext(profileId, false);
    const page = context.pages()[0] ?? (await context.newPage());

    logs.push(stepLog("open_home", "ok", hooks.urls.homeUrl));
    await page.goto(hooks.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);

    if (isLoginUrl(page.url(), hooks.urls.loginUrlPattern)) {
      const loginMsg = `[${mpConfig.platformTag}] 首页跳转登录页，会话已失效`;
      logs.push(stepLog("detect_account", "failed", loginMsg));
      return {
        status: "session_expired",
        errorType: "login_required",
        errorMessage: loginMsg,
        logs,
      };
    }

    let detected = await hooks.detectAccount(page);
    logs.push(
      stepLog(
        "detect_account",
        detected ? "ok" : "failed",
        detected ?? `[${mpConfig.platformTag}] 未识别到昵称`,
      ),
    );

    if (!detected) {
      const stored = getAccountByProfileId(profileId);
      if (isPendingPublishAccountName(task.expectedAccountName) || stored?.sessionStatus === "active") {
        detected = task.expectedAccountName?.trim() || "账号已登录";
        logs.push(stepLog("detect_account", "ok", "已登录，账号已登录，继续填稿"));
      } else {
        return {
          status: "failed",
          errorType: "account_unknown",
          errorMessage: `[${mpConfig.platformTag}] 无法识别当前登录账号，请确认已登录且后台首页可显示昵称`,
          logs,
        };
      }
    }

    if (shouldBlockPublishForAccountNameMismatch(task.expectedAccountName, detected)) {
      logs.push(stepLog("detect_account", "failed", "账号不一致"));
      return {
        status: "failed",
        errorType: "account_mismatch",
        errorMessage: `当前登录账号 ${detected}，与任务账号 ${task.expectedAccountName} 不一致`,
        logs,
      };
    }
    if (
      isPendingPublishAccountName(task.expectedAccountName) &&
      detected &&
      !accountNamesMatch(task.expectedAccountName, detected)
    ) {
      logs.push(
        stepLog("detect_account", "ok", "账号已登录：已跳过昵称比对，按登录有效继续发布"),
      );
    }

    if (!hooks.urls.writeUrl) {
      logs.push(stepLog("open_write", "skipped", "writeUrl 未配置"));
      return {
        status: "manual_required",
        errorType: "write_page_uncertain",
        errorMessage: "已打开平台后台首页，请人工进入发布页",
        logs,
      };
    }

    await page.goto(hooks.urls.writeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const writeUrl = page.url();

    if (isLoginUrl(writeUrl, hooks.urls.loginUrlPattern)) {
      const loginMsg = `[${mpConfig.platformTag}] 打开发布页时跳转登录`;
      logs.push(stepLog("open_write", "failed", loginMsg));
      return {
        status: "session_expired",
        errorType: "login_required",
        errorMessage: loginMsg,
        logs,
      };
    }

    const extra = hooks.extraWritePageChecks ? await hooks.extraWritePageChecks(page) : null;
    if (extra && !mpConfig.softWritePageWarnings) {
      logs.push(stepLog("open_write", "failed", extra));
      return {
        status: "manual_required",
        errorType: "write_page_not_found",
        errorMessage: extra,
        logs,
      };
    }
    if (extra && mpConfig.softWritePageWarnings) {
      logs.push(stepLog("open_write", "ok", `警告：${extra}`));
    }

    if (!hooks.writeUrlReady(writeUrl)) {
      logs.push(stepLog("open_write", "failed", writeUrl));
      return {
        status: "manual_required",
        errorType: "write_page_not_found",
        errorMessage: `未能确认进入发布页（${writeUrl}）`,
        logs,
      };
    }

    logs.push(stepLog("open_write", "ok", writeUrl));

    const captchaHint = await page.locator("body").innerText().catch(() => "");
    if (/验证码|安全验证|滑块|人机验证/.test(captchaHint)) {
      logs.push(stepLog("open_write", "failed", "检测到验证码"));
      return {
        status: "manual_required",
        errorType: "captcha_or_verify",
        errorMessage: "遇到验证码或安全验证，请在已打开窗口中人工完成",
        logs,
      };
    }

    await page.waitForTimeout(1500);

    const titleFill = mpConfig.fillTitle
      ? await mpConfig.fillTitle(page, task.title, hooks.titleSelectors)
      : await fillFirstSelector(page, hooks.titleSelectors, task.title);
    const titleMiss = formatMpSelectorMiss(mpConfig.platformTag, "标题", hooks.titleSelectors);
    logs.push(
      stepLog(
        "fill_title",
        titleFill.ok ? "ok" : "failed",
        titleFill.ok ? undefined : titleMiss,
        titleFill.selector,
      ),
    );
    if (!titleFill.ok) {
      return {
        status: "failed",
        errorType: "title_input_not_found",
        errorMessage: titleMiss,
        logs,
      };
    }

    const contentFill = mpConfig.fillContent
      ? await mpConfig.fillContent(page, task.content, hooks.contentSelectors)
      : await fillFirstSelector(page, hooks.contentSelectors, task.content);
    const contentMiss = formatMpSelectorMiss(mpConfig.platformTag, "正文", hooks.contentSelectors);
    logs.push(
      stepLog(
        "fill_content",
        contentFill.ok ? "ok" : "failed",
        contentFill.ok ? undefined : contentMiss,
        contentFill.selector,
      ),
    );
    if (!contentFill.ok) {
      return {
        status: "failed",
        errorType: "content_input_not_found",
        errorMessage: contentMiss,
        logs,
      };
    }

    const coverResult = await uploadPlatformCover(page, task, mpConfig);
    logs.push(
      stepLog("upload_cover", coverResult.ok ? "ok" : "skipped", coverResult.message, coverResult.selector),
    );

    if (publishAction === "save_draft") {
      const save = await hooks.attemptSaveDraft(page);
      logs.push(stepLog("save_draft", save.saved ? "ok" : "skipped", save.message));
      if (save.saved && save.draftUrl) {
        return { status: "draft_saved", draftUrl: save.draftUrl, logs };
      }
      return {
        status: "manual_required",
        errorType: "manual_confirm",
        errorMessage: "已填入标题和正文，未检测到草稿保存证据，请在浏览器窗口人工确认保存",
        logs,
      };
    }

    const publishResult = await attemptMpPublishArticle(page, mpConfig);
    for (const sub of publishResult.subSteps) {
      logs.push(stepLog(sub.step, sub.status, sub.message));
    }
    logs.push(
      stepLog(
        "publish_article",
        publishResult.published ? "ok" : "failed",
        publishResult.message,
      ),
    );

    if (publishResult.published) {
      return {
        status: publishResult.publicUrl ? "completed" : "manual_required",
        publicUrl: publishResult.publicUrl,
        errorType: publishResult.publicUrl ? undefined : "public_url_missing",
        errorMessage: publishResult.publicUrl
          ? undefined
          : (publishResult.message ?? "发布成功但未提取到公开链接，请人工确认"),
        logs,
      };
    }

    return {
      status: "failed",
      errorType: publishResult.errorType ?? "publish_failed",
      errorMessage: publishResult.message ?? `${mpConfig.platformTag}发布失败`,
      logs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(stepLog("publish_flow", "failed", msg));
    return {
      status: "failed",
      errorType: "unknown",
      errorMessage: msg,
      logs,
    };
  }
}

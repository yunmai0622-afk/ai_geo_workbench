import type { Page } from "playwright";
import { touchAccountOpened } from "../profileManager";
import { updateAccount, type StoredPlatform } from "../storage";
import { closeContext, getOpenContext, getOrLaunchContext } from "./browserSession";

export type LocalPublishPlatform = "zhihu" | "sohu" | "baijiahao" | "toutiao" | "netease";

export type LocalPublishTask = {
  taskId: number;
  platform: LocalPublishPlatform;
  localProfileId: string;
  expectedAccountName: string;
  title: string;
  content: string;
  coverBase64?: string;
  coverImageUrl?: string | null;
  action: "save_draft" | "publish";
};

export type PublishStepLog = {
  step: string;
  status: "ok" | "failed" | "skipped";
  message?: string;
  selector?: string;
  createdAt: string;
};

export type LocalPublishResult = {
  status: "draft_saved" | "completed" | "manual_required" | "failed" | "session_expired";
  publicUrl?: string;
  draftUrl?: string;
  errorType?: string;
  errorMessage?: string;
  logs: PublishStepLog[];
};

export type PlatformUrls = {
  homeUrl: string;
  writeUrl: string | null;
  loginUrlPattern: RegExp;
};

export function stepLog(
  step: string,
  status: PublishStepLog["status"],
  message?: string,
  selector?: string,
): PublishStepLog {
  return { step, status, message, selector, createdAt: new Date().toISOString() };
}

export function normalizeAccountName(name: string): string {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

export function accountNamesMatch(expected: string, detected: string): boolean {
  const a = normalizeAccountName(expected);
  const b = normalizeAccountName(detected);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

/** 占位昵称（已登录但未识别真实昵称）不参与发布前昵称一致性阻断 */
export function isPendingPublishAccountName(name: string | null | undefined): boolean {
  const t = (name ?? "").trim();
  if (!t) return false;
  if (t === "账号已登录" || t === "昵称待识别") return true;
  return t.endsWith("（账号已登录）") || t.endsWith("（昵称待识别）");
}

export function shouldBlockPublishForAccountNameMismatch(
  expected: string | null | undefined,
  detected: string | null | undefined,
): boolean {
  if (!expected?.trim()) return false;
  if (isPendingPublishAccountName(expected)) return false;
  if (!detected?.trim()) return false;
  return !accountNamesMatch(expected, detected);
}

export function isLoginUrl(url: string, pattern: RegExp): boolean {
  return pattern.test(url) || /signin|sign_in|passport|login/i.test(url);
}

export async function fillFirstSelector(
  page: Page,
  selectors: string[],
  value: string,
  useKeyboardFallback = true,
): Promise<{ ok: boolean; selector?: string }> {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    try {
      await loc.click({ timeout: 3000 });
      await loc.fill(value, { timeout: 8000 });
      return { ok: true, selector: sel };
    } catch {
      if (!useKeyboardFallback) continue;
      try {
        await loc.click({ timeout: 3000 });
        await page.keyboard.type(value, { delay: 5 });
        return { ok: true, selector: sel };
      } catch {
        /* next */
      }
    }
  }
  return { ok: false };
}

export abstract class BasePlatformPublisher {
  abstract readonly platform: StoredPlatform;
  abstract readonly urls: PlatformUrls;

  abstract detectAccount(page: Page): Promise<string | null>;

  protected abstract titleSelectors(): string[];
  protected abstract contentSelectors(): string[];
  protected abstract writeUrlReady(url: string): boolean;
  protected async extraWritePageChecks(_page: Page): Promise<string | null> {
    return null;
  }

  protected async attemptSaveDraft(page: Page): Promise<{
    saved: boolean;
    draftUrl?: string;
    message?: string;
  }> {
    const DRAFT_BTN = /保存草稿|存草稿|保存为草稿|暂存/i;
    const AUTOSAVE = /已保存|保存成功|自动保存|草稿已保存/i;
    const before = page.url();

    const buttons = page.getByRole("button").filter({ hasText: DRAFT_BTN });
    for (let i = 0; i < (await buttons.count()); i += 1) {
      try {
        const btn = buttons.nth(i);
        if (await btn.isVisible({ timeout: 1200 })) {
          await btn.click({ timeout: 5000 });
          await page.waitForTimeout(2500);
          break;
        }
      } catch {
        /* next */
      }
    }

    const body = await page.locator("body").innerText().catch(() => "");
    if (AUTOSAVE.test(body)) {
      return { saved: true, draftUrl: page.url(), message: "检测到自动保存提示" };
    }
    const after = page.url();
    if (after !== before && !isLoginUrl(after, this.urls.loginUrlPattern)) {
      return { saved: true, draftUrl: after, message: "保存后 URL 变化" };
    }
    return { saved: false, message: "未检测到保存草稿成功证据" };
  }

  async openLoginHome(profileId: string): Promise<{ ok: boolean; message: string; url?: string }> {
    const context = await getOrLaunchContext(profileId, false);
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    touchAccountOpened(profileId, "unknown");
    return { ok: true, message: `已打开${this.platform}首页，请手动登录`, url: page.url() };
  }

  async detectAccountSession(profileId: string): Promise<{
    ok: boolean;
    accountName: string | null;
    message: string;
    errorType?: string;
  }> {
    let context = null;
    let shouldClose = false;
    try {
      context = getOpenContext(profileId);
      if (!context || !context.browser()?.isConnected()) {
        context = await getOrLaunchContext(profileId, true);
        shouldClose = true;
      }
      const livePage = context.pages().find(p => !p.isClosed());
      const page = livePage ?? (await context.newPage());
      await page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);

      if (isLoginUrl(page.url(), this.urls.loginUrlPattern)) {
        updateAccount(profileId, { sessionStatus: "expired", lastCheckedAt: new Date().toISOString() });
        return { ok: false, accountName: null, message: "未登录或会话已过期", errorType: "login_required" };
      }

      const name = await this.detectAccount(page);
      const now = new Date().toISOString();
      if (!name) {
        const pendingMsg =
          "已登录，但暂未识别真实昵称。可点击「重新检测」刷新；不影响发布与 Web 同步。";
        updateAccount(profileId, {
          accountName: null,
          displayNameVerified: false,
          displayNameSource: "unknown",
          sessionStatus: "active",
          lastCheckedAt: now,
          lastDetectMessage: pendingMsg,
        });
        return { ok: true, accountName: null, message: pendingMsg };
      }

      updateAccount(profileId, {
        accountName: name,
        displayNameVerified: true,
        displayNameSource: "platform_dom",
        sessionStatus: "active",
        lastCheckedAt: now,
        lastDetectMessage: `检测成功：${name}`,
      });
      return { ok: true, accountName: name, message: `检测到账号：${name}` };
    } catch (e) {
      return {
        ok: false,
        accountName: null,
        message: e instanceof Error ? e.message : String(e),
        errorType: "account_not_detected",
      };
    } finally {
      if (shouldClose && context) {
        await context.close().catch(() => {});
        await closeContext(profileId);
      }
    }
  }

  async openWritePageTest(profileId: string): Promise<{ ok: boolean; message: string; url?: string }> {
    if (!this.urls.writeUrl) {
      return { ok: false, message: "发布页 URL 未确认，请从后台首页人工进入" };
    }
    const context = await getOrLaunchContext(profileId, false);
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(this.urls.writeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    if (isLoginUrl(url, this.urls.loginUrlPattern)) {
      updateAccount(profileId, { sessionStatus: "expired", lastOpenedAt: new Date().toISOString() });
      return { ok: false, message: "打开发布页时跳转登录", url };
    }
    const extra = await this.extraWritePageChecks(page);
    if (extra) return { ok: false, message: extra, url };
    if (!this.writeUrlReady(url)) {
      return { ok: false, message: `未进入预期发布页：${url}`, url };
    }
    touchAccountOpened(profileId, "active");
    return { ok: true, message: "已进入发布页", url };
  }

  async publish(task: LocalPublishTask): Promise<LocalPublishResult> {
    const logs: PublishStepLog[] = [];
    const profileId = task.localProfileId;

    try {
      const context = await getOrLaunchContext(profileId, false);
      const page = context.pages()[0] ?? (await context.newPage());

      logs.push(stepLog("open_home", "ok", this.urls.homeUrl));
      await page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);

      if (isLoginUrl(page.url(), this.urls.loginUrlPattern)) {
        logs.push(stepLog("detect_account", "failed", "未登录"));
        return {
          status: "session_expired",
          errorType: "login_required",
          errorMessage: "未登录或会话已过期，请先打开登录窗口手动登录",
          logs,
        };
      }

      let detected = await this.detectAccount(page);
      logs.push(
        stepLog("detect_account", detected ? "ok" : "failed", detected ?? "未识别到昵称"),
      );

      if (!detected) {
        if (isPendingPublishAccountName(task.expectedAccountName)) {
          detected = task.expectedAccountName?.trim() || "账号已登录";
          logs.push(stepLog("detect_account", "ok", "已登录，账号已登录，继续填稿"));
        } else {
          return {
            status: "failed",
            errorType: "account_unknown",
            errorMessage: "无法识别当前登录账号",
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
          stepLog(
            "detect_account",
            "ok",
            "账号已登录：已跳过昵称比对，按登录有效继续发布",
          ),
        );
      }

      if (!this.urls.writeUrl) {
        logs.push(stepLog("open_write", "skipped", "writeUrl 未配置"));
        return {
          status: "manual_required",
          errorType: "write_page_uncertain",
          errorMessage: "已打开平台后台首页，请人工进入发布页并确认保存草稿",
          logs,
        };
      }

      await page.goto(this.urls.writeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      const writeUrl = page.url();

      if (isLoginUrl(writeUrl, this.urls.loginUrlPattern)) {
        logs.push(stepLog("open_write", "failed", "跳转登录"));
        return {
          status: "session_expired",
          errorType: "login_required",
          errorMessage: "发布页需要登录",
          logs,
        };
      }

      const extra = await this.extraWritePageChecks(page);
      if (extra || !this.writeUrlReady(writeUrl)) {
        logs.push(stepLog("open_write", "failed", extra ?? writeUrl));
        return {
          status: "manual_required",
          errorType: "write_page_not_found",
          errorMessage: extra ?? `未能确认进入发布页（${writeUrl}）`,
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

      const titleFill = await fillFirstSelector(page, this.titleSelectors(), task.title);
      logs.push(
        stepLog(
          "fill_title",
          titleFill.ok ? "ok" : "failed",
          titleFill.ok ? undefined : "未找到标题输入框",
          titleFill.selector,
        ),
      );
      if (!titleFill.ok) {
        return {
          status: "failed",
          errorType: "title_input_not_found",
          errorMessage: "未找到标题输入框",
          logs,
        };
      }

      const contentFill = await fillFirstSelector(page, this.contentSelectors(), task.content);
      logs.push(
        stepLog(
          "fill_content",
          contentFill.ok ? "ok" : "failed",
          contentFill.ok ? undefined : "未找到正文编辑器",
          contentFill.selector,
        ),
      );
      if (!contentFill.ok) {
        return {
          status: "failed",
          errorType: "content_input_not_found",
          errorMessage: "未找到正文编辑器",
          logs,
        };
      }

      logs.push(stepLog("upload_cover", "skipped", "cover_upload_skipped"));

      const save = await this.attemptSaveDraft(page);
      logs.push(
        stepLog(
          "save_draft",
          save.saved ? "ok" : "skipped",
          save.message,
        ),
      );

      if (save.saved && save.draftUrl) {
        return {
          status: "draft_saved",
          draftUrl: save.draftUrl,
          logs,
        };
      }

      return {
        status: "manual_required",
        errorType: "manual_confirm",
        errorMessage: "已填入标题和正文，请在打开窗口中人工确认保存草稿/发布",
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
}

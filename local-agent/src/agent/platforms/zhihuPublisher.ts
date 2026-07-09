import fs from "fs";
import os from "os";
import path from "path";
import type { BrowserContext, Page } from "playwright";
import {
  accountNamesMatch,
  BasePlatformPublisher,
  isPendingPublishAccountName,
  shouldBlockPublishForAccountNameMismatch,
  fillFirstSelector,
  isLoginUrl,
  stepLog,
  type LocalPublishResult,
  type LocalPublishTask,
  type PublishStepLog,
} from "./basePublisher";
import { closeContext, getOpenContext, getOrLaunchContext } from "./browserSession";
import { requireAccount, touchAccountOpened } from "../profileManager";
import { getAccountByProfileId, updateAccount } from "../storage";
import {
  appendWritePageLogStep,
  finishWritePageLog,
  startWritePageLog,
} from "../writePageLogStore";
import { isBlockedZhihuNickname } from "../zhihuAccountDisplay";
import {
  buildZhihuProfileUrl,
  collectLoginProfileSlugInBrowser,
  collectProfileHeaderDebugInBrowser,
  collectProfileSlugFromSettingsPageInBrowser,
  collectProfileSlugFromUserMenuInBrowser,
  collectViewerSlugFromInitialStateInBrowser,
  collectZhihuIdentitySignalsInBrowser,
  resolveZhihuIdentityFromSignals,
  type ZhihuIdentityResolution,
  type ZhihuLoginProfileSlug,
  type ZhihuLoginStatus,
} from "../zhihuIdentityResolver";

/** 知乎正式写作页（唯一优先入口） */
export const ZHIHU_WRITE_TARGET_URL = "https://zhuanlan.zhihu.com/write";

/** 写作页候选：仅专栏 write + 首页兜底（不得再优先 creator / www.zhihu.com/write） */
export const ZHIHU_WRITE_URL_CANDIDATES = [
  ZHIHU_WRITE_TARGET_URL,
  "https://www.zhihu.com/",
] as const;

export const ZHIHU_WRITE_HOME_FALLBACK = "https://www.zhihu.com/";

const SKIP_PATTERN =
  /知乎|logo|头像|搜索|首页|消息|设置|登录|注册|创作中心|写文章|写回答|发布|关注|推荐|热榜|机构号|开通|适老化|无障碍|验证码|回到顶部|获取短信|获取语音|中国\s*\+?86|点击打开|的主页|个人主页|广告|私信|通知|会员|用户|账号/i;

export type ZhihuDetectCandidate = {
  priority: number;
  source: string;
  selector: string;
  text: string;
};

export type ZhihuLoginCheck = {
  loginRequired: boolean;
  reason: string;
};

export type ZhihuWritePageErrorType =
  | "profile_not_found"
  | "session_expired"
  | "write_page_not_found"
  | "write_page_404"
  | "login_required"
  | "page_load_timeout"
  | "editor_not_found"
  | "manual_required";

export type ZhihuWritePageResult = {
  ok: boolean;
  message: string;
  url?: string;
  hasEditor?: boolean;
  errorType?: ZhihuWritePageErrorType;
  /** 404 / 候选尝试来自知乎页面层（B） */
  layer?: "zhihu";
  logPath?: string;
  triedUrls?: string[];
};

export type ZhihuSessionReuseResult = {
  profileId: string;
  profilePath: string;
  accountInJson: boolean;
  home: {
    ok: boolean;
    url: string;
    sessionStatus: "active" | "expired";
    errorType?: ZhihuWritePageErrorType;
    message: string;
  };
  write: ZhihuWritePageResult;
};

export class ZhihuPublisher extends BasePlatformPublisher {
  readonly platform = "zhihu" as const;
  readonly urls = {
    homeUrl: ZHIHU_WRITE_HOME_FALLBACK,
    writeUrl: ZHIHU_WRITE_TARGET_URL,
    loginUrlPattern: /signin|sign_in|login|passport\.zhihu/i,
  };

  /** 仅专栏写作页计为就绪，creator / www.zhihu.com/write 不算成功 */
  protected writeUrlReady(url: string): boolean {
    return url.includes("zhuanlan.zhihu.com") && url.includes("/write");
  }

  private logOpenWrite(
    sessionId: string | null,
    status: "ok" | "failed" | "skipped" | "manual_required",
    targetUrl: string,
    actualUrl: string,
    message: string,
    extra?: { errorType?: string; httpStatus?: number; clickSource?: string },
  ) {
    const detail = {
      platform: "zhihu",
      step: "open_write",
      targetUrl,
      actualUrl,
      status,
      errorType: extra?.errorType,
      httpStatus: extra?.httpStatus,
      clickSource: extra?.clickSource,
      message,
    };
    console.log("[agent-zhihu] open_write", detail);
    if (!sessionId) return;
    appendWritePageLogStep(sessionId, {
      step: "open_write",
      status,
      message: JSON.stringify(detail),
      layer: "zhihu",
      url: actualUrl,
      errorType: extra?.errorType,
      httpStatus: extra?.httpStatus,
      clickSource: extra?.clickSource,
    });
  }

  private async isZhihuPage404(page: Page, response: { status(): number } | null): Promise<boolean> {
    if (response && response.status() === 404) return true;
    const title = await page.title().catch(() => "");
    const snippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 2500);
    const blob = `${title}\n${snippet}`;
    if (/\b404\b|页面不存在|你访问的页面|找不到页面|not\s*found/i.test(blob)) return true;
    return page.url().includes("/404");
  }

  private logWriteStep(
    sessionId: string | null,
    step: string,
    status: "ok" | "failed" | "skipped",
    message: string,
    extra?: { url?: string; errorType?: string; httpStatus?: number; clickSource?: string },
  ) {
    console.log(`[agent-zhihu] ${step}`, { status, message, ...extra });
    if (!sessionId) return;
    appendWritePageLogStep(sessionId, {
      step,
      status,
      message,
      layer: "zhihu",
      url: extra?.url,
      errorType: extra?.errorType,
      httpStatus: extra?.httpStatus,
      clickSource: extra?.clickSource,
    });
  }

  /**
   * 打开专栏写作页；仅 https://zhuanlan.zhihu.com/write 可判成功；404 不得标成功。
   */
  private async tryOpenZhihuWriteTargetPage(
    page: Page,
    profileId: string,
    sessionId: string | null,
    clickSource: string,
    triedUrls: string[],
  ): Promise<ZhihuWritePageResult | "continue"> {
    const targetUrl = ZHIHU_WRITE_TARGET_URL;
    triedUrls.push(targetUrl);

    let response: Awaited<ReturnType<Page["goto"]>> = null;
    try {
      response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const actualUrl = page.url();
      const errorType = /timeout/i.test(msg) ? "page_load_timeout" : "write_page_not_found";
      this.logOpenWrite(sessionId, "failed", targetUrl, actualUrl, msg, {
        errorType,
        clickSource,
      });
      return "continue";
    }

    await page.waitForTimeout(1500);
    const actualUrl = page.url();
    const httpStatus = response?.status();

    if (await this.isZhihuPage404(page, response)) {
      this.logOpenWrite(
        sessionId,
        "failed",
        targetUrl,
        actualUrl,
        `知乎发布页返回 404（HTTP ${httpStatus ?? "?"})`,
        { errorType: "write_page_404", httpStatus: httpStatus ?? 404, clickSource },
      );
      return "continue";
    }

    if (isLoginUrl(actualUrl, this.urls.loginUrlPattern)) {
      updateAccount(profileId, {
        sessionStatus: "expired",
        lastDetectMessage: "打开发布页时跳转登录",
      });
      this.logOpenWrite(sessionId, "failed", targetUrl, actualUrl, "打开写作页时跳转登录页", {
        errorType: "login_required",
        clickSource,
      });
      return {
        ok: false,
        message: "打开写作页时跳转登录页，登录态已失效",
        url: actualUrl,
        errorType: "login_required",
        layer: "zhihu",
        triedUrls,
      };
    }

    const loginUi = await this.checkZhihuLoginState(page);
    if (loginUi.loginRequired) {
      updateAccount(profileId, { sessionStatus: "expired", lastDetectMessage: loginUi.reason });
      this.logOpenWrite(sessionId, "failed", targetUrl, actualUrl, loginUi.reason, {
        errorType: "login_required",
        clickSource,
      });
      return {
        ok: false,
        message: loginUi.reason,
        url: actualUrl,
        errorType: "login_required",
        layer: "zhihu",
        triedUrls,
      };
    }

    const hasEditor = await this.waitForWriteEditor(page, 18000);
    const onZhuanlanWrite = this.writeUrlReady(actualUrl);

    if (!onZhuanlanWrite || !hasEditor) {
      const errorType = hasEditor ? "write_page_not_found" : "editor_not_found";
      this.logOpenWrite(
        sessionId,
        "failed",
        targetUrl,
        actualUrl,
        onZhuanlanWrite
          ? "已进入专栏域但未找到标题/正文编辑器"
          : `未进入专栏写作页（实际 URL：${actualUrl}）`,
        { errorType, clickSource },
      );
      return "continue";
    }

    touchAccountOpened(profileId, "active");
    updateAccount(profileId, {
      sessionStatus: "active",
      lastDetectMessage: "写作页编辑器已就绪",
    });
    this.logOpenWrite(sessionId, "ok", targetUrl, actualUrl, "已打开知乎发布页", { clickSource });
    return {
      ok: true,
      message: "已打开知乎发布页",
      url: actualUrl,
      hasEditor: true,
      layer: "zhihu",
      triedUrls,
    };
  }

  /**
   * 按候选 URL 打开知乎写作页；404 不判成功；首页 fallback 为 manual_required。
   */
  async openWritePageWithCandidates(
    profileId: string,
    clickSource = "client_publish_button",
  ): Promise<ZhihuWritePageResult> {
    let account;
    try {
      account = requireAccount(profileId);
    } catch {
      return { ok: false, message: `profile_not_found: ${profileId}`, errorType: "profile_not_found", layer: "zhihu" };
    }

    if (account.platform !== "zhihu") {
      return { ok: false, message: "仅支持知乎发布页", errorType: "write_page_not_found", layer: "zhihu" };
    }

    const { sessionId, logPath } = startWritePageLog({
      profileId,
      platform: "zhihu",
      clickSource,
    });
    const triedUrls: string[] = [];

    this.logWriteStep(sessionId, "open_write_start", "ok", `点击来源：${clickSource}`, {
      clickSource,
      url: account.profilePath,
    });

    try {
      const context = await getOrLaunchContext(profileId, false);
      const page = context.pages().find(p => !p.isClosed()) ?? (await context.newPage());

      const primary = await this.tryOpenZhihuWriteTargetPage(
        page,
        profileId,
        sessionId,
        clickSource,
        triedUrls,
      );
      if (primary !== "continue") {
        finishWritePageLog(sessionId, {
          finalStatus: primary.ok ? "success" : "failed",
          errorType: primary.errorType,
          finalUrl: primary.url,
        });
        return { ...primary, logPath, triedUrls };
      }

      triedUrls.push(ZHIHU_WRITE_HOME_FALLBACK);
      this.logWriteStep(sessionId, "open_write_candidate", "ok", `fallback 知乎首页：${ZHIHU_WRITE_HOME_FALLBACK}`, {
        url: ZHIHU_WRITE_HOME_FALLBACK,
        clickSource,
      });
      const homeResponse = await page.goto(ZHIHU_WRITE_HOME_FALLBACK, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1500);
      const homeUrl = page.url();

      if (await this.isZhihuPage404(page, homeResponse)) {
        this.logWriteStep(sessionId, "open_write_404", "failed", "知乎首页亦返回 404", {
          url: homeUrl,
          errorType: "write_page_404",
        });
      } else if (isLoginUrl(homeUrl, this.urls.loginUrlPattern)) {
        finishWritePageLog(sessionId, { finalStatus: "failed", errorType: "login_required", finalUrl: homeUrl });
        return {
          ok: false,
          message: "登录态失效，请先打开登录窗口",
          url: homeUrl,
          errorType: "login_required",
          layer: "zhihu",
          logPath,
          triedUrls,
        };
      } else {
        const loginUi = await this.checkZhihuLoginState(page);
        if (!loginUi.loginRequired) {
          touchAccountOpened(profileId, "active");
          updateAccount(profileId, {
            sessionStatus: "active",
            lastDetectMessage: "未能定位写作页，已打开知乎首页",
          });
          const manualMsg =
            "未能自动进入专栏写作页，已打开知乎首页，请手动进入 https://zhuanlan.zhihu.com/write";
          this.logOpenWrite(
            sessionId,
            "manual_required",
            ZHIHU_WRITE_TARGET_URL,
            homeUrl,
            manualMsg,
            { errorType: "manual_required", clickSource },
          );
          this.logWriteStep(sessionId, "open_write_manual_required", "skipped", manualMsg, {
            url: homeUrl,
            errorType: "manual_required",
            clickSource,
          });
          finishWritePageLog(sessionId, {
            finalStatus: "manual_required",
            errorType: "manual_required",
            finalUrl: homeUrl,
          });
          return {
            ok: false,
            message: manualMsg,
            url: homeUrl,
            errorType: "manual_required",
            layer: "zhihu",
            logPath,
            triedUrls,
          };
        }
      }

      const failMsg = "知乎发布页打开失败，请确认账号已登录或手动进入发布页";
      this.logOpenWrite(
        sessionId,
        "failed",
        ZHIHU_WRITE_TARGET_URL,
        page.url(),
        failMsg,
        { errorType: "write_page_not_found", clickSource },
      );
      this.logWriteStep(sessionId, "open_write_failed", "failed", failMsg, {
        errorType: "write_page_not_found",
        clickSource,
      });
      finishWritePageLog(sessionId, {
        finalStatus: "failed",
        errorType: "write_page_not_found",
        finalUrl: page.url(),
      });
      return {
        ok: false,
        message: failMsg,
        url: page.url(),
        errorType: "write_page_not_found",
        layer: "zhihu",
        logPath,
        triedUrls,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = /timeout/i.test(msg);
      this.logWriteStep(sessionId, "open_write_failed", "failed", msg, {
        errorType: isTimeout ? "page_load_timeout" : "write_page_not_found",
      });
      finishWritePageLog(sessionId, {
        finalStatus: "failed",
        errorType: isTimeout ? "page_load_timeout" : "write_page_not_found",
      });
      return {
        ok: false,
        message: msg,
        errorType: isTimeout ? "page_load_timeout" : "write_page_not_found",
        layer: "zhihu",
        logPath,
        triedUrls,
      };
    }
  }

  private mapIdentitySourceForStorage(
    source: ZhihuIdentityResolution["displayNameSource"],
  ): "platform_dom" | "profile_name" | "unknown" {
    if (source === "profile_header" || source === "document_title") return "profile_name";
    if (source === "viewer_state" || source === "user_menu") return "platform_dom";
    return "unknown";
  }

  private parseCoverPayload(task: LocalPublishTask): { buffer: Buffer; ext: string } | null {
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
      const raw = task.coverBase64.trim();
      if (raw.startsWith("svg:")) {
        return decodeBase64(`data:image/svg+xml;base64,${raw.slice(4)}`);
      }
      return decodeBase64(raw);
    }
    if (task.coverImageUrl?.trim()) {
      const url = task.coverImageUrl.trim();
      if (url.startsWith("data:")) return decodeBase64(url);
    }
    return null;
  }

  private async resolveCoverTempFile(
    task: LocalPublishTask,
  ): Promise<{ filePath: string; cleanup: () => void } | null> {
    const parsed = this.parseCoverPayload(task);
    if (parsed) {
      const filePath = path.join(os.tmpdir(), `geo-zhihu-cover-${Date.now()}${parsed.ext}`);
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
      const filePath = path.join(os.tmpdir(), `geo-zhihu-cover-${Date.now()}${ext}`);
      fs.writeFileSync(filePath, buffer);
      return { filePath, cleanup: () => fs.unlink(filePath, () => undefined) };
    } catch {
      return null;
    }
  }

  private async confirmZhihuCoverDialogIfPresent(page: Page): Promise<{
    clicked: boolean;
    message: string;
  }> {
    const dialog = page
      .locator('[role="dialog"], [class*="Modal"], [class*="modal"]')
      .filter({ hasText: /封面|裁剪|图片|上传/i })
      .first();
    if (!(await dialog.isVisible({ timeout: 1800 }).catch(() => false))) {
      return { clicked: false, message: "cover_dialog_not_present" };
    }

    const confirm = dialog
      .getByRole("button", { name: /^确定$|^完成$|^保存$|^确认$|^使用图片$|^应用$/ })
      .or(dialog.locator("button").filter({ hasText: /^确定$|^完成$|^保存$|^确认$|^使用图片$|^应用$/ }))
      .first();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
      return { clicked: true, message: "cover_dialog_confirmed" };
    }

    return { clicked: false, message: "cover_dialog_confirm_button_not_found" };
  }

  /** 上传专栏写作页封面；有封面载荷但上传失败时由调用方返回 manual_required */
  private async uploadZhihuCover(
    page: Page,
    task: LocalPublishTask,
  ): Promise<{ ok: boolean; message: string; selector?: string }> {
    const resolved = await this.resolveCoverTempFile(task);
    if (!resolved) {
      return { ok: false, message: "no_cover_payload" };
    }

    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      '[class*="Cover"] input[type="file"]',
      '[class*="cover"] input[type="file"]',
      'input[type="file"]',
    ];

    try {
      const triggerSelectors = [
        page.getByRole("button", { name: /上传封面|添加封面|更换封面|封面图/i }),
        page.locator('[class*="Cover"]').filter({ hasText: /上传封面|添加封面|封面/i }),
        page.getByText(/上传封面图片/i),
      ];
      for (const trigger of triggerSelectors) {
        if (await trigger.first().isVisible({ timeout: 800 }).catch(() => false)) {
          await trigger.first().click({ timeout: 3000 }).catch(() => undefined);
          await page.waitForTimeout(600);
          break;
        }
      }

      for (const selector of fileInputSelectors) {
        const input = page.locator(selector).first();
        if ((await input.count()) === 0) continue;
        try {
          await input.setInputFiles(resolved.filePath, { timeout: 8000 });
          const coverDialog = await this.confirmZhihuCoverDialogIfPresent(page);
          const previewVisible = await page
            .waitForFunction(
              () => {
                const imgs = Array.from(
                  document.querySelectorAll(
                    '[class*="Cover"] img, [class*="cover"] img, img[class*="Cover"], img[class*="cover"]',
                  ),
                );
                for (const img of imgs) {
                  const src = img.getAttribute("src") ?? "";
                  if (src && !/^data:image\/svg/i.test(src) && src.length > 20) return true;
                }
                return Boolean(
                  document.querySelector(
                    '[class*="CoverPreview"], [class*="cover-preview"], [class*="Cover"] [style*="background-image"]',
                  ),
                );
              },
              { timeout: 15000 },
            )
            .catch(() => null);
          if (previewVisible) {
            return {
              ok: true,
              message:
                coverDialog.clicked
                  ? "cover_preview_visible_after_confirm"
                  : "cover_preview_visible",
              selector,
            };
          }
          await page.waitForTimeout(1500);
          return {
            ok: true,
            message:
              coverDialog.clicked
                ? "cover_file_set_after_confirm"
                : "cover_file_set",
            selector,
          };
        } catch {
          /* try next selector */
        }
      }
      return { ok: false, message: "cover_input_not_found" };
    } finally {
      resolved.cleanup();
    }
  }

  private extractZhihuArticlePublicUrl(url: string): string | null {
    const match =
      url.match(/https?:\/\/zhuanlan\.zhihu\.com\/p\/\d+/i) ??
      url.match(/https?:\/\/www\.zhihu\.com\/p\/\d+/i);
    return match ? match[0] : null;
  }

  private async collectVisibleButtonDiagnostics(page: Page): Promise<string> {
    const buttons = page.locator('button, [role="button"]');
    const count = await buttons.count().catch(() => 0);
    const rows: string[] = [];
    for (let i = 0; i < Math.min(count, 40); i += 1) {
      const btn = buttons.nth(i);
      if (!(await btn.isVisible({ timeout: 300 }).catch(() => false))) continue;
      const text = ((await btn.innerText().catch(() => "")) ?? "")
        .replace(/\s+/g, " ")
        .trim();
      const aria = (await btn.getAttribute("aria-label").catch(() => null)) ?? "";
      const title = (await btn.getAttribute("title").catch(() => null)) ?? "";
      const label = text || aria || title || "[no-text]";
      const disabled =
        (await btn.isDisabled().catch(() => false)) ||
        (await btn.getAttribute("aria-disabled").catch(() => null)) === "true";
      rows.push(`${label}${disabled ? "（disabled）" : ""}`);
    }
    return rows.slice(0, 20).join(" | ");
  }

  private async clickFirstVisibleZhihuPublishCandidate(
    page: Page,
    scope: ReturnType<Page["locator"]>,
    publishExact: RegExp,
    skip: RegExp,
  ): Promise<"clicked" | "disabled" | "none"> {
    const candidates = scope.locator('button, [role="button"]');
    const count = await candidates.count().catch(() => 0);
    let sawDisabled = false;

    for (let i = 0; i < count; i += 1) {
      const btn = candidates.nth(i);
      if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;
      const text = ((await btn.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
      const aria = (await btn.getAttribute("aria-label").catch(() => null)) ?? "";
      const title = (await btn.getAttribute("title").catch(() => null)) ?? "";
      const label = text || aria || title;
      if (!publishExact.test(label) || skip.test(label)) continue;
      const disabled =
        (await btn.isDisabled().catch(() => false)) ||
        (await btn.getAttribute("aria-disabled").catch(() => null)) === "true";
      if (disabled) {
        sawDisabled = true;
        continue;
      }
      await btn.click({ timeout: 5000 });
      return "clicked";
    }

    return sawDisabled ? "disabled" : "none";
  }

  /** 写作页顶部工具栏：点击「发布」（排除草稿/预览等） */
  private async clickZhihuWritePagePublishButton(page: Page): Promise<{
    clicked: boolean;
    errorType?: "publish_button_not_found" | "publish_button_disabled";
    message?: string;
  }> {
    const publishExact = /^发布$|^立即发布$|^发布文章$/;
    const skip = /草稿|预览|取消|删除|保存|设置/i;

    const toolbarScopes = [
      page.locator('[class*="WriteIndex"]').first(),
      page.locator('[class*="Toolbar"]').first(),
      page.locator('[class*="Topbar"]').first(),
      page.locator('[class*="PublishPanel"]').first(),
      page.locator('[class*="Publish"]').first(),
      page.locator("header").first(),
      page.locator("body").first(),
    ];

    let sawDisabled = false;
    for (const scope of toolbarScopes) {
      if (!(await scope.isVisible({ timeout: 600 }).catch(() => false))) continue;
      const result = await this.clickFirstVisibleZhihuPublishCandidate(page, scope, publishExact, skip);
      if (result === "clicked") return { clicked: true };
      if (result === "disabled") sawDisabled = true;
    }

    const diagnostics = await this.collectVisibleButtonDiagnostics(page);
    if (sawDisabled) {
      return {
        clicked: false,
        errorType: "publish_button_disabled",
        message: `找到发布按钮但不可点击，当前可见按钮：${diagnostics || "无"}`,
      };
    }

    return {
      clicked: false,
      errorType: "publish_button_not_found",
      message: `未找到知乎写作页顶部「发布」按钮，当前 URL：${page.url()}；可见按钮：${diagnostics || "无"}`,
    };
  }

  /** 发布前「发布设置」等中间弹窗：点「确认发布」或「发布」 */
  private async confirmZhihuPublishSettingsIfPresent(page: Page): Promise<{
    clicked: boolean;
    message: string;
  }> {
    const dialog = page
      .locator('[role="dialog"], [class*="Modal"]')
      .filter({ hasText: /发布设置|定时发布|原创声明|确认发布/i })
      .first();
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
      return { clicked: false, message: "无发布确认弹窗" };
    }

    const confirm = dialog
      .getByRole("button", { name: /^确认发布$|^发布$|^立即发布$/ })
      .or(dialog.locator("button").filter({ hasText: /^确认发布$|^发布$/ }))
      .first();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      return { clicked: true, message: "已点击确认发布" };
    }
    return { clicked: false, message: "检测到发布确认弹窗，但未找到确认按钮" };
  }

  /** 等待「发布成功」弹窗（含「感谢你的第X篇创作」） */
  private async waitForZhihuPublishSuccessDialog(page: Page, timeoutMs = 15000): Promise<boolean> {
    const success = page.getByText(/发布成功|感谢你的第.+篇创作/);
    try {
      await success.first().waitFor({ state: "visible", timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /** 关闭发布成功弹窗（可选） */
  private async dismissZhihuPublishSuccessDialog(page: Page): Promise<void> {
    const dialog = page
      .locator('[role="dialog"], [class*="Modal"]')
      .filter({ hasText: /发布成功|感谢你的第.+篇创作|转发到想法/i })
      .first();
    if (!(await dialog.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const closeCandidates = [
      dialog.locator('button[aria-label*="关闭"], button[aria-label*="Close"]'),
      dialog.locator('[class*="Close"], [class*="close"]').locator("button, svg").first(),
      dialog.getByRole("button", { name: /^关闭$|^×$/ }),
    ];
    for (const loc of closeCandidates) {
      if (await loc.first().isVisible({ timeout: 800 }).catch(() => false)) {
        await loc.first().click({ timeout: 3000 }).catch(() => undefined);
        return;
      }
    }
  }

  /**
   * 知乎专栏真实发布流程：
   * 1. 点写作页右上角「发布」
   * 2. 如有「发布设置」弹窗则确认
   * 3. 等「发布成功」弹窗（背景 URL 已变为 /p/{id}）
   * 4. 从 page.url() 提取 publicUrl
   */
  private async attemptPublishArticle(page: Page): Promise<{
    published: boolean;
    publicUrl?: string;
    errorType?: string;
    message?: string;
    subSteps: PublishStepLog[];
  }> {
    const subSteps: PublishStepLog[] = [];
    const errorPattern =
      /发布失败|请上传封面|请添加封面|缺少封面|内容不符合|违规|审核未通过|再试一次|操作失败/i;

    await page.waitForTimeout(800);

    const clickResult = await this.clickZhihuWritePagePublishButton(page);
    if (!clickResult.clicked) {
      const message = clickResult.message ?? "未找到知乎写作页顶部「发布」按钮";
      subSteps.push(stepLog("click_publish_button", "failed", message));
      return {
        published: false,
        errorType: clickResult.errorType ?? "publish_button_not_found",
        message,
        subSteps,
      };
    }
    subSteps.push(stepLog("click_publish_button", "ok", "已点击发布"));

    await page.waitForTimeout(800);
    const confirm = await this.confirmZhihuPublishSettingsIfPresent(page);
    subSteps.push(
      stepLog("confirm_publish_dialog", confirm.clicked ? "ok" : "skipped", confirm.message),
    );

    const successDialogVisible = await this.waitForZhihuPublishSuccessDialog(page, 15000);
    if (!successDialogVisible) {
      const body = await page.locator("body").innerText().catch(() => "");
      if (errorPattern.test(body)) {
        const errLine =
          body
            .split("\n")
            .map(line => line.trim())
            .find(line => errorPattern.test(line)) ?? "发布失败";
        return {
          published: false,
          errorType: "publish_failed",
          message: errLine.slice(0, 240),
          subSteps: [
            ...subSteps,
            stepLog("wait_publish_success", "failed", errLine.slice(0, 240)),
          ],
        };
      }
      const fallbackUrl = this.extractZhihuArticlePublicUrl(page.url());
      if (fallbackUrl) {
        subSteps.push(stepLog("wait_publish_success", "ok", "URL 已跳转但未检测到成功弹窗"));
        subSteps.push(stepLog("extract_public_url", "ok", fallbackUrl));
        return {
          published: true,
          publicUrl: fallbackUrl,
          message: "url_redirect_without_success_dialog",
          subSteps,
        };
      }
      return {
        published: false,
        errorType: "publish_failed",
        message: "等待「发布成功」弹窗超时（15秒）",
        subSteps: [
          ...subSteps,
          stepLog("wait_publish_success", "failed", "等待「发布成功」弹窗超时（15秒）"),
        ],
      };
    }
    subSteps.push(stepLog("wait_publish_success", "ok", "检测到发布成功弹窗"));

    let publicUrl = this.extractZhihuArticlePublicUrl(page.url());
    if (!publicUrl) {
      for (let i = 0; i < 6; i += 1) {
        await page.waitForTimeout(500);
        publicUrl = this.extractZhihuArticlePublicUrl(page.url());
        if (publicUrl) break;
      }
    }

    await this.dismissZhihuPublishSuccessDialog(page);

    if (!publicUrl) {
      return {
        published: false,
        errorType: "publish_failed",
        message: "发布成功弹窗已出现，但未从页面 URL 提取到 zhuanlan.zhihu.com/p/{id}",
        subSteps: [
          ...subSteps,
          stepLog(
            "extract_public_url",
            "failed",
            "发布成功弹窗已出现，但未从页面 URL 提取到 zhuanlan.zhihu.com/p/{id}",
          ),
        ],
      };
    }

    subSteps.push(stepLog("extract_public_url", "ok", publicUrl));
    return {
      published: true,
      publicUrl,
      message: "publish_success_dialog",
      subSteps,
    };
  }

  /**
   * 等待个人页 ProfileHeader 昵称非空且连续 500ms 不变；超时仅打日志，不抛错。
   */
  private async waitForStableProfileHeaderH1(page: Page, profileId?: string): Promise<string | null> {
    const stableMs = 500;
    try {
      const handle = await page.waitForFunction(
        ({ stableMs: ms }) => {
          const skip =
            "nav,[role=tablist],[class*=Tabs],[class*=Tab],button,[role=button],footer,[class*=Nav]";
          const nameEl =
            document.querySelector(".ProfileHeader-name") ??
            document.querySelector('[class*="ProfileHeader-name"]');
          const h1 =
            document.querySelector(".ProfileHeader h1") ??
            document.querySelector(".ProfileHeader-title") ??
            document.querySelector('[class*="ProfileHeader"] h1');
          const el =
            nameEl && !nameEl.closest(skip)
              ? nameEl
              : h1 && !h1.closest(skip)
                ? h1
                : null;
          if (!el) return null;
          const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
          if (!text || text.length < 2) return null;
          const w = window as unknown as {
            __zhihuProfileH1Stable?: { text: string; since: number };
          };
          const now = Date.now();
          if (!w.__zhihuProfileH1Stable || w.__zhihuProfileH1Stable.text !== text) {
            w.__zhihuProfileH1Stable = { text, since: now };
            return null;
          }
          if (now - w.__zhihuProfileH1Stable.since < ms) return null;
          return text;
        },
        { stableMs },
        { timeout: 10000 },
      );
      return (await handle.jsonValue()) as string | null;
    } catch (e) {
      console.warn("[agent-zhihu] profile header name wait timeout", {
        profileId,
        url: page.url(),
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }

  /** 多步解析登录用户 slug（pathname → 菜单 hover → settings → 首页延迟 state） */
  private async resolveLoginProfileSlug(page: Page, profileId?: string): Promise<ZhihuLoginProfileSlug> {
    const ZHIHU_HOME = "https://www.zhihu.com/";
    const ZHIHU_SETTINGS_PROFILE = "https://www.zhihu.com/settings/profile";

    let pick = await page.evaluate(collectLoginProfileSlugInBrowser);
    if (pick.slug) return pick;

    try {
      const avatar = page
        .locator(
          'header [class*="Avatar"], header a[href*="/people/"], .AppHeader-userInfo, [class*="ProfileMenu"], [class*="AppHeader-userInfo"]',
        )
        .first();
      await avatar.hover({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(200);
      pick = await page.evaluate(collectProfileSlugFromUserMenuInBrowser);
      if (pick.slug) return pick;
    } catch {
      /* hover 失败继续下一步 */
    }

    try {
      console.log("[agent-zhihu] slug resolve via settings/profile", { profileId });
      await page.goto(ZHIHU_SETTINGS_PROFILE, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      pick = await page.evaluate(collectProfileSlugFromSettingsPageInBrowser);
      if (pick.slug) return pick;
    } catch (e) {
      console.warn("[agent-zhihu] settings/profile slug resolve failed", {
        profileId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      console.log("[agent-zhihu] slug resolve via home delayed state", { profileId });
      await page.goto(ZHIHU_HOME, { waitUntil: "domcontentloaded", timeout: 60000 });
      await this.waitForZhihuSession(page, 12000);
      await page.waitForTimeout(3000);
      pick = await page.evaluate(collectViewerSlugFromInitialStateInBrowser);
      if (pick.slug) return pick;
    } catch (e) {
      console.warn("[agent-zhihu] home delayed slug resolve failed", {
        profileId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return { slug: null, source: "none" };
  }

  /** 仅从可信身份源解析知乎昵称（强制打开个人主页后读取 ProfileHeader h1） */
  async resolveZhihuIdentity(
    page: Page,
    loginStatus: ZhihuLoginStatus,
    profileId?: string,
  ): Promise<{
    identity: ZhihuIdentityResolution;
    debug: {
      slug: string | null;
      slugSource: string;
      navigatedUrl: string | null;
      h1Found: boolean;
      nameElFound: boolean;
      displayName: string | null;
      displayNameSource: string;
    };
  }> {
    const url = page.url();
    console.log("[agent-zhihu] identity resolve start", { profileId, url });

    await this.waitForZhihuSession(page, 12000);
    await page.waitForTimeout(800);

    const slugPick = await this.resolveLoginProfileSlug(page, profileId);

    let browserSignals = await page.evaluate(collectZhihuIdentitySignalsInBrowser);
    const slug = slugPick.slug ?? browserSignals.profileSlug ?? browserSignals.viewerStateSlug;
    let navigatedProfileUrl: string | null = null;
    let profileHeaderDebug = await page.evaluate(collectProfileHeaderDebugInBrowser);

    if (slug) {
      const profileUrl = buildZhihuProfileUrl(slug)!;
      navigatedProfileUrl = profileUrl;
      console.log("[agent-zhihu] navigate profile for detect", {
        profileId,
        profileUrl,
        slug,
        slugSource: slugPick.source,
      });
      await page.waitForTimeout(1000);
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      const stableH1 = await this.waitForStableProfileHeaderH1(page, profileId);
      browserSignals = await page.evaluate(collectZhihuIdentitySignalsInBrowser);
      profileHeaderDebug = await page.evaluate(collectProfileHeaderDebugInBrowser);
      if (stableH1 && !browserSignals.profileHeaderTitle) {
        browserSignals = { ...browserSignals, profileHeaderTitle: stableH1 };
      }
    } else {
      console.warn("[agent-zhihu] profile slug not found before detect", { profileId, url: page.url() });
    }

    const identity = resolveZhihuIdentityFromSignals({
      pageUrl: browserSignals.pageUrl,
      documentTitle: browserSignals.documentTitle,
      loginStatus,
      profileHeaderTitle: browserSignals.profileHeaderTitle,
      viewerStateName: browserSignals.viewerStateName,
      viewerStateSlug: browserSignals.viewerStateSlug,
      userMenuName: browserSignals.userMenuName,
    });

    console.log("[agent-zhihu] identity debug", {
      profileId,
      slug,
      slugSource: slugPick.source,
      navigatedProfileUrl,
      pageUrl: browserSignals.pageUrl,
      h1Found: profileHeaderDebug.h1Found,
      h1Text: profileHeaderDebug.h1Text,
      nameElFound: profileHeaderDebug.nameElFound,
      nameElText: profileHeaderDebug.nameElText,
      pickedProfileHeaderText: profileHeaderDebug.pickedText,
      profileHeaderTitle: browserSignals.profileHeaderTitle,
      viewerStateName: browserSignals.viewerStateName,
      viewerStateSlug: browserSignals.viewerStateSlug,
      displayNameSource: identity.displayNameSource,
    });

    if (identity.rejectedCandidates.length > 0) {
      for (const r of identity.rejectedCandidates.slice(0, 12)) {
        console.log("[agent-zhihu] rejected nickname", r);
      }
    }
    console.log("[agent-zhihu] identity resolved", {
      profileId,
      profileSlug: identity.profileSlug,
      displayName: identity.displayName,
      displayNameSource: identity.displayNameSource,
      displayNameVerified: identity.displayNameVerified,
    });
    return {
      identity,
      debug: {
        slug,
        slugSource: slugPick.source,
        navigatedUrl: navigatedProfileUrl,
        h1Found: profileHeaderDebug.h1Found,
        nameElFound: profileHeaderDebug.nameElFound,
        displayName: identity.displayName,
        displayNameSource: identity.displayNameSource,
      },
    };
  }

  /** @deprecated 使用 resolveZhihuIdentity */
  async collectAccountCandidates(
    page: Page,
    profileId?: string,
  ): Promise<{
    name: string | null;
    identity: ZhihuIdentityResolution;
  }> {
    const { identity } = await this.resolveZhihuIdentity(page, "valid", profileId);
    return { name: identity.displayName, identity };
  }

  async detectAccount(page: Page, profileId?: string): Promise<string | null> {
    const { name } = await this.collectAccountCandidates(page, profileId);
    return name;
  }

  /** 等待首页从登录页跳转或出现用户入口（不因 feed 慢判死刑） */
  async waitForZhihuSession(page: Page, timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const url = page.url();
      if (url.includes("zhihu.com") && !isLoginUrl(url, this.urls.loginUrlPattern)) {
        const hasUser = await page
          .locator('a[href*="/people/"], a[href*="/org/"], [class*="Avatar"]')
          .first()
          .count()
          .catch(() => 0);
        if (hasUser > 0) return;
      }
      await page.waitForTimeout(500);
    }
  }

  async checkZhihuLoginState(page: Page): Promise<ZhihuLoginCheck> {
    const url = page.url();

    if (isLoginUrl(url, this.urls.loginUrlPattern)) {
      return { loginRequired: true, reason: "登录态未生效，请重新打开登录窗口并在弹出页完成登录" };
    }

    const ui = await page.evaluate(() => {
      const root = document.querySelector("header") ?? document.body;
      const profileLinks = Array.from(root.querySelectorAll('a[href*="/people/"]'));
      const hasUserProfileLink = profileLinks.some(a => {
        const href = a.getAttribute("href") ?? "";
        const text = (a.textContent ?? "").trim();
        if (/开通|机构|登录|注册/.test(text)) return false;
        return /\/people\/[^/]+/.test(href) && text.length >= 2;
      });
      const hasAvatar =
        !!root.querySelector('header [class*="Avatar"] img[alt]') ||
        !!root.querySelector('header a[href*="/people/"] img');
      let hasLoginCta = false;
      for (const el of Array.from(root.querySelectorAll("a, button"))) {
        const t = (el.textContent ?? "").trim();
        if (/^登录$|^注册$|登录\/注册|立即登录|扫码登录|密码登录|验证码登录/.test(t)) {
          hasLoginCta = true;
        }
      }
      const bodyText = document.body?.innerText?.slice(0, 2000) ?? "";
      const looksLikeSignInForm = /获取短信验证码|获取语音验证码|扫码登录|密码登录/.test(bodyText);
      return { hasUserProfileLink, hasAvatar, hasLoginCta, looksLikeSignInForm };
    });

    if (ui.looksLikeSignInForm) {
      return { loginRequired: true, reason: "页面仍为知乎登录表单，请先完成登录" };
    }
    if (ui.hasUserProfileLink || ui.hasAvatar) {
      return { loginRequired: false, reason: "ok" };
    }
    if (ui.hasLoginCta) {
      return { loginRequired: true, reason: "页面仍显示登录/注册入口，登录态未生效" };
    }
    return { loginRequired: false, reason: "ok" };
  }

  override async openLoginHome(profileId: string): Promise<{ ok: boolean; message: string; url?: string }> {
    const account = requireAccount(profileId);
    console.log("[agent-zhihu] open login", { profileId, profilePath: account.profilePath });
    const context = await getOrLaunchContext(profileId, false);
    const page = context.pages().find(p => !p.isClosed()) ?? (await context.newPage());
    await page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    touchAccountOpened(profileId, "unknown");
    return {
      ok: true,
      message: "已打开知乎首页，请在弹出窗口中手动登录（登录后勿关窗口，再点检测账号）",
      url: page.url(),
    };
  }

  override async detectAccountSession(profileId: string): Promise<{
    ok: boolean;
    accountName: string | null;
    message: string;
    errorType?: string;
  }> {
    const account = requireAccount(profileId);
    console.log("[agent-zhihu] detect session", {
      profileId,
      profilePath: account.profilePath,
    });

    let context = getOpenContext(profileId);
    const reusedOpen = Boolean(context?.browser()?.isConnected());
    let launchedHeaded = false;

    try {
      if (!reusedOpen) {
        await closeContext(profileId);
        context = await getOrLaunchContext(profileId, false);
        launchedHeaded = true;
        console.log("[agent-zhihu] launched headed context for detect", { profileId });
      } else {
        console.log("[agent-zhihu] reuse open context (same profilePath)", {
          profileId,
          profilePath: account.profilePath,
        });
      }

      const page = context!.pages().find(p => !p.isClosed()) ?? (await context!.newPage());
      const beforeUrl = page.url();
      const needsGoto =
        !beforeUrl.includes("zhihu.com") || isLoginUrl(beforeUrl, this.urls.loginUrlPattern);
      if (needsGoto) {
        await page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      } else {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() =>
          page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 }),
        );
      }
      await this.waitForZhihuSession(page, reusedOpen ? 6000 : 10000);
      await page.waitForTimeout(reusedOpen ? 800 : 1500);

      const loginState = await this.checkZhihuLoginState(page);
      if (loginState.loginRequired) {
        const now = new Date().toISOString();
        const failUrl = page.url();
        updateAccount(profileId, {
          accountName: null,
          sessionStatus: "expired",
          lastCheckedAt: now,
          lastDetectMessage: loginState.reason,
        });
        console.warn("[agent-zhihu] detect failed", {
          reason: "login_required",
          url: failUrl,
          detail: loginState.reason,
        });
        return {
          ok: false,
          accountName: null,
          message: loginState.reason,
          errorType: "login_required",
        };
      }

      if (isLoginUrl(page.url(), this.urls.loginUrlPattern)) {
        const msg = "登录态未生效，请重新打开登录窗口并在弹出页完成登录";
        updateAccount(profileId, {
          accountName: null,
          sessionStatus: "expired",
          lastCheckedAt: new Date().toISOString(),
          lastDetectMessage: msg,
        });
        console.warn("[agent-zhihu] detect failed", { reason: "login_required", url: page.url() });
        return { ok: false, accountName: null, message: msg, errorType: "login_required" };
      }

      const { identity } = await this.resolveZhihuIdentity(page, "valid", profileId);
      const name = identity.displayName;
      const now = new Date().toISOString();

      if (!name || !identity.displayNameVerified || isBlockedZhihuNickname(name)) {
        const reason =
          name && isBlockedZhihuNickname(name)
            ? "已登录，但暂未识别真实昵称（已过滤 tab/导航/统计等非昵称文案）"
            : "已登录，但暂未识别真实昵称。可点击「重新检测」刷新；不影响发布。";
        updateAccount(profileId, {
          accountName: null,
          displayNameVerified: false,
          displayNameSource: "unknown",
          sessionStatus: "active",
          lastCheckedAt: now,
          lastDetectMessage: reason,
        });
        console.warn("[agent-zhihu] nickname pending", {
          url: page.url(),
          identity,
        });
        return {
          ok: true,
          accountName: null,
          message: reason,
        };
      }

      updateAccount(profileId, {
        accountName: name,
        displayNameVerified: true,
        displayNameSource: this.mapIdentitySourceForStorage(identity.displayNameSource),
        sessionStatus: "active",
        lastCheckedAt: now,
        lastDetectMessage: `检测成功：${name}`,
      });
      console.log("[agent-zhihu] detect success", { profileId, accountName: name });
      return { ok: true, accountName: name, message: `检测成功：${name}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isContextLost = /closed|Target page|context or browser/i.test(msg);
      const errorType = isContextLost ? "page_context_lost" : "account_not_detected";
      const message = isContextLost
        ? "浏览器窗口已关闭或上下文丢失，请重新打开登录窗口后再检测"
        : msg;
      updateAccount(profileId, {
        lastDetectMessage: message,
        lastCheckedAt: new Date().toISOString(),
      });
      console.warn("[agent-zhihu] detect failed", {
        reason: errorType,
        message,
        url: "n/a",
      });
      return { ok: false, accountName: null, message, errorType };
    } finally {
      // 检测后不关闭已打开的登录窗口，保证 Cookie 与同一 profilePath 可复用
      if (launchedHeaded && !reusedOpen) {
        /* 保留 headed context 供用户继续操作 */
      }
    }
  }

  protected titleSelectors(): string[] {
    return [
      'textarea[placeholder*="标题"]',
      'input[placeholder*="标题"]',
      'textarea[placeholder*="请输入标题"]',
      'input[placeholder*="请输入标题"]',
      ".WriteIndex-titleInput textarea",
      ".WriteIndex-titleInput input",
      ".PublishForm-titleInput textarea",
      ".PublishForm-titleInput input",
      '[data-za-detail-view-element_name="TitleArea"] textarea',
      '[data-za-detail-view-element_name="TitleArea"] input',
      ".Input-wrapper textarea",
      ".Input-wrapper input",
      ".Write-title textarea",
      ".Write-title input",
      '[class*="TitleInput"] textarea',
      '[class*="TitleInput"] input',
    ];
  }

  protected async waitForTitleInput(page: Page, timeoutMs = 16000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const sel of this.titleSelectors()) {
        const loc = page.locator(sel).first();
        if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return true;
      }
      await page.waitForTimeout(500);
    }
    return false;
  }

  /** 从任意页面直达专栏写作页（不再使用 creator / www.zhihu.com/write） */
  protected async tryEnterWriteEditorFromCreator(page: Page): Promise<boolean> {
    try {
      const response = await page.goto(ZHIHU_WRITE_TARGET_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1500);
      if (await this.isZhihuPage404(page, response)) return false;
      if (!this.writeUrlReady(page.url())) return false;
      return await this.waitForTitleInput(page, 12000);
    } catch {
      return false;
    }
  }

  protected contentSelectors(): string[] {
    return [
      ".DraftEditor-root [contenteditable='true']",
      ".public-DraftEditor-content",
      ".WriteIndex-editor [contenteditable='true']",
      ".WriteIndex-editor [contenteditable]",
      ".RichText-editor [contenteditable='true']",
      ".RichText [contenteditable='true']",
      "[contenteditable='true']",
      ".ProseMirror",
      ".notranslate.public-DraftEditor-content",
    ];
  }

  /** 写作页编辑器异步加载，轮询等待（禁止无编辑器判成功） */
  protected async waitForWriteEditor(page: Page, timeoutMs = 18000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.hasWriteEditor(page)) return true;
      await page.waitForTimeout(600);
    }
    return false;
  }

  protected async hasWriteEditor(page: Page): Promise<boolean> {
    for (const sel of this.titleSelectors()) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return true;
    }
    for (const sel of this.contentSelectors()) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return true;
    }
    if (
      (await page.locator(".WriteIndex-titleInput, .WriteIndex-editor, .DraftEditor-root, .RichText-editor").count()) > 0
    ) {
      return true;
    }
    return false;
  }

  /** 知乎正文：优先 Draft.js 编辑区，避免误填标题框 */
  protected async fillZhihuContent(page: Page, content: string): Promise<{ ok: boolean; selector?: string }> {
    const bodySelectors = [
      ".public-DraftEditor-content",
      ".DraftEditor-root .public-DraftEditor-content",
      ".WriteIndex-editor .public-DraftEditor-content",
      ".RichText-editor .public-DraftEditor-content",
    ];
    for (const sel of bodySelectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      try {
        await loc.click({ timeout: 5000 });
        await page.waitForTimeout(400);
        await page.keyboard.press("Meta+A").catch(() => page.keyboard.press("Control+A").catch(() => {}));
        await page.keyboard.type(content, { delay: 6 });
        return { ok: true, selector: sel };
      } catch {
        /* next */
      }
    }
    return fillFirstSelector(page, this.contentSelectors(), content, true);
  }

  private async zhihuEditorHasContent(page: Page): Promise<boolean> {
    for (const sel of [...this.titleSelectors(), ...this.contentSelectors()]) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      const value = await loc.inputValue().catch(() => "");
      const text = (value || (await loc.innerText().catch(() => ""))).replace(/\s+/g, " ").trim();
      if (text.length >= 2) return true;
    }
    return false;
  }

  /** 知乎专栏写作页草稿保存检测（覆盖 basePublisher 的窄匹配逻辑） */
  protected override async attemptSaveDraft(page: Page): Promise<{
    saved: boolean;
    draftUrl?: string;
    message?: string;
  }> {
    const DRAFT_BTN = /保存草稿|存草稿|保存为草稿|暂存/i;
    const SAVE_HINT = /保存于\s*\d{1,2}:\d{2}|自动保存|已保存/;

    const buttons = page.getByRole("button").filter({ hasText: DRAFT_BTN });
    for (let i = 0; i < (await buttons.count()); i += 1) {
      try {
        const btn = buttons.nth(i);
        if (await btn.isVisible({ timeout: 1200 })) {
          await btn.click({ timeout: 5000 });
          break;
        }
      } catch {
        /* next */
      }
    }

    let draftApiOk = false;
    const onResponse = (response: { url: () => string; status: () => number }) => {
      if (response.status() !== 200) return;
      const url = response.url();
      if (/\/api\/v4\/articles|\/draft/i.test(url)) draftApiOk = true;
    };
    page.on("response", onResponse);

    try {
      const pollDeadline = Date.now() + 12000;
      while (Date.now() < pollDeadline) {
        const url = page.url();
        if (/\/p\/\d+/i.test(url)) {
          return {
            saved: true,
            draftUrl: url.split("?")[0],
            message: "url_contains_article_id",
          };
        }

        const body = await page.locator("body").innerText().catch(() => "");
        if (SAVE_HINT.test(body)) {
          return { saved: true, draftUrl: url, message: "save_timestamp_or_autosave_hint" };
        }

        if (draftApiOk) {
          return { saved: true, draftUrl: url, message: "draft_or_articles_api_200" };
        }

        await page.waitForTimeout(500);
      }

      await page.waitForTimeout(3000);
      if (await this.zhihuEditorHasContent(page)) {
        return {
          saved: true,
          draftUrl: page.url(),
          message: "editor_content_present_after_wait",
        };
      }

      return { saved: false, message: "manual_required_no_save_evidence" };
    } finally {
      page.off("response", onResponse);
    }
  }

  protected async gotoZhihuWritePage(page: Page): Promise<{ ok: boolean; url: string; errorType?: ZhihuWritePageErrorType }> {
    const targetUrl = ZHIHU_WRITE_TARGET_URL;
    let response: Awaited<ReturnType<Page["goto"]>> = null;
    try {
      response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("[agent-zhihu] publish open_write", {
        step: "open_write",
        platform: "zhihu",
        targetUrl,
        actualUrl: page.url(),
        status: "failed",
        errorType: /timeout/i.test(msg) ? "page_load_timeout" : "write_page_not_found",
        message: msg,
      });
      return { ok: false, url: page.url(), errorType: "write_page_not_found" };
    }
    await page.waitForTimeout(1500);
    const actualUrl = page.url();
    if (await this.isZhihuPage404(page, response)) {
      console.log("[agent-zhihu] publish open_write", {
        step: "open_write",
        platform: "zhihu",
        targetUrl,
        actualUrl,
        status: "failed",
        errorType: "write_page_404",
        httpStatus: response?.status(),
      });
      return { ok: false, url: actualUrl, errorType: "write_page_404" };
    }
    if (isLoginUrl(actualUrl, this.urls.loginUrlPattern)) {
      return { ok: false, url: actualUrl, errorType: "login_required" };
    }
    const loginUi = await this.checkZhihuLoginState(page);
    if (loginUi.loginRequired) {
      return { ok: false, url: actualUrl, errorType: "session_expired" };
    }
    const onWrite = this.writeUrlReady(actualUrl);
    const hasEditor = await this.waitForWriteEditor(page, 18000);
    if (onWrite && hasEditor) {
      console.log("[agent-zhihu] publish open_write", {
        step: "open_write",
        platform: "zhihu",
        targetUrl,
        actualUrl,
        status: "ok",
      });
      return { ok: true, url: actualUrl };
    }
    const errorType = onWrite ? "editor_not_found" : "write_page_not_found";
    console.log("[agent-zhihu] publish open_write", {
      step: "open_write",
      platform: "zhihu",
      targetUrl,
      actualUrl,
      status: "failed",
      errorType,
    });
    await page.goto(ZHIHU_WRITE_HOME_FALLBACK, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const homeUrl = page.url();
    const homeLogin = await this.checkZhihuLoginState(page);
    if (!homeLogin.loginRequired && !isLoginUrl(homeUrl, this.urls.loginUrlPattern)) {
      return { ok: false, url: homeUrl, errorType: "manual_required" };
    }
    return { ok: false, url: homeUrl, errorType: "write_page_not_found" };
  }

  /** 填稿/发布前确保 page 未关闭，且仍在写作页或文章页；必要时恢复 tab 或重新打开写作页 */
  private async ensurePublishWritePage(
    context: BrowserContext,
    page: Page,
    logs: PublishStepLog[],
    phase: string,
  ): Promise<{ page: Page; ok: boolean; errorMessage?: string }> {
    let active = page;

    if (active.isClosed()) {
      logs.push(stepLog("publish_page", "failed", `${phase}: page_closed`));
      const recovered = context.pages().find(p => !p.isClosed());
      if (recovered) {
        active = recovered;
        logs.push(stepLog("publish_page", "ok", `${phase}: recovered_open_tab`));
      } else {
        active = await context.newPage();
        logs.push(stepLog("publish_page", "ok", `${phase}: opened_new_tab`));
      }
    }

    if (active.isClosed()) {
      return { page: active, ok: false, errorMessage: "浏览器页面已关闭且无法恢复" };
    }

    const url = active.url();
    const onWrite = this.writeUrlReady(url);
    const onArticle = /zhuanlan\.zhihu\.com\/p\/\d+/i.test(url) || /zhihu\.com\/p\/\d+/i.test(url);

    if (!onWrite && !onArticle) {
      logs.push(stepLog("publish_page", "skipped", `${phase}: left_write_page ${url}`));
      const nav = await this.gotoZhihuWritePage(active);
      if (!nav.ok) {
        return { page: active, ok: false, errorMessage: `无法回到写作页（${nav.url}）` };
      }
      logs.push(stepLog("publish_page", "ok", `${phase}: back_to_write ${nav.url}`));
    } else {
      logs.push(stepLog("publish_page", "ok", `${phase}: ${url.split("?")[0]}`));
    }

    if (active.isClosed()) {
      return { page: active, ok: false, errorMessage: "恢复写作页后页面仍已关闭" };
    }

    return { page: active, ok: true };
  }

  override async publish(task: LocalPublishTask): Promise<LocalPublishResult> {
    const logs: PublishStepLog[] = [];
    const profileId = task.localProfileId;
    const publishAction = task.action === "save_draft" ? "save_draft" : "publish";
    logs.push(stepLog("publish_action", "ok", publishAction));

    try {
      const context = await getOrLaunchContext(profileId, false);
      let page = context.pages().find(p => !p.isClosed()) ?? (await context.newPage());

      logs.push(stepLog("open_home", "ok", this.urls.homeUrl));
      await page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await this.waitForZhihuSession(page, 8000);
      await page.waitForTimeout(1000);

      if (isLoginUrl(page.url(), this.urls.loginUrlPattern)) {
        logs.push(stepLog("detect_account", "failed", "未登录"));
        updateAccount(profileId, { sessionStatus: "expired", lastCheckedAt: new Date().toISOString() });
        return {
          status: "session_expired",
          errorType: "login_required",
          errorMessage: "未登录或会话已过期，请先打开登录窗口手动登录",
          logs,
        };
      }

      const loginState = await this.checkZhihuLoginState(page);
      if (loginState.loginRequired) {
        logs.push(stepLog("detect_account", "failed", loginState.reason));
        updateAccount(profileId, { sessionStatus: "expired", lastCheckedAt: new Date().toISOString() });
        return {
          status: "session_expired",
          errorType: "login_required",
          errorMessage: loginState.reason,
          logs,
        };
      }

      const stored = getAccountByProfileId(profileId);
      const { identity, debug } = await this.resolveZhihuIdentity(page, "valid", profileId);
      logs.push(
        stepLog(
          "identity_debug",
          debug.slug ? "ok" : "failed",
          JSON.stringify({
            slug: debug.slug,
            slugSource: debug.slugSource,
            navigatedUrl: debug.navigatedUrl,
            h1Found: debug.h1Found,
            nameElFound: debug.nameElFound,
            displayName: debug.displayName,
            displayNameSource: debug.displayNameSource,
          }),
        ),
      );
      const pageName = identity.displayName;
      let name = pageName;
      if (
        stored?.accountName &&
        stored.sessionStatus === "active" &&
        task.expectedAccountName &&
        accountNamesMatch(task.expectedAccountName, stored.accountName)
      ) {
        name = stored.accountName;
        logs.push(stepLog("detect_account", "ok", `${name}（绑定账号）`));
      } else {
        logs.push(stepLog("detect_account", name ? "ok" : "failed", name ?? "未识别到昵称"));
      }

      if (!name) {
        if (stored?.sessionStatus === "active") {
          name = task.expectedAccountName?.trim() || "账号已登录";
          logs.push(stepLog("detect_account", "ok", "已登录，账号已登录，继续填稿"));
        } else {
          return {
            status: "failed",
            errorType: "account_not_detected",
            errorMessage: "未能检测到知乎昵称，请先检测账号",
            logs,
          };
        }
      }

      if (shouldBlockPublishForAccountNameMismatch(task.expectedAccountName, name)) {
        logs.push(stepLog("detect_account", "failed", "账号不一致"));
        return {
          status: "failed",
          errorType: "account_mismatch",
          errorMessage: `当前登录账号 ${pageName ?? name}，与任务账号 ${task.expectedAccountName} 不一致`,
          logs,
        };
      }
      if (
        isPendingPublishAccountName(task.expectedAccountName) &&
        name &&
        !accountNamesMatch(task.expectedAccountName, name)
      ) {
        logs.push(
          stepLog("detect_account", "ok", "账号已登录：已跳过昵称比对，按登录有效继续发布"),
        );
      }

      updateAccount(profileId, {
        accountName: name,
        sessionStatus: "active",
        lastCheckedAt: new Date().toISOString(),
        lastDetectMessage: `填稿前检测：${name}`,
      });

      page = await context.newPage();
      const writeNav = await this.gotoZhihuWritePage(page);
      if (!writeNav.ok) {
        if (writeNav.errorType === "manual_required") {
          logs.push(stepLog("open_write", "skipped", writeNav.url));
          return {
            status: "manual_required",
            errorType: "manual_confirm",
            errorMessage: "未能自动定位写作页，已打开知乎首页，请手动进入创作中心。",
            logs,
          };
        }
        logs.push(stepLog("open_write", "failed", writeNav.errorType ?? writeNav.url));
        updateAccount(profileId, { sessionStatus: "expired", lastDetectMessage: "写作页未就绪" });
        return {
          status: "failed",
          errorType: writeNav.errorType ?? "write_page_not_found",
          errorMessage:
            writeNav.errorType === "login_required"
              ? "打开写作页时跳转登录"
              : `未能打开知乎写作页（${writeNav.url}）`,
          logs,
        };
      }

      logs.push(stepLog("open_write", "ok", writeNav.url));
      touchAccountOpened(profileId, "active");

      if (!(await this.waitForTitleInput(page, 8000)) && page.url().includes("/creator")) {
        await this.tryEnterWriteEditorFromCreator(page);
      }

      const titleFill = await fillFirstSelector(page, this.titleSelectors(), task.title);
      logs.push(
        stepLog(
          "fill_title",
          titleFill.ok ? "ok" : "failed",
          titleFill.ok ? task.title.slice(0, 40) : "未找到标题输入框",
          titleFill.selector,
        ),
      );
      if (!titleFill.ok) {
        const contentProbe = await this.fillZhihuContent(page, task.content.slice(0, 80));
        if (contentProbe.ok) {
          logs.push(stepLog("fill_content", "ok", "正文部分填入（标题需人工）"));
        }
        return {
          status: "manual_required",
          errorType: "title_input_not_found",
          errorMessage: "已进入写作页但未定位标题框，请人工补标题并确认保存",
          logs,
        };
      }

      const beforeContent = await this.ensurePublishWritePage(context, page, logs, "before_fill_content");
      if (!beforeContent.ok) {
        return {
          status: "failed",
          errorType: "page_context_lost",
          errorMessage: beforeContent.errorMessage ?? "填正文前写作页不可用",
          logs,
        };
      }
      page = beforeContent.page;

      const contentFill = await this.fillZhihuContent(page, task.content);
      logs.push(
        stepLog(
          "fill_content",
          contentFill.ok ? "ok" : "failed",
          contentFill.ok ? `正文 ${task.content.length} 字` : "未找到正文编辑器",
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
      if (!this.writeUrlReady(page.url()) && !/zhuanlan\.zhihu\.com\/p\/\d+/i.test(page.url())) {
        logs.push(stepLog("publish_page", "failed", `after_fill_content_left_write_page ${page.url()}`));
        return {
          status: "manual_required",
          errorType: "write_page_left_after_fill",
          errorMessage: "知乎写作页在填入正文后离开，已停止自动点击发布，请在已打开窗口人工确认内容并发布",
          logs,
        };
      }

      const beforePublishFlow = await this.ensurePublishWritePage(context, page, logs, "before_publish_flow");
      if (!beforePublishFlow.ok) {
        return {
          status: "failed",
          errorType: "page_context_lost",
          errorMessage: beforePublishFlow.errorMessage ?? "发布前写作页不可用",
          logs,
        };
      }
      page = beforePublishFlow.page;

      const coverResult = await this.uploadZhihuCover(page, task);
      const coverHadPayload = coverResult.message !== "no_cover_payload";
      logs.push(
        stepLog(
          "upload_cover",
          coverResult.ok ? "ok" : coverHadPayload ? "failed" : "skipped",
          coverResult.message,
          coverResult.selector,
        ),
      );
      if (!coverResult.ok && coverHadPayload) {
        return {
          status: "manual_required",
          errorType: "cover_upload_failed",
          errorMessage: "封面上传失败，请手动在知乎编辑器中添加封面后发布",
          logs,
        };
      }

      if (publishAction === "save_draft") {
        const save = await this.attemptSaveDraft(page);
        logs.push(stepLog("save_draft", save.saved ? "ok" : "skipped", save.message));
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
          errorMessage: "已填入标题和正文，未检测到草稿保存证据，请在浏览器窗口人工确认保存",
          logs,
        };
      }

      const publishResult = await this.attemptPublishArticle(page);
      for (const subStep of publishResult.subSteps) {
        logs.push(subStep);
      }
      logs.push(
        stepLog(
          "publish_article",
          publishResult.published ? "ok" : "failed",
          publishResult.message,
        ),
      );

      if (publishResult.published && publishResult.publicUrl) {
        console.log("[agent-zhihu] publish success", {
          profileId,
          publicUrl: publishResult.publicUrl,
        });
        return {
          status: "completed",
          publicUrl: publishResult.publicUrl,
          logs,
        };
      }

      return {
        status: "failed",
        errorType: publishResult.errorType ?? "publish_failed",
        errorMessage: publishResult.message ?? "知乎发布失败",
        logs,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const msg = raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
      logs.push(stepLog("publish_flow", "failed", msg));
      return {
        status: "failed",
        errorType: "unknown",
        errorMessage: msg,
        logs,
      };
    }
  }

  override async openWritePageTest(profileId: string): Promise<ZhihuWritePageResult> {
    return this.openWritePageWithCandidates(profileId, "open_write_page_test");
  }

  /**
   * 模拟「关闭客户端 → 重启」：关闭 context 后用同一 profilePath 验证首页登录态与写作页。
   */
  async verifySessionReuseAndWritePage(profileId: string): Promise<ZhihuSessionReuseResult> {
    const acc = requireAccount(profileId);
    const profilePath = acc.profilePath;

    await closeContext(profileId);
    console.log("[agent-zhihu] session reuse: context closed (simulate agent restart)", { profileId, profilePath });

    const { readAccounts } = await import("../storage");
    const accountInJson = Boolean(readAccounts().accounts.find(a => a.profileId === profileId));

    let home: ZhihuSessionReuseResult["home"] = {
      ok: false,
      url: "",
      sessionStatus: "expired",
      message: "未检查",
    };
    let write: ZhihuWritePageResult = { ok: false, message: "未检查" };

    try {
      const context = await getOrLaunchContext(profileId, false);
      const page = context.pages().find(p => !p.isClosed()) ?? (await context.newPage());
      await page.goto(this.urls.homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await this.waitForZhihuSession(page, 8000);
      await page.waitForTimeout(1500);
      const homeUrl = page.url();
      const loginState = await this.checkZhihuLoginState(page);
      const sessionStatus = loginState.loginRequired ? "expired" : "active";
      home = {
        ok: !loginState.loginRequired,
        url: homeUrl,
        sessionStatus,
        errorType: loginState.loginRequired ? "session_expired" : undefined,
        message: loginState.loginRequired ? loginState.reason : "首页登录态有效",
      };
      updateAccount(profileId, {
        sessionStatus,
        lastCheckedAt: new Date().toISOString(),
        lastDetectMessage: home.message,
      });
      console.log("[agent-zhihu] session reuse home", home);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      home = {
        ok: false,
        url: "",
        sessionStatus: "expired",
        errorType: /timeout/i.test(msg) ? "page_load_timeout" : "session_expired",
        message: msg,
      };
    }

    if (home.ok) {
      write = await this.openWritePageTest(profileId);
    } else {
      write = {
        ok: false,
        message: "首页登录态无效，跳过写作页检测",
        errorType: "session_expired",
        hasEditor: false,
      };
    }
    console.log("[agent-zhihu] session reuse write", write);

    return { profileId, profilePath, accountInJson, home, write };
  }
}

export const zhihuPublisher = new ZhihuPublisher();

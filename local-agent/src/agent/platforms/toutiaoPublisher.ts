import type { Page } from "playwright";
import { BasePlatformPublisher } from "./basePublisher";

const SKIP = /头条|登录|注册|首页|logo|消息/i;

export class ToutiaoPublisher extends BasePlatformPublisher {
  readonly platform = "toutiao" as const;
  readonly urls = {
    homeUrl: "https://mp.toutiao.com/",
    writeUrl: "https://mp.toutiao.com/profile_v4/graphic/publish",
    loginUrlPattern: /login|passport|signin/i,
  };

  protected writeUrlReady(url: string): boolean {
    return url.includes("toutiao.com") && url.includes("publish");
  }

  async detectAccount(page: Page): Promise<string | null> {
    return page.evaluate(skipPattern => {
      const SKIP_RE = new RegExp(skipPattern, "i");
      function pick(text: string | null | undefined): string | null {
        const t = (text ?? "").trim();
        if (!t || t.length < 2 || t.length > 40) return null;
        if (SKIP_RE.test(t)) return null;
        return t;
      }
      const candidates: string[] = [];
      for (const el of Array.from(
        document.querySelectorAll('[class*="user"], [class*="name"], .user-name, .nickname, .author-name'),
      )) {
        const t = pick(el.textContent);
        if (t) candidates.push(t);
      }
      for (const el of Array.from(document.querySelectorAll("img[alt], [title], [aria-label]"))) {
        const t = pick(el.getAttribute("alt")) ?? pick(el.getAttribute("title"));
        if (t) candidates.push(t);
      }
      return candidates[0] ?? null;
    }, SKIP.source);
  }

  protected titleSelectors(): string[] {
    return [
      'textarea[placeholder*="标题"]',
      'textarea[placeholder*="请输入标题"]',
      ".title-wrapper textarea",
      ".publish-editor-title textarea",
      'input[placeholder*="标题"]',
    ];
  }

  protected contentSelectors(): string[] {
    return [
      ".ProseMirror",
      ".public-DraftEditor-content",
      '[contenteditable="true"]',
      ".editor-kit-container [contenteditable]",
    ];
  }

  protected async extraWritePageChecks(page: Page): Promise<string | null> {
    const frames = page.frames();
    let hasEditor = false;
    for (const frame of frames) {
      try {
        const count = await frame.locator(".ProseMirror, [contenteditable='true']").count();
        if (count > 0) hasEditor = true;
      } catch {
        /* cross-origin iframe */
      }
    }
    const mainCount = await page.locator(".ProseMirror, [contenteditable='true']").count();
    if (!hasEditor && mainCount === 0) {
      return "头条发布页可能在 iframe 内，若无法自动填写请人工操作";
    }
    return null;
  }
}

export const toutiaoPublisher = new ToutiaoPublisher();

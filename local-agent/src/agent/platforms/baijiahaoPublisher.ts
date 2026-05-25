import type { Page } from "playwright";
import { BasePlatformPublisher } from "./basePublisher";

const SKIP = /百度|百家号|登录|注册|首页|logo/i;

export class BaijiahaoPublisher extends BasePlatformPublisher {
  readonly platform = "baijiahao" as const;
  readonly urls = {
    homeUrl: "https://baijiahao.baidu.com/",
    writeUrl: "https://baijiahao.baidu.com/builder/rc/edit?type=news",
    loginUrlPattern: /login|passport|signin/i,
  };

  protected writeUrlReady(url: string): boolean {
    return url.includes("baijiahao.baidu.com") && (url.includes("edit") || url.includes("builder"));
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
      for (const sel of [
        '[class*="user-name"]',
        '[class*="account"]',
        ".cheetah-user-name",
        ".user-info",
      ]) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const t = pick(el.textContent);
          if (t) candidates.push(t);
        }
      }
      for (const el of Array.from(document.querySelectorAll("img[alt], [title]"))) {
        const t = pick(el.getAttribute("alt")) ?? pick(el.getAttribute("title"));
        if (t) candidates.push(t);
      }
      return candidates[0] ?? null;
    }, SKIP.source);
  }

  protected titleSelectors(): string[] {
    return [
      'textarea[placeholder*="标题"]',
      'input[placeholder*="标题"]',
      "#title-textarea",
      ".cheetah-input input",
      ".article-title input",
    ];
  }

  protected contentSelectors(): string[] {
    return [
      ".ProseMirror",
      '[contenteditable="true"]',
      ".editor-content",
      "#editor",
      ".public-DraftEditor-content",
    ];
  }
}

export const baijiahaoPublisher = new BaijiahaoPublisher();

import type { Page } from "playwright";
import { BasePlatformPublisher } from "./basePublisher";

const SKIP = /网易|登录|注册|首页|消息|设置|logo|退出/i;

/** 网易号：本轮仅账号绑定与登录检测，自动发布待接入 */
export class NeteasePublisher extends BasePlatformPublisher {
  readonly platform = "netease" as const;
  readonly urls = {
    homeUrl: "https://mp.163.com/",
    writeUrl: "https://mp.163.com/subscribe/subscribe",
    loginUrlPattern: /login|passport|signin/i,
  };

  protected writeUrlReady(url: string): boolean {
    return url.includes("163.com") && (url.includes("subscribe") || url.includes("mp"));
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
        document.querySelectorAll('[class*="user"], [class*="nick"], [class*="name"], .user-name, .nickname'),
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
    return ['input[placeholder*="标题"]', "#title", ".title-input input"];
  }

  protected contentSelectors(): string[] {
    return [".ql-editor", '[contenteditable="true"]', "textarea"];
  }
}

export const neteasePublisher = new NeteasePublisher();

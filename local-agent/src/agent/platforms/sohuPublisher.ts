import type { Page } from "playwright";
import { BasePlatformPublisher } from "./basePublisher";

const SKIP = /搜狐|登录|注册|首页|消息|设置|logo/i;

export class SohuPublisher extends BasePlatformPublisher {
  readonly platform = "sohu" as const;
  readonly urls = {
    homeUrl: "https://mp.sohu.com/",
    writeUrl: "https://mp.sohu.com/mpfe/v3/submit",
    loginUrlPattern: /login|passport|signin/i,
  };

  protected writeUrlReady(url: string): boolean {
    return url.includes("sohu.com") && (url.includes("submit") || url.includes("mpfe"));
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
    return [
      'input[placeholder*="标题"]',
      'textarea[placeholder*="标题"]',
      ".title-input input",
      ".article-title input",
      "#title",
    ];
  }

  protected contentSelectors(): string[] {
    return [".ql-editor", ".ProseMirror", '[contenteditable="true"]', ".editor-content", "textarea.content"];
  }

  protected async extraWritePageChecks(page: Page): Promise<string | null> {
    const text = await page.locator("body").innerText().catch(() => "");
    if (/请选择分类|选择栏目|请选择频道/.test(text)) {
      return "搜狐号可能需要先选择分类/栏目，请人工补全";
    }
    return null;
  }
}

export const sohuPublisher = new SohuPublisher();

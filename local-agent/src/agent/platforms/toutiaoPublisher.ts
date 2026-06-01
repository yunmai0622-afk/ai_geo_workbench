import type { Page } from "playwright";
import {
  BasePlatformPublisher,
  type LocalPublishResult,
  type LocalPublishTask,
} from "./basePublisher";
import {
  attemptMpPublishArticle,
  executeMpPublishTask,
  fillFirstSelectorInPageOrFrames,
  type MpPublishArticleConfig,
} from "./mpPublishExtensions";

const SKIP = /头条|登录|注册|首页|logo|消息/i;

/** 头条号发布按钮备选（主文档；iframe 内编辑器单独 fill） */
export const TOUTIAO_PUBLISH_BUTTON_SELECTORS = [
  'button:has-text("发布")',
  '.publish-btn',
  '[class*="publish-button"]',
  '[class*="footer"] button:has-text("发布")',
  'getByRole("button", { name: /^发布$|^发布文章$|^提交$/ })',
] as const;

function extractToutiaoPublicUrl(url: string): string | null {
  const article =
    url.match(/https?:\/\/www\.toutiao\.com\/article\/\d+/i) ??
    url.match(/https?:\/\/www\.toutiao\.com\/item\/\d+/i) ??
    url.match(/https?:\/\/m\.toutiao\.com\/article\/\d+/i);
  return article ? article[0] : null;
}

const TOUTIAO_MP_CONFIG: MpPublishArticleConfig = {
  platformTag: "toutiao",
  publishButtonPattern: /^发布$|^发布文章$|^提交$/,
  publishButtonSkip: /草稿|预览|取消|删除|保存|存草稿|定时/i,
  toolbarSelectorHints: [
    ".publish-footer",
    '[class*="publish"]',
    '[class*="footer"]',
    "header",
    '[class*="submit"]',
  ],
  confirmDialogText: /发布|确认|封面|原创/i,
  confirmButtonPattern: /^确认发布$|^发布$|^发布文章$|^提交$|^确定$/,
  successTextPattern: /发布成功|提交成功|文章已发布/,
  publishErrorPattern:
    /发布失败|请上传封面|请添加封面|缺少封面|内容不符合|违规|审核未通过|再试一次|操作失败/i,
  extractPublicUrl: extractToutiaoPublicUrl,
  skipCover: true,
  softWritePageWarnings: true,
  fillTitle: (page, title, selectors) => fillFirstSelectorInPageOrFrames(page, selectors, title),
  fillContent: (page, content, selectors) => fillFirstSelectorInPageOrFrames(page, selectors, content),
};

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

  async attemptPublishArticle(page: Page) {
    return attemptMpPublishArticle(page, TOUTIAO_MP_CONFIG);
  }

  override async publish(task: LocalPublishTask): Promise<LocalPublishResult> {
    return executeMpPublishTask(
      {
        titleSelectors: this.titleSelectors(),
        contentSelectors: this.contentSelectors(),
        writeUrlReady: url => this.writeUrlReady(url),
        detectAccount: page => this.detectAccount(page),
        extraWritePageChecks: page => this.extraWritePageChecks(page),
        attemptSaveDraft: page => this.attemptSaveDraft(page),
        urls: this.urls,
      },
      task,
      TOUTIAO_MP_CONFIG,
    );
  }
}

export const toutiaoPublisher = new ToutiaoPublisher();

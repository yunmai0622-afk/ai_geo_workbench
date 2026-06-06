import type { Page } from "playwright";
import { detectMpPlatformNickname } from "./mpAccountNicknameDetect";
import {
  BasePlatformPublisher,
  fillFirstSelector,
  type LocalPublishResult,
  type LocalPublishTask,
} from "./basePublisher";
import {
  attemptMpPublishArticle,
  executeMpPublishTask,
  type MpPublishArticleConfig,
} from "./mpPublishExtensions";

/** 头条号发布按钮备选（主文档 Playwright 直操编辑器，不依赖跨域 iframe） */
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
    return detectMpPlatformNickname(page, "toutiao");
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
      ".editor-kit-container [contenteditable='true']",
      ".publish-editor [contenteditable='true']",
      '[contenteditable="true"]',
    ];
  }

  protected async waitForWriteEditor(page: Page, timeoutMs = 16000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.hasWriteEditor(page)) return true;
      await page.waitForTimeout(500);
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
    return false;
  }

  /** 标题：主文档 fill（与搜狐/百家号一致，不走 iframe） */
  protected async fillToutiaoTitle(
    page: Page,
    title: string,
    selectors: string[],
  ): Promise<{ ok: boolean; selector?: string }> {
    return fillFirstSelector(page, selectors, title, true);
  }

  /** 正文：优先 ProseMirror / Draft 区点击 + 键盘输入，避免误填标题 */
  protected async fillToutiaoContent(
    page: Page,
    content: string,
    selectors: string[],
  ): Promise<{ ok: boolean; selector?: string }> {
    const bodySelectors = [
      ".publish-editor .ProseMirror",
      ".ProseMirror",
      ".public-DraftEditor-content",
      ".editor-kit-container [contenteditable='true']",
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
    return fillFirstSelector(page, selectors, content, true);
  }

  protected async extraWritePageChecks(page: Page): Promise<string | null> {
    const ready = await this.waitForWriteEditor(page, 12000);
    if (!ready) {
      return "头条发布页编辑器未就绪，请确认已进入图文发布页并刷新后重试";
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
      {
        ...TOUTIAO_MP_CONFIG,
        fillTitle: (page, title, selectors) => this.fillToutiaoTitle(page, title, selectors),
        fillContent: (page, content, selectors) => this.fillToutiaoContent(page, content, selectors),
      },
    );
  }
}

export const toutiaoPublisher = new ToutiaoPublisher();

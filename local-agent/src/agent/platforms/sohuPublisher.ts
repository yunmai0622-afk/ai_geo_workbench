import type { Page } from "playwright";
import {
  BasePlatformPublisher,
  type LocalPublishResult,
  type LocalPublishTask,
} from "./basePublisher";
import { detectMpPlatformNickname } from "./mpAccountNicknameDetect";
import {
  attemptMpPublishArticle,
  executeMpPublishTask,
  type MpPublishArticleConfig,
  uploadPlatformCover,
} from "./mpPublishExtensions";

/** 搜狐号写作页发布按钮备选：底部/顶部「发布」「发布文章」 */
export const SOHU_PUBLISH_BUTTON_SELECTORS = [
  'button:has-text("发布")',
  'button:has-text("发布文章")',
  '.publish-btn',
  '[class*="publish"] button',
  'getByRole("button", { name: /^发布$|^发布文章$|^提交$/ })',
] as const;

function extractSohuPublicUrl(url: string): string | null {
  const article =
    url.match(/https?:\/\/www\.sohu\.com\/a\/\d+[^\s?#]*/i) ??
    url.match(/https?:\/\/m\.sohu\.com\/a\/\d+[^\s?#]*/i);
  if (article) return article[0];
  if (/mp\.sohu\.com/.test(url) && /article|content|preview/i.test(url)) {
    return url.split("?")[0];
  }
  return null;
}

const SOHU_MP_CONFIG: MpPublishArticleConfig = {
  platformTag: "sohu",
  publishButtonPattern: /^发布$|^发布文章$|^提交$/,
  publishButtonSkip: /草稿|预览|取消|删除|保存|存草稿|定时/i,
  toolbarSelectorHints: [
    ".publish-btn",
    '[class*="publish"]',
    '[class*="footer"]',
    '[class*="toolbar"]',
    "header",
  ],
  confirmDialogText: /发布|确认|分类|栏目|封面/i,
  confirmButtonPattern: /^确认发布$|^发布$|^发布文章$|^提交$|^确定$/,
  successTextPattern: /发布成功|提交成功|文章发布成功|发表成功/,
  publishErrorPattern:
    /发布失败|请上传封面|请选择分类|选择栏目|请选择频道|内容不符合|违规|审核未通过|再试一次|操作失败/i,
  extractPublicUrl: extractSohuPublicUrl,
  softWritePageWarnings: true,
  coverTriggerPattern: /上传封面|添加封面|更换封面|封面图/i,
  coverFileInputSelectors: [
    'input[type="file"][accept*="image"]',
    '[class*="cover"] input[type="file"]',
    'input[type="file"]',
  ],
};

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
    return detectMpPlatformNickname(page, "sohu");
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

  async attemptPublishArticle(page: Page) {
    return attemptMpPublishArticle(page, SOHU_MP_CONFIG);
  }

  async uploadCover(page: Page, task: LocalPublishTask) {
    return uploadPlatformCover(page, task, SOHU_MP_CONFIG);
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
      SOHU_MP_CONFIG,
    );
  }
}

export const sohuPublisher = new SohuPublisher();

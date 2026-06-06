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

/** 网易号写作页发布按钮备选：底部/顶部「发布」「立即发布」 */
export const NETEASE_PUBLISH_BUTTON_SELECTORS = [
  'button:has-text("发布")',
  'button:has-text("立即发布")',
  ".publish-btn",
  '[class*="publish"] button',
  'getByRole("button", { name: /^发布$|^立即发布$|^提交$/ })',
] as const;

function extractNeteasePublicUrl(url: string): string | null {
  const article =
    url.match(/https?:\/\/www\.163\.com\/dy\/article\/[A-Z0-9]+\.html/i) ??
    url.match(/https?:\/\/c\.m\.163\.com\/news\/a\/[A-Z0-9]+\.html/i) ??
    url.match(/https?:\/\/m\.163\.com\/news\/article\/[A-Z0-9]+\.html/i);
  if (article) return article[0];
  if (/mp\.163\.com/.test(url) && /article|preview|content|subscribe/i.test(url)) {
    return url.split("?")[0];
  }
  return null;
}

const NETEASE_MP_CONFIG: MpPublishArticleConfig = {
  platformTag: "netease",
  publishButtonPattern: /^发布$|^立即发布$|^提交$/,
  publishButtonSkip: /草稿|预览|取消|删除|保存|存草稿|定时/i,
  toolbarSelectorHints: [
    ".publish-btn",
    '[class*="publish"]',
    '[class*="toolbar"]',
    '[class*="footer"]',
    '[class*="submit"]',
    "header",
  ],
  confirmDialogText: /发布|确认|定时|原创|封面|分类/i,
  confirmButtonPattern: /^确认发布$|^发布$|^立即发布$|^提交$|^确定$/,
  successTextPattern: /发布成功|提交成功|文章发布成功|发表成功|发布完成/,
  publishErrorPattern:
    /发布失败|请上传封面|请添加封面|缺少封面|请选择分类|内容不符合|违规|审核未通过|再试一次|操作失败/i,
  extractPublicUrl: extractNeteasePublicUrl,
  softWritePageWarnings: true,
  coverTriggerPattern: /上传封面|添加封面|更换封面|封面图|设置封面/i,
  coverFileInputSelectors: [
    'input[type="file"][accept*="image"]',
    '[class*="cover"] input[type="file"]',
    '[class*="Cover"] input[type="file"]',
    'input[type="file"]',
  ],
};

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
    return detectMpPlatformNickname(page, "netease");
  }

  protected titleSelectors(): string[] {
    return [
      'input[placeholder*="标题"]',
      'textarea[placeholder*="标题"]',
      "#title",
      ".title-input input",
      ".article-title input",
    ];
  }

  protected contentSelectors(): string[] {
    return [".ql-editor", ".ProseMirror", '[contenteditable="true"]', "textarea"];
  }

  protected async extraWritePageChecks(page: Page): Promise<string | null> {
    const text = await page.locator("body").innerText().catch(() => "");
    if (/请选择分类|选择栏目|请选择频道/.test(text)) {
      return "网易号可能需要先选择分类/栏目，请人工补全";
    }
    return null;
  }

  async attemptPublishArticle(page: Page) {
    return attemptMpPublishArticle(page, NETEASE_MP_CONFIG);
  }

  async uploadCover(page: Page, task: LocalPublishTask) {
    return uploadPlatformCover(page, task, NETEASE_MP_CONFIG);
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
      NETEASE_MP_CONFIG,
    );
  }
}

export const neteasePublisher = new NeteasePublisher();

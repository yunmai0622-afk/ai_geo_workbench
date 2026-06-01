import type { Page } from "playwright";
import {
  BasePlatformPublisher,
  type LocalPublishResult,
  type LocalPublishTask,
} from "./basePublisher";
import {
  attemptMpPublishArticle,
  executeMpPublishTask,
  type MpPublishArticleConfig,
  uploadPlatformCover,
} from "./mpPublishExtensions";

const SKIP = /百度|百家号|登录|注册|首页|logo/i;

/** 百家号写作页发布按钮备选：cheetah 主按钮 + role=button 文案「发布」 */
export const BAIJIAHAO_PUBLISH_BUTTON_SELECTORS = [
  'button:has-text("发布")',
  '.cheetah-button-primary:has-text("发布")',
  '[class*="publish"] button:has-text("发布")',
  '[class*="toolbar"] button:has-text("发布")',
  'getByRole("button", { name: /^发布$|^立即发布$|^发表$/ })',
] as const;

function extractBaijiahaoPublicUrl(url: string): string | null {
  const direct =
    url.match(/https?:\/\/baijiahao\.baidu\.com\/s\?id=[a-zA-Z0-9_]+/i) ??
    url.match(/https?:\/\/mbd\.baidu\.com\/newspage\/data\/[a-zA-Z0-9_]+/i);
  return direct ? direct[0] : null;
}

const BAIJIAHAO_MP_CONFIG: MpPublishArticleConfig = {
  platformTag: "baijiahao",
  publishButtonPattern: /^发布$|^立即发布$|^发表$/,
  publishButtonSkip: /草稿|预览|取消|删除|保存|存草稿|定时/i,
  toolbarSelectorHints: [
    ".cheetah-button-group",
    '[class*="publish"]',
    '[class*="toolbar"]',
    '[class*="footer"]',
    ".op-btn-outter",
  ],
  confirmDialogText: /发布|确认|定时|原创|封面/i,
  confirmButtonPattern: /^确认发布$|^发布$|^立即发布$|^发表$|^确定$/,
  successTextPattern: /发布成功|发表成功|提交成功|文章已发布/,
  publishErrorPattern:
    /发布失败|请上传封面|请添加封面|缺少封面|选择封面|内容不符合|违规|审核未通过|再试一次|操作失败/i,
  extractPublicUrl: extractBaijiahaoPublicUrl,
  coverTriggerPattern: /上传封面|添加封面|更换封面|封面图|设置封面/i,
  coverFileInputSelectors: [
    'input[type="file"][accept*="image"]',
    '[class*="cover"] input[type="file"]',
    ".cheetah-upload input[type='file']",
    'input[type="file"]',
  ],
};

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

  async attemptPublishArticle(page: Page) {
    return attemptMpPublishArticle(page, BAIJIAHAO_MP_CONFIG);
  }

  async uploadCover(page: Page, task: LocalPublishTask) {
    return uploadPlatformCover(page, task, BAIJIAHAO_MP_CONFIG);
  }

  override async publish(task: LocalPublishTask): Promise<LocalPublishResult> {
    return executeMpPublishTask(
      {
        titleSelectors: this.titleSelectors(),
        contentSelectors: this.contentSelectors(),
        writeUrlReady: url => this.writeUrlReady(url),
        detectAccount: page => this.detectAccount(page),
        attemptSaveDraft: page => this.attemptSaveDraft(page),
        urls: this.urls,
      },
      task,
      BAIJIAHAO_MP_CONFIG,
    );
  }
}

export const baijiahaoPublisher = new BaijiahaoPublisher();

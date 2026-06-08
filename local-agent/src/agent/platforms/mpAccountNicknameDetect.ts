import type { Page } from "playwright";

export type MpNicknamePlatform = "sohu" | "baijiahao" | "toutiao" | "netease";

/** 各平台首页昵称 DOM 选择器（Playwright page.evaluate 内使用） */
export const MP_NICKNAME_DOM_SELECTORS: Record<MpNicknamePlatform, readonly string[]> = {
  sohu: [
    ".user-name",
    '[class*="nickname"]',
    '[class*="user-name"]',
    '[class*="userNick"]',
    '[class*="userName"]',
    '[class*="nick"]',
    '[class*="user"] [class*="name"]',
    ".nickname",
  ],
  baijiahao: [
    ".user-name",
    '[class*="userName"]',
    '[class*="user-name"]',
    ".cheetah-user-name",
    '[class*="cheetah"] [class*="name"]',
    '[class*="header"] [class*="name"]',
    ".author-name",
    '[class*="account-name"]',
    '[class*="account"] [class*="name"]',
    ".user-info",
  ],
  toutiao: [
    ".user-name",
    '[class*="username"]',
    '[class*="user-name"]',
    '[class*="author-name"]',
    ".nickname",
    '[class*="nick"]',
    '[class*="user"] [class*="name"]',
    ".author-name",
  ],
  netease: [
    ".user-name",
    '[class*="nickname"]',
    '[class*="user-name"]',
    '[class*="nick"]',
    '[class*="userName"]',
    '[class*="user"] [class*="name"]',
    ".nickname",
  ],
};

const MP_NICKNAME_SKIP_PATTERN: Record<MpNicknamePlatform, string> = {
  sohu: "搜狐|登录|注册|首页|消息|设置|logo",
  baijiahao: "百度|百家号|登录|注册|首页|logo|创作中心|内容管理",
  toutiao: "头条|登录|注册|首页|消息|设置|logo",
  netease: "网易|登录|注册|首页|消息|设置|logo",
};

export async function detectMpPlatformNickname(
  page: Page,
  platform: MpNicknamePlatform,
): Promise<string | null> {
  const selectors = MP_NICKNAME_DOM_SELECTORS[platform];
  const skipPattern = MP_NICKNAME_SKIP_PATTERN[platform];
  const includeJson = platform === "baijiahao" || platform === "toutiao";

  return page.evaluate(
    ({ selectorList, skip, withJson }) => {
      const SKIP_RE = new RegExp(skip, "i");
      const candidates: string[] = [];

      function push(text: string | null | undefined) {
        const t = (text ?? "").trim().replace(/\s+/g, " ");
        if (!t || t.length < 2 || t.length > 40) return;
        if (SKIP_RE.test(t)) return;
        candidates.push(t);
      }

      for (const sel of selectorList) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          push(el.textContent);
        }
      }

      for (const el of Array.from(document.querySelectorAll("img[alt], [title], [aria-label]"))) {
        push(el.getAttribute("alt"));
        push(el.getAttribute("title"));
        push(el.getAttribute("aria-label"));
      }

      if (withJson) {
        const keys = [
          "userName",
          "user_name",
          "username",
          "authorName",
          "author_name",
          "nick_name",
          "nickname",
          "display_name",
          "displayName",
        ];
        const scanText = (text: string) => {
          for (const key of keys) {
            const re = new RegExp(`"${key}"\\s*:\\s*"([^"]{2,40})"`, "g");
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
              const t = (m[1] ?? "").trim();
              if (!t || t.length < 2 || t.length > 40 || SKIP_RE.test(t)) continue;
              candidates.push(t);
            }
          }
        };
        for (const script of Array.from(document.querySelectorAll("script"))) {
          const text = script.textContent ?? "";
          if (text.length > 40) scanText(text);
        }
        try {
          const w = window as unknown as Record<string, unknown>;
          for (const stateKey of ["__INITIAL_STATE__", "__NUXT__", "initialState", "pageData"]) {
            const state = w[stateKey];
            if (state) scanText(JSON.stringify(state));
          }
        } catch {
          /* ignore */
        }
      }

      return candidates[0] ?? null;
    },
    { selectorList: selectors, skip: skipPattern, withJson: includeJson },
  );
}

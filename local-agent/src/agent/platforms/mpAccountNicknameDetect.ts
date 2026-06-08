import type { Page } from "playwright";

export type MpNicknamePlatform = "sohu" | "baijiahao" | "toutiao" | "netease";

/** 昵称识别失败时的客户端/Web 占位文案前缀 */
export const MP_PLATFORM_PENDING_LABEL: Record<MpNicknamePlatform, string> = {
  sohu: "搜狐号账号（昵称待识别）",
  baijiahao: "百家号账号（昵称待识别）",
  toutiao: "头条号账号（昵称待识别）",
  netease: "网易号账号（昵称待识别）",
};

/** 必须过滤的无效昵称（精确匹配，忽略大小写） */
export const MP_INVALID_NICKNAME_EXACT = [
  "账号环境",
  "创作者中心",
  "发布平台",
  "个人中心",
  "登录",
  "未登录",
  "进入发布页",
  "搜狐号",
  "百家号",
  "头条号",
  "网易号",
  "昵称待识别",
  "账号已登录",
  "首页",
  "消息",
  "设置",
  "logo",
  "创作中心",
  "内容管理",
  "发布",
  "退出",
  "退出登录",
] as const;

/** 仅整串等于平台名时视为无效（避免误杀含平台字的真实昵称） */
const MP_PLATFORM_LABEL_EXACT: Record<MpNicknamePlatform, readonly string[]> = {
  sohu: ["搜狐", "搜狐号", "sohu"],
  baijiahao: ["百度", "百家号", "baijiahao"],
  toutiao: ["头条", "头条号", "toutiao"],
  netease: ["网易", "网易号", "netease"],
};

/** 高优先级 DOM：账号中心 / 用户菜单 / 头像旁昵称 */
export const MP_NICKNAME_PRIORITY_DOM_SELECTORS: Record<MpNicknamePlatform, readonly string[]> = {
  sohu: [
    ".user-info-name",
    ".header-user-name",
    '[class*="header-user"] [class*="name"]',
    '[class*="user-center"] [class*="name"]',
    '[class*="account-name"]',
    '[class*="avatar"] + [class*="name"]',
    '[class*="user-info"] [class*="nick"]',
    '.mp-header [class*="nick"]',
    '[class*="mp-user"] [class*="name"]',
    '[class*="username"]',
    ".user-name-text",
  ],
  baijiahao: [
    ".cheetah-user-name",
    ".user-name",
    '[class*="userName"]',
    '[class*="user-name"]',
    '[class*="header"] [class*="user"] [class*="name"]',
    '[class*="account-name"]',
    ".author-name",
    '[class*="cheetah"] [class*="name"]',
    ".user-info .name",
    ".userinfo-name",
  ],
  toutiao: [
    ".user-info .name",
    '[class*="user-info-name"]',
    '[class*="account-name"]',
    '[class*="author-name"]',
    ".byte-menu-user-name",
    '[class*="header"] [class*="username"]',
    '[class*="avatar"] + span',
    ".nickname",
    '[class*="name-text"]',
    '[class*="auth-info"] [class*="name"]',
    ".auth-avator-name",
    '[class*="user-name-text"]',
  ],
  netease: [
    ".user-info-name",
    '[class*="header-user"] [class*="name"]',
    '[class*="account-name"]',
  ],
};

/** 各平台首页昵称 DOM 选择器（通用 fallback） */
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
    '[class*="profile"] [class*="name"]',
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
    '[class*="userinfo"] [class*="name"]',
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

/** 首页未识别时尝试的创作者中心 URL（仅用于昵称检测，不影响发布） */
export const MP_NICKNAME_FALLBACK_URLS: Partial<Record<MpNicknamePlatform, readonly string[]>> = {
  sohu: ["https://mp.sohu.com/mpfe/v3/main", "https://mp.sohu.com/mpfe/v3/home"],
  baijiahao: [
    "https://baijiahao.baidu.com/builder/rc/home",
    "https://baijiahao.baidu.com/builder/app/home",
  ],
  toutiao: [
    "https://mp.toutiao.com/profile_v4/index",
    "https://mp.toutiao.com/profile_v4/graphic/publish",
  ],
};

export const MP_NICKNAME_STORAGE_KEY_HINTS_BY_PLATFORM: Partial<
  Record<MpNicknamePlatform, readonly string[]>
> = {
  sohu: ["sohu", "mp_user", "mpuser", "author"],
  baijiahao: ["bjh", "baidu", "cheetah", "author", "builder"],
  toutiao: ["toutiao", "tt_", "byte", "author", "mp_user", "media"],
};

export const MP_NICKNAME_JSON_KEYS = [
  "userName",
  "user_name",
  "username",
  "authorName",
  "author_name",
  "nick_name",
  "nickname",
  "display_name",
  "displayName",
  "name",
  "accountName",
  "account_name",
  "profileName",
  "profile_name",
  "creatorName",
  "creator_name",
] as const;

export const MP_NICKNAME_STORAGE_KEY_HINTS = [
  "userinfo",
  "user_info",
  "accountinfo",
  "account_info",
  "authorinfo",
  "author_info",
  "creatorinfo",
  "creator_info",
  "profile",
  "bjh_user",
  "bjhuser",
] as const;

const MP_NICKNAME_JSON_WRAPPER_KEYS = [
  "data",
  "result",
  "payload",
  "info",
  "body",
  "userInfo",
  "user_info",
  "accountInfo",
  "account_info",
] as const;

const MP_NICKNAME_WINDOW_STATE_KEYS = [
  "__INITIAL_STATE__",
  "__NUXT__",
  "initialState",
  "pageData",
  "__BJH__INITIAL_STATE__",
  "pageMeta",
  "userInfo",
  "accountInfo",
] as const;

const MAX_NICKNAME_LEN = 40;
const MAX_TITLE_NICKNAME_LEN = 24;

export function normalizeMpNicknameCandidate(raw: string | null | undefined): string | null {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length < 2 || t.length > MAX_NICKNAME_LEN) return null;
  return t;
}

export function isInvalidMpNickname(text: string | null | undefined, platform: MpNicknamePlatform): boolean {
  const t = normalizeMpNicknameCandidate(text);
  if (!t) return true;
  const lower = t.toLowerCase();
  for (const word of MP_INVALID_NICKNAME_EXACT) {
    if (t === word || lower === word.toLowerCase()) return true;
  }
  for (const label of MP_PLATFORM_LABEL_EXACT[platform]) {
    if (t === label || lower === label.toLowerCase()) return true;
  }
  if (/登录|注册|退出|未登录|进入发布页|创作者中心|发布平台|个人中心|账号环境/i.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/（昵称待识别）$|（账号已登录）$/.test(t)) return true;
  return false;
}

export function pickFirstValidMpNickname(
  candidates: readonly (string | null | undefined)[],
  platform: MpNicknamePlatform,
): string | null {
  const seen = new Set<string>();
  for (const raw of candidates) {
    const t = normalizeMpNicknameCandidate(raw);
    if (!t || isInvalidMpNickname(t, platform)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    return t;
  }
  return null;
}

export function resolveMpAccountDisplayLabel(
  platform: MpNicknamePlatform,
  nickname: string | null | undefined,
): string {
  const hit = pickFirstValidMpNickname([nickname], platform);
  return hit ?? MP_PLATFORM_PENDING_LABEL[platform];
}

export function parseNicknameFromPageTitle(title: string | null | undefined, platform: MpNicknamePlatform): string | null {
  const raw = (title ?? "").trim();
  if (!raw || raw.length > 80) return null;
  const parts = raw
    .split(/[-–—|｜·]/)
    .map(p => p.trim())
    .filter(Boolean);
  const candidates: string[] = [];
  for (const part of parts) {
    if (part.length > MAX_TITLE_NICKNAME_LEN) continue;
    candidates.push(part);
  }
  if (parts.length === 1 && raw.length <= MAX_TITLE_NICKNAME_LEN) {
    candidates.push(raw);
  }
  return pickFirstValidMpNickname(candidates, platform);
}

export function extractNicknameFieldsFromJsonValue(
  value: unknown,
  platform: MpNicknamePlatform,
  depth = 0,
): string[] {
  if (depth > 6 || value == null) return [];
  const out: string[] = [];
  if (typeof value === "string") {
    const t = normalizeMpNicknameCandidate(value);
    if (t && !isInvalidMpNickname(t, platform)) out.push(t);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 30)) {
      out.push(...extractNicknameFieldsFromJsonValue(item, platform, depth + 1));
    }
    return out;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of MP_NICKNAME_JSON_KEYS) {
      if (key in obj) {
        out.push(...extractNicknameFieldsFromJsonValue(obj[key], platform, depth + 1));
      }
    }
    for (const key of MP_NICKNAME_JSON_WRAPPER_KEYS) {
      if (key in obj) {
        out.push(...extractNicknameFieldsFromJsonValue(obj[key], platform, depth + 1));
      }
    }
    for (const [k, v] of Object.entries(obj).slice(0, 40)) {
      if (/nick|name|user|author|account|profile|creator/i.test(k)) {
        out.push(...extractNicknameFieldsFromJsonValue(v, platform, depth + 1));
      }
    }
  }
  return out;
}

export function extractNicknameFromStorageText(
  text: string | null | undefined,
  platform: MpNicknamePlatform,
): string | null {
  const raw = (text ?? "").trim();
  if (!raw || raw.length < 4) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return pickFirstValidMpNickname(extractNicknameFieldsFromJsonValue(parsed, platform), platform);
  } catch {
    for (const key of MP_NICKNAME_JSON_KEYS) {
      const re = new RegExp(`"${key}"\\s*:\\s*"([^"]{2,${MAX_NICKNAME_LEN}})"`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) {
        const hit = pickFirstValidMpNickname([m[1]], platform);
        if (hit) return hit;
      }
    }
  }
  return null;
}

function buildEvaluateConfig(platform: MpNicknamePlatform) {
  const platformStorageHints = MP_NICKNAME_STORAGE_KEY_HINTS_BY_PLATFORM[platform] ?? [];
  return {
    prioritySelectors: MP_NICKNAME_PRIORITY_DOM_SELECTORS[platform],
    selectorList: MP_NICKNAME_DOM_SELECTORS[platform],
    invalidExact: MP_INVALID_NICKNAME_EXACT,
    platformLabels: MP_PLATFORM_LABEL_EXACT[platform],
    jsonKeys: MP_NICKNAME_JSON_KEYS,
    storageKeyHints: [...MP_NICKNAME_STORAGE_KEY_HINTS, ...platformStorageHints],
    windowStateKeys: MP_NICKNAME_WINDOW_STATE_KEYS,
    maxLen: MAX_NICKNAME_LEN,
    maxTitleLen: MAX_TITLE_NICKNAME_LEN,
  };
}

async function collectNicknameCandidatesOnPage(
  page: Page,
  platform: MpNicknamePlatform,
): Promise<string[]> {
  const cfg = buildEvaluateConfig(platform);
  return page.evaluate(({ config }) => {
    const platformLabels = new Set(
      (config.platformLabels as readonly string[]).map((w: string) => w.toLowerCase()),
    );
    const invalidExact = new Set(config.invalidExact.map((w: string) => w.toLowerCase()));
    const candidates: string[] = [];

    function isBad(text: string): boolean {
      const t = text.trim().replace(/\s+/g, " ");
      if (!t || t.length < 2 || t.length > config.maxLen) return true;
      const lower = t.toLowerCase();
      if (invalidExact.has(lower)) return true;
      if (platformLabels.has(lower)) return true;
      if (/登录|注册|退出|未登录|进入发布页|创作者中心|发布平台|个人中心|账号环境/i.test(t)) return true;
      if (/^https?:\/\//i.test(t)) return true;
      if (/（昵称待识别）$|（账号已登录）$/.test(t)) return true;
      return false;
    }

    function push(text: string | null | undefined) {
      const t = (text ?? "").trim().replace(/\s+/g, " ");
      if (!t || isBad(t)) return;
      candidates.push(t);
    }

    function pushElementText(el: Element) {
      push(el.getAttribute("title"));
      push(el.getAttribute("aria-label"));
      push(el.getAttribute("data-name"));
      push(el.getAttribute("data-nickname"));
      const ownText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => (n.textContent ?? "").trim())
        .join(" ");
      if (ownText) push(ownText);
      if (el.children.length === 0) {
        push(el.textContent);
        return;
      }
      const inner = el.querySelector(
        ':scope > span, :scope > em, :scope > [class*="name"], :scope > [class*="nick"]',
      );
      if (inner && inner !== el) push(inner.textContent);
      else {
        const t = (el.textContent ?? "").trim().replace(/\s+/g, " ");
        if (t.length <= config.maxLen) push(t);
      }
    }

    function collectDom(selectors: readonly string[]) {
      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          pushElementText(el);
        }
      }
    }

    collectDom(config.prioritySelectors);
    collectDom(config.selectorList);

    for (const el of Array.from(
      document.querySelectorAll(
        "header img[alt], nav img[alt], [class*='header'] img[alt], img[alt], [title], [aria-label]",
      ),
    )) {
      push(el.getAttribute("alt"));
      push(el.getAttribute("title"));
      push(el.getAttribute("aria-label"));
    }

    const storageKeys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
    for (const key of storageKeys) {
      const keyLower = key.toLowerCase();
      if (!config.storageKeyHints.some((hint: string) => keyLower.includes(hint))) continue;
      try {
        const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          for (const jk of config.jsonKeys) {
            const v = parsed[jk];
            if (typeof v === "string") push(v);
          }
          for (const [k, v] of Object.entries(parsed)) {
            if (/nick|name|user|author|account|profile|creator/i.test(k) && typeof v === "string") push(v);
          }
        } catch {
          for (const jk of config.jsonKeys) {
            const re = new RegExp(`"${jk}"\\s*:\\s*"([^"]{2,${config.maxLen}})"`, "g");
            let m: RegExpExecArray | null;
            while ((m = re.exec(raw)) !== null) push(m[1]);
          }
        }
      } catch {
        /* ignore */
      }
    }

    for (const meta of Array.from(
      document.querySelectorAll('meta[name="author"], meta[property="og:title"], meta[name="title"]'),
    )) {
      push(meta.getAttribute("content"));
    }

    const titleParts = (document.title ?? "")
      .split(/[-–—|｜·]/)
      .map((p: string) => p.trim())
      .filter(Boolean);
    for (const part of titleParts) {
      if (part.length <= config.maxTitleLen) push(part);
    }

    for (const script of Array.from(document.querySelectorAll("script"))) {
      const text = script.textContent ?? "";
      if (text.length < 40) continue;
      for (const key of config.jsonKeys) {
        const re = new RegExp(`"${key}"\\s*:\\s*"([^"]{2,${config.maxLen}})"`, "g");
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) push(m[1]);
      }
    }

    try {
      const w = window as unknown as Record<string, unknown>;
      for (const stateKey of config.windowStateKeys) {
        const state = w[stateKey];
        if (!state) continue;
        const serialized = typeof state === "string" ? state : JSON.stringify(state);
        for (const key of config.jsonKeys) {
          const re = new RegExp(`"${key}"\\s*:\\s*"([^"]{2,${config.maxLen}})"`, "g");
          let m: RegExpExecArray | null;
          while ((m = re.exec(serialized)) !== null) push(m[1]);
        }
      }
    } catch {
      /* ignore */
    }

    return candidates;
  }, { config: cfg });
}

async function detectNicknameOnCurrentPage(page: Page, platform: MpNicknamePlatform): Promise<string | null> {
  const candidates = await collectNicknameCandidatesOnPage(page, platform);
  return pickFirstValidMpNickname(candidates, platform);
}

function fallbackUrlAlreadyVisited(currentUrl: string, fallbackUrl: string): boolean {
  try {
    const cur = new URL(currentUrl);
    const fb = new URL(fallbackUrl);
    const fbPath = fb.pathname.replace(/\/$/, "");
    return cur.hostname === fb.hostname && cur.pathname.startsWith(fbPath);
  } catch {
    return currentUrl.includes(fallbackUrl);
  }
}

export async function detectMpPlatformNickname(
  page: Page,
  platform: MpNicknamePlatform,
): Promise<string | null> {
  let name = await detectNicknameOnCurrentPage(page, platform);
  if (name) return name;

  const fallbackUrls = MP_NICKNAME_FALLBACK_URLS[platform];
  if (!fallbackUrls?.length) return null;

  const current = page.url();
  for (const fallbackUrl of fallbackUrls) {
    if (fallbackUrlAlreadyVisited(current, fallbackUrl)) continue;
    try {
      await page.goto(fallbackUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2000);
      name = await detectNicknameOnCurrentPage(page, platform);
      if (name) return name;
    } catch {
      /* 不影响登录状态 */
    }
  }

  return null;
}

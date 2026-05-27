/**
 * 知乎账号身份解析：仅从可信登录身份源提取昵称，禁止全页乱扫。
 */

export type ZhihuLoginStatus = "valid" | "invalid" | "unknown";

export type ZhihuDisplayNameSource =
  | "profile_header"
  | "document_title"
  | "viewer_state"
  | "user_menu"
  | "unknown";

export type ZhihuIdentityRejected = { value: string; reason: string };

export type ZhihuIdentityResolution = {
  loginStatus: ZhihuLoginStatus;
  profileUrl: string | null;
  profileSlug: string | null;
  displayName: string | null;
  displayNameVerified: boolean;
  displayNameSource: ZhihuDisplayNameSource;
  rejectedCandidates: ZhihuIdentityRejected[];
};

export type ZhihuIdentitySignals = {
  pageUrl: string;
  documentTitle: string;
  loginStatus: ZhihuLoginStatus;
  profileHeaderTitle: string | null;
  viewerStateName: string | null;
  userMenuName: string | null;
};

const EXACT_DENY = new Set(
  [
    "广告",
    "知乎",
    "用户",
    "账号",
    "博丽灵梦",
    "null",
    "undefined",
    "首页",
    "关注",
    "推荐",
    "热榜",
    "圈子",
    "付费咨询",
    "知学堂",
    "直答",
    "消息",
    "私信",
    "创作中心",
    "动态",
    "回答",
    "视频",
    "提问",
    "文章",
    "专栏",
    "想法",
    "收藏",
    "划线",
    "会员",
    "通知",
    "登录",
    "注册",
    "设置",
    "上传封面图片",
    "编辑个人资料",
    "进入创作中心",
    "草稿箱",
    "删除",
    "打开账号环境",
    "重新检测",
  ].map(s => s.toLowerCase()),
);

const BLOCKED_NICKNAME_RE =
  /^(博丽灵梦|知乎用户|知乎网友|游客|新用户|默认用户|用户\d*|User\d*)$/i;

/** tab / 统计文案：专栏0、回答3、文章5、收藏2 */
const TAB_STAT_LABEL_RE =
  /^(动态|回答|视频|提问|文章|专栏|想法|收藏|划线)(\s*\d+|\d+)?$/i;

const DOCUMENT_TITLE_TAB_ONLY_RE =
  /^(动态|回答|视频|提问|文章|专栏|想法|收藏|划线|首页|关注|推荐|热榜)$/i;

export function getZhihuNicknameRejectionReason(
  text: string,
  source: ZhihuDisplayNameSource | "candidate",
): string | null {
  const t = text.trim();
  if (!t || t.length < 2) return "empty_or_too_short";
  if (t.length > 40) return "too_long";
  if (BLOCKED_NICKNAME_RE.test(t)) return "blocked_default_avatar";
  if (/^https?:\/\//i.test(t)) return "url";
  const lower = t.toLowerCase();
  if (EXACT_DENY.has(lower)) return "denylist_exact";
  if (TAB_STAT_LABEL_RE.test(t)) return "tab_or_stat_label";
  if (/^\d+$/.test(t)) return "numeric_only";
  if (/^(点击|获取|扫码|密码|验证码|中国)/.test(t)) return "ui_action";
  if (source === "document_title" && DOCUMENT_TITLE_TAB_ONLY_RE.test(t)) {
    return "document_title_nav_tab";
  }
  return null;
}

export function parseZhihuDocumentTitle(title: string): string | null {
  const raw = title.trim();
  if (!raw) return null;
  const m = raw.match(/^(.+?)\s*[-–—]\s*知乎\s*$/);
  const candidate = (m?.[1] ?? raw).trim();
  if (!candidate || candidate === "知乎") return null;
  return candidate;
}

function tryTrustedNickname(
  value: string | null | undefined,
  source: ZhihuDisplayNameSource,
  rejected: ZhihuIdentityRejected[],
): { displayName: string; displayNameSource: ZhihuDisplayNameSource } | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const reason = getZhihuNicknameRejectionReason(trimmed, source);
  if (reason) {
    rejected.push({ value: trimmed, reason: `${source}:${reason}` });
    return null;
  }
  return { displayName: trimmed, displayNameSource: source };
}

export function extractProfileSlugFromUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    const m = u.pathname.match(/\/people\/([^/?#]+)/i);
    return m?.[1] ?? null;
  } catch {
    const m = pageUrl.match(/\/people\/([^/?#]+)/i);
    return m?.[1] ?? null;
  }
}

export function buildZhihuProfileUrl(slug: string | null): string | null {
  if (!slug?.trim()) return null;
  return `https://www.zhihu.com/people/${slug.trim()}`;
}

/** 纯函数：按可信来源优先级解析身份（供单测与页面信号汇总） */
export function resolveZhihuIdentityFromSignals(
  signals: ZhihuIdentitySignals,
): ZhihuIdentityResolution {
  const rejected: ZhihuIdentityRejected[] = [];
  const profileSlug =
    extractProfileSlugFromUrl(signals.pageUrl) ??
    null;
  const profileUrl = buildZhihuProfileUrl(profileSlug);

  const onProfilePage = Boolean(profileSlug && /\/people\//i.test(signals.pageUrl));

  const attempts: Array<{
    value: string | null | undefined;
    source: ZhihuDisplayNameSource;
    enabled: boolean;
  }> = [
    {
      value: signals.profileHeaderTitle,
      source: "profile_header",
      enabled: onProfilePage,
    },
    {
      value: parseZhihuDocumentTitle(signals.documentTitle),
      source: "document_title",
      enabled: true,
    },
    { value: signals.viewerStateName, source: "viewer_state", enabled: true },
    { value: signals.userMenuName, source: "user_menu", enabled: true },
  ];

  for (const { value, source, enabled } of attempts) {
    if (!enabled) continue;
    const picked = tryTrustedNickname(value, source, rejected);
    if (picked) {
      return {
        loginStatus: signals.loginStatus,
        profileUrl,
        profileSlug,
        displayName: picked.displayName,
        displayNameVerified: true,
        displayNameSource: picked.displayNameSource,
        rejectedCandidates: rejected,
      };
    }
  }

  return {
    loginStatus: signals.loginStatus,
    profileUrl,
    profileSlug,
    displayName: null,
    displayNameVerified: false,
    displayNameSource: "unknown",
    rejectedCandidates: rejected,
  };
}

export type ZhihuIdentityBrowserSignals = {
  pageUrl: string;
  documentTitle: string;
  profileHeaderTitle: string | null;
  viewerStateName: string | null;
  userMenuName: string | null;
  profileSlug: string | null;
};

/** Playwright page.evaluate 专用：逻辑须自包含，不可引用模块常量 */
export function collectZhihuIdentitySignalsInBrowser(): ZhihuIdentityBrowserSignals {
  const NAV_SKIP =
    /^(动态|回答|视频|提问|文章|专栏|想法|收藏|划线|首页|关注|推荐|热榜|圈子|付费咨询|知学堂|直答|消息|私信|创作中心|登录|注册|设置)$/i;
  function clean(t: string | null | undefined): string | null {
    const s = (t ?? "").replace(/\s+/g, " ").trim();
    if (!s || s.length < 2 || s.length > 40) return null;
    if (NAV_SKIP.test(s)) return null;
    if (/^(专栏|回答|文章|收藏|想法|动态|视频|提问)\d+$/i.test(s)) return null;
    return s;
  }
  function profileHeaderTitle(): string | null {
    if (!/\/people\/[^/?#]+/i.test(location.pathname)) return null;
    const skip =
      "nav,[role=tablist],[class*=Tabs],[class*=Tab],button,[role=button],footer,[class*=Nav]";
    const roots = [
      document.querySelector(".ProfileHeader"),
      document.querySelector('[class*="ProfileHeader"]'),
      document.querySelector("main"),
    ].filter(Boolean) as Element[];
    for (const root of roots) {
      for (const sel of ["h1", '[class*="ProfileHeader-name"]', '[class*="UserName"]']) {
        const el = root.querySelector(sel);
        if (!el || el.closest(skip)) continue;
        const t = clean(el.textContent);
        if (t) return t;
      }
    }
    return null;
  }
  function viewerStateName(): string | null {
    try {
      const initial = (window as unknown as { __INITIAL_STATE__?: Record<string, unknown> })
        .__INITIAL_STATE__;
      const viewer = initial?.viewer ?? initial?.currentUser ?? initial?.user;
      if (!viewer || typeof viewer !== "object") return null;
      const v = viewer as Record<string, unknown>;
      const name =
        (typeof v.name === "string" && v.name) ||
        (typeof v.username === "string" && v.username) ||
        (typeof v.fullname === "string" && v.fullname) ||
        null;
      return clean(name);
    } catch {
      return null;
    }
  }
  function userMenuName(): string | null {
    const menu = document.querySelector(
      '[class*="ProfileMenu"], .AppHeader-userInfo, [class*="AppHeader-userInfo"]',
    );
    if (!menu) return null;
    for (const sel of ['[class*="UserName"]', '[class*="user-name"]', "a[href*='/people/']"]) {
      const el = menu.querySelector(sel);
      if (!el) continue;
      if (el.closest("nav,[role=tablist],button")) continue;
      const t = clean(el.textContent);
      if (t) return t;
    }
    return null;
  }
  function profileSlugFromDom(): string | null {
    const m = location.pathname.match(/\/people\/([^/?#]+)/i);
    if (m) return m[1];
    const header = document.querySelector("header") ?? document.body;
    for (const a of Array.from(header.querySelectorAll('a[href*="/people/"]'))) {
      const href = a.getAttribute("href") ?? "";
      const mm = href.match(/\/people\/([^/?#]+)/i);
      if (!mm) continue;
      const text = (a.textContent ?? "").trim();
      if (/开通|机构|登录|注册/.test(text)) continue;
      return mm[1];
    }
    return null;
  }
  return {
    pageUrl: location.href,
    documentTitle: document.title || "",
    profileHeaderTitle: profileHeaderTitle(),
    viewerStateName: viewerStateName(),
    userMenuName: userMenuName(),
    profileSlug: profileSlugFromDom(),
  };
}

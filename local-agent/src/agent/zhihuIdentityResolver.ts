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
  viewerStateSlug: string | null;
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
  const urlSlug = extractProfileSlugFromUrl(signals.pageUrl);
  const profileSlug = urlSlug ?? signals.viewerStateSlug ?? null;
  const profileUrl = buildZhihuProfileUrl(profileSlug);

  const onProfilePage = Boolean(urlSlug && /\/people\//i.test(signals.pageUrl));

  const viewerStateTrusted =
    Boolean(
      profileSlug &&
        signals.viewerStateSlug &&
        signals.viewerStateSlug === profileSlug &&
        signals.viewerStateName,
    );

  const attempts: Array<{
    value: string | null | undefined;
    source: ZhihuDisplayNameSource;
    enabled: boolean;
  }> = onProfilePage
    ? [
        { value: signals.profileHeaderTitle, source: "profile_header", enabled: true },
        {
          value: viewerStateTrusted ? signals.viewerStateName : null,
          source: "viewer_state",
          enabled: viewerStateTrusted,
        },
      ]
    : [
        {
          value: viewerStateTrusted ? signals.viewerStateName : null,
          source: "viewer_state",
          enabled: viewerStateTrusted,
        },
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
  viewerStateSlug: string | null;
  userMenuName: string | null;
  profileSlug: string | null;
};

export type ZhihuLoginProfileSlug = {
  slug: string | null;
  source:
    | "pathname"
    | "viewer_state"
    | "data_state"
    | "header_link"
    | "settings_page"
    | "home_delayed_state"
    | "none";
};

export type ZhihuProfileHeaderDebug = {
  pageUrl: string;
  h1Found: boolean;
  h1Text: string | null;
  nameElFound: boolean;
  nameElText: string | null;
  pickedText: string | null;
};

/** Playwright page.evaluate：解析当前登录用户 slug（urlToken 优先；须自包含，不可引用模块级函数） */
export function collectLoginProfileSlugInBrowser(): ZhihuLoginProfileSlug {
  function readViewerSlugFromState(): { slug: string | null; source: ZhihuLoginProfileSlug["source"] } {
    try {
      const initial = (window as unknown as { __INITIAL_STATE__?: Record<string, unknown> })
        .__INITIAL_STATE__;
      const viewer = initial?.viewer ?? initial?.currentUser ?? initial?.user;
      if (viewer && typeof viewer === "object") {
        const v = viewer as Record<string, unknown>;
        const urlToken =
          (typeof v.urlToken === "string" && v.urlToken) ||
          (typeof v.id === "string" && v.id) ||
          null;
        if (urlToken?.trim()) {
          return { slug: urlToken.trim(), source: "viewer_state" };
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const dataEl =
        document.querySelector('#data[data-state]') ??
        document.querySelector('[data-state]');
      const raw = dataEl?.getAttribute("data-state");
      if (raw) {
        const state = JSON.parse(raw) as Record<string, unknown>;
        const viewer = state.viewer ?? state.currentUser ?? state.user;
        if (viewer && typeof viewer === "object") {
          const v = viewer as Record<string, unknown>;
          const urlToken =
            (typeof v.urlToken === "string" && v.urlToken) ||
            (typeof v.id === "string" && v.id) ||
            null;
          if (urlToken?.trim()) {
            return { slug: urlToken.trim(), source: "data_state" };
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { slug: null, source: "none" };
  }

  function readPeopleSlugFromAnchors(scopes: ParentNode[]): ZhihuLoginProfileSlug {
    for (const scope of scopes) {
      for (const a of Array.from(scope.querySelectorAll('a[href*="/people/"]'))) {
        const href = a.getAttribute("href") ?? "";
        const mm = href.match(/\/people\/([^/?#]+)/i);
        if (!mm) continue;
        const text = (a.textContent ?? "").trim();
        if (/开通|机构|登录|注册|机构号/.test(text)) continue;
        return { slug: mm[1], source: "header_link" };
      }
    }
    return { slug: null, source: "none" };
  }

  const pathMatch = location.pathname.match(/\/people\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return { slug: pathMatch[1], source: "pathname" };
  }

  const fromState = readViewerSlugFromState();
  if (fromState.slug) {
    return { slug: fromState.slug, source: fromState.source };
  }

  const header = document.querySelector("header") ?? document.body;
  return readPeopleSlugFromAnchors([header]);
}

/** Playwright page.evaluate：用户菜单展开后从下拉区读取 slug */
export function collectProfileSlugFromUserMenuInBrowser(): ZhihuLoginProfileSlug {
  function readPeopleSlugFromAnchors(scopes: ParentNode[]): ZhihuLoginProfileSlug {
    for (const scope of scopes) {
      for (const a of Array.from(scope.querySelectorAll('a[href*="/people/"]'))) {
        const href = a.getAttribute("href") ?? "";
        const mm = href.match(/\/people\/([^/?#]+)/i);
        if (!mm) continue;
        const text = (a.textContent ?? "").trim();
        if (/开通|机构|登录|注册|机构号/.test(text)) continue;
        return { slug: mm[1], source: "header_link" };
      }
    }
    return { slug: null, source: "none" };
  }

  const pathMatch = location.pathname.match(/\/people\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return { slug: pathMatch[1], source: "pathname" };
  }

  const menuScopes: ParentNode[] = [];
  for (const sel of [
    '[class*="ProfileMenu"]',
    '[class*="AppHeader-userInfo"]',
    '[class*="Menu"]',
    '[class*="Dropdown"]',
    '[class*="Popover"]',
    "header",
  ]) {
    const el = document.querySelector(sel);
    if (el) menuScopes.push(el);
  }
  menuScopes.push(document.body);

  return readPeopleSlugFromAnchors(menuScopes);
}

/** Playwright page.evaluate：settings/profile 页读取 slug */
export function collectProfileSlugFromSettingsPageInBrowser(): ZhihuLoginProfileSlug {
  function readViewerSlugFromState(): { slug: string | null; source: ZhihuLoginProfileSlug["source"] } {
    try {
      const initial = (window as unknown as { __INITIAL_STATE__?: Record<string, unknown> })
        .__INITIAL_STATE__;
      const viewer = initial?.viewer ?? initial?.currentUser ?? initial?.user;
      if (viewer && typeof viewer === "object") {
        const v = viewer as Record<string, unknown>;
        const urlToken =
          (typeof v.urlToken === "string" && v.urlToken) ||
          (typeof v.id === "string" && v.id) ||
          null;
        if (urlToken?.trim()) {
          return { slug: urlToken.trim(), source: "viewer_state" };
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const dataEl =
        document.querySelector('#data[data-state]') ??
        document.querySelector('[data-state]');
      const raw = dataEl?.getAttribute("data-state");
      if (raw) {
        const state = JSON.parse(raw) as Record<string, unknown>;
        const viewer = state.viewer ?? state.currentUser ?? state.user;
        if (viewer && typeof viewer === "object") {
          const v = viewer as Record<string, unknown>;
          const urlToken =
            (typeof v.urlToken === "string" && v.urlToken) ||
            (typeof v.id === "string" && v.id) ||
            null;
          if (urlToken?.trim()) {
            return { slug: urlToken.trim(), source: "data_state" };
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { slug: null, source: "none" };
  }

  function readPeopleSlugFromAnchors(scopes: ParentNode[]): ZhihuLoginProfileSlug {
    for (const scope of scopes) {
      for (const a of Array.from(scope.querySelectorAll('a[href*="/people/"]'))) {
        const href = a.getAttribute("href") ?? "";
        const mm = href.match(/\/people\/([^/?#]+)/i);
        if (!mm) continue;
        const text = (a.textContent ?? "").trim();
        if (/开通|机构|登录|注册|机构号/.test(text)) continue;
        return { slug: mm[1], source: "header_link" };
      }
    }
    return { slug: null, source: "none" };
  }

  const pathMatch = location.pathname.match(/\/people\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return { slug: pathMatch[1], source: "pathname" };
  }

  const fromState = readViewerSlugFromState();
  if (fromState.slug) {
    return { slug: fromState.slug, source: "settings_page" };
  }

  const scopes: ParentNode[] = [];
  const main = document.querySelector("main");
  if (main) scopes.push(main);
  scopes.push(document.body);
  const fromLink = readPeopleSlugFromAnchors(scopes);
  if (fromLink.slug) {
    return { slug: fromLink.slug, source: "settings_page" };
  }

  return { slug: null, source: "none" };
}

/** Playwright page.evaluate：仅读 __INITIAL_STATE__ / data-state（首页延迟后使用） */
export function collectViewerSlugFromInitialStateInBrowser(): ZhihuLoginProfileSlug {
  function readViewerSlugFromState(): { slug: string | null; source: ZhihuLoginProfileSlug["source"] } {
    try {
      const initial = (window as unknown as { __INITIAL_STATE__?: Record<string, unknown> })
        .__INITIAL_STATE__;
      const viewer = initial?.viewer ?? initial?.currentUser ?? initial?.user;
      if (viewer && typeof viewer === "object") {
        const v = viewer as Record<string, unknown>;
        const urlToken =
          (typeof v.urlToken === "string" && v.urlToken) ||
          (typeof v.id === "string" && v.id) ||
          null;
        if (urlToken?.trim()) {
          return { slug: urlToken.trim(), source: "viewer_state" };
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const dataEl =
        document.querySelector('#data[data-state]') ??
        document.querySelector('[data-state]');
      const raw = dataEl?.getAttribute("data-state");
      if (raw) {
        const state = JSON.parse(raw) as Record<string, unknown>;
        const viewer = state.viewer ?? state.currentUser ?? state.user;
        if (viewer && typeof viewer === "object") {
          const v = viewer as Record<string, unknown>;
          const urlToken =
            (typeof v.urlToken === "string" && v.urlToken) ||
            (typeof v.id === "string" && v.id) ||
            null;
          if (urlToken?.trim()) {
            return { slug: urlToken.trim(), source: "data_state" };
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { slug: null, source: "none" };
  }

  const fromState = readViewerSlugFromState();
  if (fromState.slug) {
    return { slug: fromState.slug, source: "home_delayed_state" };
  }
  return { slug: null, source: "none" };
}

/** Playwright page.evaluate：个人页昵称 DOM 探测（供调试日志） */
export function collectProfileHeaderDebugInBrowser(): ZhihuProfileHeaderDebug {
  const skip =
    "nav,[role=tablist],[class*=Tabs],[class*=Tab],button,[role=button],footer,[class*=Nav]";
  const h1 =
    document.querySelector(".ProfileHeader h1") ??
    document.querySelector(".ProfileHeader-title") ??
    document.querySelector('[class*="ProfileHeader"] h1');
  const nameEl =
    document.querySelector(".ProfileHeader-name") ??
    document.querySelector('[class*="ProfileHeader-name"]');
  const h1Text = (h1?.textContent ?? "").replace(/\s+/g, " ").trim() || null;
  const nameElText = (nameEl?.textContent ?? "").replace(/\s+/g, " ").trim() || null;
  let pickedText: string | null = null;
  if (nameEl && !nameEl.closest(skip)) pickedText = nameElText;
  else if (h1 && !h1.closest(skip)) pickedText = h1Text;
  return {
    pageUrl: location.href,
    h1Found: Boolean(h1),
    h1Text,
    nameElFound: Boolean(nameEl),
    nameElText,
    pickedText,
  };
}

/** Playwright page.evaluate 专用：逻辑须自包含，不可引用模块常量 */
export function collectZhihuIdentitySignalsInBrowser(): ZhihuIdentityBrowserSignals {
  const NAV_SKIP =
    /^(动态|回答|视频|提问|文章|专栏|想法|收藏|划线|首页|关注|推荐|热榜|圈子|付费咨询|知学堂|直答|消息|私信|创作中心|登录|注册|设置)$/i;
  function clean(t: string | null | undefined): string | null {
    const s = (t ?? "").replace(/\s+/g, " ").trim();
    if (!s || s.length < 2 || s.length > 40) return null;
    if (NAV_SKIP.test(s)) return null;
    if (/^(专栏|回答|文章|收藏|想法|动态|视频|提问)\s*\d+$/i.test(s)) return null;
    return s;
  }
  function profileHeaderTitle(): string | null {
    if (!/\/people\/[^/?#]+/i.test(location.pathname)) return null;
    const skip =
      "nav,[role=tablist],[class*=Tabs],[class*=Tab],button,[role=button],footer,[class*=Nav]";
    const nameEl =
      document.querySelector(".ProfileHeader-name") ??
      document.querySelector('[class*="ProfileHeader-name"]');
    if (nameEl && !nameEl.closest(skip)) {
      const fromName = clean(nameEl.textContent);
      if (fromName) return fromName;
    }
    const h1 =
      document.querySelector(".ProfileHeader h1") ??
      document.querySelector(".ProfileHeader-title") ??
      document.querySelector('[class*="ProfileHeader"] h1');
    if (!h1) return null;
    if (h1.closest(skip)) return null;
    return clean(h1.textContent);
  }
  function readViewerRecord(v: Record<string, unknown>): { name: string | null; slug: string | null } {
    const name =
      (typeof v.name === "string" && v.name) ||
      (typeof v.username === "string" && v.username) ||
      (typeof v.fullname === "string" && v.fullname) ||
      null;
    const slug =
      (typeof v.urlToken === "string" && v.urlToken) ||
      (typeof v.id === "string" && v.id) ||
      null;
    return { name: clean(name), slug: slug?.trim() || null };
  }
  function viewerStateBundle(): { name: string | null; slug: string | null } {
    try {
      const initial = (window as unknown as { __INITIAL_STATE__?: Record<string, unknown> })
        .__INITIAL_STATE__;
      const viewer = initial?.viewer ?? initial?.currentUser ?? initial?.user;
      if (viewer && typeof viewer === "object") {
        const picked = readViewerRecord(viewer as Record<string, unknown>);
        if (picked.slug || picked.name) return picked;
      }
    } catch {
      /* ignore */
    }
    try {
      const pathSlug = location.pathname.match(/\/people\/([^/?#]+)/i)?.[1] ?? null;
      const dataEl =
        document.querySelector('#data[data-state]') ??
        document.querySelector('[data-state]');
      const raw = dataEl?.getAttribute("data-state");
      if (raw) {
        const state = JSON.parse(raw) as Record<string, unknown>;
        const viewer = state.viewer ?? state.currentUser ?? state.user;
        if (viewer && typeof viewer === "object") {
          const picked = readViewerRecord(viewer as Record<string, unknown>);
          if (picked.slug || picked.name) return picked;
        }
        if (pathSlug) {
          const entities = state.entities as Record<string, unknown> | undefined;
          const users = entities?.users as Record<string, Record<string, unknown>> | undefined;
          const profileUser = users?.[pathSlug];
          if (profileUser && typeof profileUser === "object") {
            const picked = readViewerRecord(profileUser);
            if (picked.name) {
              return { name: picked.name, slug: pathSlug };
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { name: null, slug: null };
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
  const viewer = viewerStateBundle();
  return {
    pageUrl: location.href,
    documentTitle: document.title || "",
    profileHeaderTitle: profileHeaderTitle(),
    viewerStateName: viewer.name,
    viewerStateSlug: viewer.slug,
    userMenuName: userMenuName(),
    profileSlug: profileSlugFromDom(),
  };
}

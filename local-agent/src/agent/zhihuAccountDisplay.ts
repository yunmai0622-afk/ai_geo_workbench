export type ZhihuNicknameCandidate = {
  priority: number;
  source: string;
  text: string;
};

export type ZhihuNicknamePick = {
  displayName: string | null;
  displayNameVerified: boolean;
  displayNameSource: "platform_dom" | "profile_name" | "unknown";
  message: string;
};

const ZHIHU_NICKNAME_DENYLIST = [
  "广告",
  "知乎",
  "首页",
  "推荐",
  "热榜",
  "关注",
  "会员",
  "创作中心",
  "私信",
  "通知",
  "用户",
  "账号",
  "登录",
  "设置",
  "博丽灵梦",
] as const;

/** 常见默认头像 alt / 占位昵称，不得冒充真实知乎昵称 */
const BLOCKED_NICKNAME_RE =
  /^(博丽灵梦|知乎用户|知乎网友|游客|新用户|默认用户|用户\d*|User\d*)$/i;

const TRUSTED_SOURCE_RE = /profile link|UserName|user block|initial_state/i;

export function isBlockedZhihuNickname(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 2) return true;
  if (BLOCKED_NICKNAME_RE.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  const lower = t.toLowerCase();
  for (const word of ZHIHU_NICKNAME_DENYLIST) {
    if (t === word || lower === word.toLowerCase()) return true;
  }
  return false;
}

export function isTrustedZhihuNicknameSource(source: string): boolean {
  return TRUSTED_SOURCE_RE.test(source);
}

/** 仅从可信 DOM 来源选取昵称；img[alt]/button 等不得单独作为真实昵称 */
export function pickZhihuVerifiedNickname(candidates: ZhihuNicknameCandidate[]): ZhihuNicknamePick {
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority || a.text.localeCompare(b.text));

  for (const c of sorted) {
    if (c.priority > 3) continue;
    if (/img\[alt\]|Avatar\[alt\]|button|title|aria-label/i.test(c.source)) continue;
    if (isBlockedZhihuNickname(c.text)) continue;
    if (!isTrustedZhihuNicknameSource(c.source)) continue;
    return {
      displayName: c.text,
      displayNameVerified: true,
      displayNameSource: "platform_dom",
      message: `检测成功：${c.text}`,
    };
  }

  const loginOnly = sorted.find(
    c => c.priority <= 3 && !isBlockedZhihuNickname(c.text) && !/img\[alt\]|button/i.test(c.source),
  );
  if (loginOnly && !isTrustedZhihuNicknameSource(loginOnly.source)) {
    return {
      displayName: null,
      displayNameVerified: false,
      displayNameSource: "unknown",
      message: "已登录，昵称待识别（未能从知乎个人入口稳定提取，请点「重新检测」）",
    };
  }

  return {
    displayName: null,
    displayNameVerified: false,
    displayNameSource: "unknown",
    message: "未检测到有效昵称，请确认知乎窗口已登录并在首页显示个人入口",
  };
}

export function formatZhihuAccountCardTitle(
  platformLabel: string,
  account: {
    accountName?: string | null;
    displayNameVerified?: boolean;
    sessionStatus?: string;
  },
): string {
  if (account.accountName && account.displayNameVerified === true) {
    return account.accountName;
  }
  if (account.sessionStatus === "active") {
    return `${platformLabel}账号（昵称待识别）`;
  }
  return "未检测到账号昵称";
}

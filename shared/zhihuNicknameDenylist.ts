/** 知乎昵称 denylist：命中则不得作为 displayName / accountName 展示 */
export const ZHIHU_NICKNAME_DENYLIST = [
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
  "动态",
  "回答",
  "视频",
  "提问",
  "文章",
  "专栏",
  "想法",
  "收藏",
  "划线",
] as const;

const BLOCKED_NICKNAME_RE =
  /^(博丽灵梦|知乎用户|知乎网友|游客|新用户|默认用户|用户\d*|User\d*)$/i;

/** tab / 统计：专栏0、回答3、文章5 */
const TAB_STAT_LABEL_RE =
  /^(动态|回答|视频|提问|文章|专栏|想法|收藏|划线)(\s*\d+|\d+)?$/i;

export function isBlockedZhihuDisplayName(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t || t.length < 2) return true;
  if (BLOCKED_NICKNAME_RE.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (TAB_STAT_LABEL_RE.test(t)) return true;
  const lower = t.toLowerCase();
  for (const word of ZHIHU_NICKNAME_DENYLIST) {
    if (t === word || lower === word.toLowerCase()) return true;
  }
  return false;
}

/** 从本地存储映射到同步 payload：仅 verified=true 时保留 displayName */
export function resolveLocalAgentDisplayNameFields(account: {
  accountName?: string | null;
  displayNameVerified?: boolean;
}): { displayName: string | null; displayNameVerified: boolean } {
  if (account.displayNameVerified === true && account.accountName?.trim()) {
    const name = account.accountName.trim();
    if (isBlockedZhihuDisplayName(name)) {
      return { displayName: null, displayNameVerified: false };
    }
    return { displayName: name, displayNameVerified: true };
  }
  if (account.accountName?.trim() && !isBlockedZhihuDisplayName(account.accountName)) {
    // 历史数据：有昵称但未标 verified，不当作真实昵称
    return { displayName: null, displayNameVerified: false };
  }
  return { displayName: null, displayNameVerified: false };
}

import { getZhihuNicknameRejectionReason } from "./zhihuIdentityResolver";

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

/** @deprecated 全页候选扫描已废弃；保留兼容导出 */
export function isBlockedZhihuNickname(text: string): boolean {
  return getZhihuNicknameRejectionReason(text, "candidate") !== null;
}

export function isTrustedZhihuNicknameSource(_source: string): boolean {
  return false;
}

/** @deprecated 全页候选扫描已移除；始终返回待识别 */
export function pickZhihuVerifiedNickname(_candidates: ZhihuNicknameCandidate[]): ZhihuNicknamePick {
  return {
    displayName: null,
    displayNameVerified: false,
    displayNameSource: "unknown",
    message: "已登录，昵称待识别（未能从知乎个人入口稳定提取，请点「重新检测」）",
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

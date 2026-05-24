/** 项目级平台账号核验（发布前比对绑定昵称与浏览器登录昵称） */

export const BINDING_PUBLISH_PLATFORMS = ["zhihu", "baijiahao", "toutiao", "sohu"] as const;
export type BindingPublishPlatform = (typeof BINDING_PUBLISH_PLATFORMS)[number];

export const PLATFORM_ACCOUNT_VERIFICATION_STATUSES = [
  "unknown",
  "matched",
  "mismatched",
  "login_required",
] as const;
export type PlatformAccountVerificationStatus = (typeof PLATFORM_ACCOUNT_VERIFICATION_STATUSES)[number];

export const PUBLISH_PLATFORM_LABELS: Record<BindingPublishPlatform, string> = {
  zhihu: "知乎",
  baijiahao: "百家号",
  toutiao: "头条号",
  sohu: "搜狐号",
};

export function isBindingPublishPlatform(platform: string): platform is BindingPublishPlatform {
  return (BINDING_PUBLISH_PLATFORMS as readonly string[]).includes(platform);
}

export function normalizeAccountNameForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

export type AccountMatchResult = {
  matched: boolean;
  status: PlatformAccountVerificationStatus;
  expectedAccountName: string;
  detectedAccountName: string | null;
  message: string;
};

export function matchPlatformAccountNames(
  expectedAccountName: string,
  detectedAccountName: string | null | undefined,
): AccountMatchResult {
  const expected = expectedAccountName.trim();
  const detected = detectedAccountName?.trim() ?? "";

  if (!expected) {
    return {
      matched: false,
      status: "unknown",
      expectedAccountName: expected,
      detectedAccountName: detected || null,
      message: "绑定账号昵称为空，无法核验",
    };
  }

  if (!detected) {
    return {
      matched: false,
      status: "login_required",
      expectedAccountName: expected,
      detectedAccountName: null,
      message: "当前浏览器尚未登录对应平台，请先登录企业绑定账号后再发布",
    };
  }

  const ne = normalizeAccountNameForMatch(expected);
  const nd = normalizeAccountNameForMatch(detected);

  if (ne === nd) {
    return {
      matched: true,
      status: "matched",
      expectedAccountName: expected,
      detectedAccountName: detected,
      message: "账号匹配",
    };
  }

  const shorter = ne.length <= nd.length ? ne : nd;
  const longer = ne.length > nd.length ? ne : nd;
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return {
      matched: true,
      status: "matched",
      expectedAccountName: expected,
      detectedAccountName: detected,
      message: "账号匹配（昵称包含关系）",
    };
  }

  return {
    matched: false,
    status: "mismatched",
    expectedAccountName: expected,
    detectedAccountName: detected,
    message: "账号不匹配，已停止发布",
  };
}

export function publishBlockedNoAccountMessage(platform: string): string {
  const label = isBindingPublishPlatform(platform) ? PUBLISH_PLATFORM_LABELS[platform] : platform;
  return `当前企业尚未绑定 ${label} 账号，请先在企业档案中完成平台账号配置。`;
}

export function publishMustSelectAccountMessage(platform: string): string {
  const label = isBindingPublishPlatform(platform) ? PUBLISH_PLATFORM_LABELS[platform] : platform;
  return `当前企业在 ${label} 绑定了多个启用账号，请选择本次发布使用的账号。`;
}

export function platformAccountInvalidMessage(platform: string): string {
  const label = isBindingPublishPlatform(platform) ? PUBLISH_PLATFORM_LABELS[platform] : platform;
  return `所选 ${label} 账号不存在、已禁用或不属于当前企业，请重新选择。`;
}

export function publishMismatchMessage(params: {
  projectName: string;
  expectedAccountName: string;
  detectedAccountName: string;
}): string {
  return [
    "账号不匹配，已停止发布。",
    `当前企业：${params.projectName}`,
    `应使用账号：${params.expectedAccountName}`,
    `当前登录账号：${params.detectedAccountName}`,
    "请切换到正确账号后重试。",
  ].join("\n");
}

export function publishUnknownAccountMessage(platform: string): string {
  const label = isBindingPublishPlatform(platform) ? PUBLISH_PLATFORM_LABELS[platform] : platform;
  return `暂时无法识别当前登录账号。为避免内容错发，请确认当前浏览器已登录该企业绑定的 ${label} 账号后重试。`;
}

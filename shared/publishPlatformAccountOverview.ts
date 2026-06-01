import {
  BINDING_PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  type BindingPublishPlatform,
} from "./platformAccountVerify";

export type PlatformAccountOverviewRow = {
  platform: BindingPublishPlatform;
  label: string;
  bound: boolean;
  accountNames: string[];
};

export type PlatformAccountOverviewAccount = {
  accountName: string;
  isEnabled: boolean;
};

export type PlatformAccountOverviewGroup = {
  platform: string;
  accounts: PlatformAccountOverviewAccount[];
};

/** geo.platformAccounts.list 返回的 accounts 为 readonly，入参需兼容 */
export type PlatformAccountOverviewGroupInput = {
  readonly platform: string;
  readonly accounts: ReadonlyArray<PlatformAccountOverviewAccount>;
};

/** 按绑定平台顺序生成网页端只读展示行（数据来源 geo.platformAccounts.list） */
export function buildPublishPlatformAccountOverview(
  groups: ReadonlyArray<PlatformAccountOverviewGroupInput>,
): PlatformAccountOverviewRow[] {
  const byPlatform = new Map<string, ReadonlyArray<PlatformAccountOverviewAccount>>();
  for (const g of groups) {
    byPlatform.set(g.platform, g.accounts ?? []);
  }
  return BINDING_PUBLISH_PLATFORMS.map(platform => {
    const accounts = byPlatform.get(platform) ?? [];
    const enabled = accounts.filter(a => a.isEnabled);
    const source = enabled.length > 0 ? enabled : accounts;
    const accountNames = source.map(a => a.accountName.trim()).filter(Boolean);
    return {
      platform,
      label: PUBLISH_PLATFORM_LABELS[platform],
      bound: accounts.length > 0,
      accountNames,
    };
  });
}

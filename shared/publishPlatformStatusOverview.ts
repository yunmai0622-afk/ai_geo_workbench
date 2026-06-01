import {
  BINDING_PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  type BindingPublishPlatform,
} from "./platformAccountVerify";
import type { PlatformAccountOverviewGroupInput } from "./publishPlatformAccountOverview";

type StatusOverviewAccount = PlatformAccountOverviewGroupInput["accounts"][number] & {
  lastLoginAt?: Date | string | null;
};

export type PlatformStatusOverviewGroupInput = {
  readonly platform: string;
  readonly accounts: ReadonlyArray<StatusOverviewAccount>;
};

export type PlatformStatusOverviewRow =
  | {
      kind: "binding";
      platform: BindingPublishPlatform;
      label: string;
      bound: boolean;
      /** 仅知乎展示：绑定账号中最近一次登录/发布活动时间 */
      lastPublishedAt: Date | string | null;
    }
  | {
      kind: "manual";
      key: "xiaohongshu" | "wechat";
      label: string;
      detail: "人工发布";
    };

function maxLastLoginAt(
  accounts: ReadonlyArray<{ lastLoginAt?: Date | string | null }>,
): Date | string | null {
  let best: number | null = null;
  let value: Date | string | null = null;
  for (const a of accounts) {
    const raw = a.lastLoginAt;
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    if (best == null || t > best) {
      best = t;
      value = raw;
    }
  }
  return value;
}

/** 发布页顶部平台状态总览（绑定态来自 geo.platformAccounts.list） */
export function buildPublishPlatformStatusOverview(
  groups: ReadonlyArray<PlatformStatusOverviewGroupInput>,
): PlatformStatusOverviewRow[] {
  const byPlatform = new Map<string, ReadonlyArray<StatusOverviewAccount>>();
  for (const g of groups) {
    byPlatform.set(g.platform, g.accounts ?? []);
  }

  const bindingRows: PlatformStatusOverviewRow[] = BINDING_PUBLISH_PLATFORMS.map(platform => {
    const accounts = byPlatform.get(platform) ?? [];
    return {
      kind: "binding",
      platform,
      label: PUBLISH_PLATFORM_LABELS[platform],
      bound: accounts.length > 0,
      lastPublishedAt: platform === "zhihu" ? maxLastLoginAt(accounts) : null,
    };
  });

  return [
    ...bindingRows,
    { kind: "manual", key: "xiaohongshu", label: "小红书", detail: "人工发布" },
    { kind: "manual", key: "wechat", label: "公众号", detail: "人工发布" },
  ];
}

export function formatPlatformStatusLastPublished(value: Date | string | null): string {
  if (!value) return "暂无";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "暂无" : d.toLocaleString("zh-CN");
}

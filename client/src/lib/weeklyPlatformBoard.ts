import type { PublishPlatformId } from "@shared/platformContentRules";
import { PLATFORM_CONTENT_RULES, XIAOHONGSHU_STRATEGY_RESERVE } from "@shared/platformContentRules";

export type WeeklyPlatformKey = "xiaohongshu" | "zhihu" | "sohu" | "netease" | "wechat" | "other";

export type WeeklyPlatformDef = {
  key: WeeklyPlatformKey;
  label: string;
  goal: string;
  contentTypes: string;
  publishPlatformId: PublishPlatformId | null;
};

export const WEEKLY_PLATFORM_DEFS: WeeklyPlatformDef[] = [
  {
    key: "xiaohongshu",
    label: "小红书",
    goal: "补齐种草场景下的品牌识别与推荐缺口",
    contentTypes: "种草推荐、场景笔记",
    publishPlatformId: null,
  },
  {
    key: "zhihu",
    label: "知乎",
    goal: "用问答结构覆盖目标搜索问题，提升引用概率",
    contentTypes: "问题回答、经验分享",
    publishPlatformId: "zhihu",
  },
  {
    key: "sohu",
    label: "搜狐号",
    goal: "以媒体稿结构强化行业与品牌实体认知",
    contentTypes: "行业分析、品牌稿",
    publishPlatformId: "sohu",
  },
  {
    key: "netease",
    label: "网易号",
    goal: "输出趋势观察与观点稿，建立专业可信形象",
    contentTypes: "资讯观察、观点稿",
    publishPlatformId: "netease",
  },
  {
    key: "wechat",
    label: "公众号",
    goal: "沉淀长文与 FAQ，服务私域与搜索复用",
    contentTypes: "深度长文、FAQ",
    publishPlatformId: null,
  },
  {
    key: "other",
    label: "其他平台",
    goal: "按诊断建议覆盖百家号、头条号等补充渠道",
    contentTypes: "科普、问答、案例",
    publishPlatformId: null,
  },
];

export type PlatformContentCounts = {
  pending: number;
  pendingConfirm: number;
  ready: number;
  published: number;
};

export function normalizeWeeklyPlatformKey(raw: string | null | undefined): WeeklyPlatformKey {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "other";
  if (t.includes("小红书") || t.includes("xiaohongshu")) return "xiaohongshu";
  if (t.includes("知乎") || t === "zhihu") return "zhihu";
  if (t.includes("搜狐") || t === "sohu") return "sohu";
  if (t.includes("网易") || t === "netease") return "netease";
  if (t.includes("公众号") || t.includes("微信") || t === "wechat") return "wechat";
  if (t.includes("头条") || t === "toutiao") return "other";
  if (t.includes("百家") || t === "baijiahao") return "other";
  return "other";
}

export function platformLabelFromPublishId(id: PublishPlatformId): string {
  return PLATFORM_CONTENT_RULES[id].label;
}

export function resolvePublishSlugForWeeklyPlatform(key: WeeklyPlatformKey): PublishPlatformId | null {
  const def = WEEKLY_PLATFORM_DEFS.find(d => d.key === key);
  return def?.publishPlatformId ?? null;
}

export function matchTopicToPlatform(
  recommendedPlatforms: string[],
  platformLabel: string,
): boolean {
  if (recommendedPlatforms.length === 0) return true;
  return recommendedPlatforms.some(p => p.includes(platformLabel) || platformLabel.includes(p));
}

export function formatCountsLine(counts: PlatformContentCounts): string | null {
  const parts: string[] = [];
  if (counts.pending > 0) parts.push(`待生成 ${counts.pending}`);
  if (counts.pendingConfirm > 0) parts.push(`待确认 ${counts.pendingConfirm}`);
  if (counts.ready > 0) parts.push(`可发布 ${counts.ready}`);
  if (counts.published > 0) parts.push(`已发布 ${counts.published}`);
  return parts.length ? parts.join(" · ") : null;
}

export function xiaohongshuRuleSummary(): string {
  return XIAOHONGSHU_STRATEGY_RESERVE.structureHints.join("、");
}

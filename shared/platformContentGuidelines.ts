import type { PublishPlatformId } from "./platformContentRules";

export type PlatformContentGuideline = {
  label: string;
  style: string;
  length: string;
  extra?: string;
};

/** GEO-V1.1：各平台内容规范静态说明（仅展示，不参与生成逻辑） */
export const PLATFORM_CONTENT_GUIDELINES: readonly PlatformContentGuideline[] = [
  { label: "知乎", style: "问答体", length: "2000 字以上", extra: "有数据支撑" },
  { label: "搜狐号", style: "资讯体", length: "1500 字以上", extra: "有时效性" },
  { label: "百家号", style: "SEO 友好", length: "1000 字以上", extra: "关键词密度适中" },
  { label: "头条号", style: "观点鲜明", length: "800 字以上" },
  { label: "小红书", style: "种草体", length: "500 字以内", extra: "emoji 丰富" },
  { label: "公众号", style: "深度文章", length: "2000 字以上" },
] as const;

const GUIDELINE_BY_LABEL = new Map(PLATFORM_CONTENT_GUIDELINES.map(g => [g.label, g]));

const PUBLISH_ID_TO_LABEL: Partial<Record<PublishPlatformId, string>> = {
  zhihu: "知乎",
  sohu: "搜狐号",
  baijiahao: "百家号",
  toutiao: "头条号",
  xiaohongshu: "小红书",
  wechat: "公众号",
};

export function getPlatformContentGuideline(
  platformLabel: string | null | undefined,
): PlatformContentGuideline | null {
  const trimmed = platformLabel?.trim();
  if (!trimmed) return null;
  return GUIDELINE_BY_LABEL.get(trimmed) ?? null;
}

export function getPlatformContentGuidelineByPublishId(
  publishPlatformId: PublishPlatformId | null | undefined,
): PlatformContentGuideline | null {
  if (!publishPlatformId) return null;
  const label = PUBLISH_ID_TO_LABEL[publishPlatformId];
  return label ? getPlatformContentGuideline(label) : null;
}

export function formatPlatformContentGuidelineLine(guideline: PlatformContentGuideline): string {
  const parts = [guideline.style, guideline.length];
  if (guideline.extra) parts.push(guideline.extra);
  return parts.join("，");
}

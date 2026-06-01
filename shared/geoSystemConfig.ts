import { GEO_ARTICLE_MIN_PASS_SCORE } from "./const";

/** 人工发布登记可选平台（系统默认列表，管理员可在后台调整） */
export const DEFAULT_MANUAL_PUBLISH_PLATFORMS = [
  "自有内容站 / 企业官网 GEO 页面",
  "微信公众号",
  "知乎",
  "百家号",
  "头条号",
  "小红书",
  "搜狐号",
  "网易号",
  "CSDN / 掘金",
] as const;

export type GeoSystemConfigSnapshot = {
  contentGenerationPerMinuteLimit: number;
  t0DetectionPerHourLimit: number;
  qualityMinPassScore: number;
  defaultPublishPlatforms: string[];
  /** 配置来源：数据库行 / 环境变量 / 内置默认 */
  source: "database" | "environment" | "default";
  updatedAt: string | null;
};

export const GEO_SYSTEM_CONFIG_DEFAULTS = {
  contentGenerationPerMinuteLimit: 3,
  t0DetectionPerHourLimit: 1,
  qualityMinPassScore: GEO_ARTICLE_MIN_PASS_SCORE,
  defaultPublishPlatforms: [...DEFAULT_MANUAL_PUBLISH_PLATFORMS],
} as const satisfies Omit<GeoSystemConfigSnapshot, "source" | "updatedAt">;

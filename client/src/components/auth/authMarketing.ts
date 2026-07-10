import { whiteLabel } from "@/lib/whiteLabel";

export const PLATFORM_PRODUCT_NAME = whiteLabel.agencyName;

export const PLATFORM_PRODUCT_SUBTITLE = whiteLabel.loginSubtitle;

export const AUTH_PRODUCT_NAME = whiteLabel.loginTitle;

export const AUTH_PRODUCT_TAGLINE = PLATFORM_PRODUCT_SUBTITLE;

export const AUTH_PRODUCT_SELLING_POINTS = [
  "从企业档案到问题库、内容资产的一体化 GEO 增长流程",
  "AI 内容诊断与周更资产生产，支撑可引用、可发布的专业内容",
  "发布记录、收录监测与客户交付报告，让增长进展看得见",
] as const;

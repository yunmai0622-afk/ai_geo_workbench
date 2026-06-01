/** 跨端共享业务常量（客户可见文案与稳定枚举值） */

export { COOKIE_NAME, GEO_ARTICLE_MIN_PASS_SCORE, ONE_YEAR_MS } from "./const";

/** legacy `geo_articles.status` 中文终态（与 DB / 列表筛选一致） */
export const GEO_ARTICLE_STATUS_PUBLISHED = "已发布" as const;

export const GEO_ARTICLE_STATUS_DRAFT_LABEL = "草稿" as const;
export const GEO_ARTICLE_STATUS_PUBLISHABLE_LABEL = "可发布" as const;

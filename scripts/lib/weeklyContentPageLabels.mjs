/** C5-B 内容资产生产页（/weekly）当前产品文案，供验收脚本共用 */

export const WEEKLY_CONTENT_PAGE_WAIT = "AI 内容资产生产控制台";

/** 源码与页面均存在的固定文案 */
export const WEEKLY_CONTENT_PAGE_LABELS = [
  "AI 内容资产生产控制台",
  "生成内容资产",
  "生成数量",
  "自定义",
];

/** WeeklyContentPage.tsx 中 segmented 数量选项（源码形态） */
export const WEEKLY_CONTENT_PAGE_SOURCE_SEGMENT_MARKERS = [
  '["7", "14", "21", "custom"]',
  "${key} 篇",
];

/** 浏览器渲染后的 segmented 文案（Playwright 全链路验收） */
export const WEEKLY_CONTENT_PAGE_RENDERED_SEGMENT_LABELS = ["7 篇", "14 篇", "21 篇"];

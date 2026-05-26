/** 平台化内容生产页（/weekly）当前产品文案，供验收脚本共用 */

export const WEEKLY_CONTENT_PAGE_LABELS = [
  "平台化内容资产",
  "生成该平台内容",
  "不支持一稿多发",
  "weekly-platform-content-page",
  "去 AI 实测诊断",
];

export const WEEKLY_CONTENT_PAGE_SOURCE_SEGMENT_MARKERS = [
  "PlatformContentBoard",
  "WeeklyPlatformArticleCard",
];

/** 浏览器渲染后的 segmented 文案（Playwright 全链路验收） */
export const WEEKLY_CONTENT_PAGE_RENDERED_SEGMENT_LABELS = ["7 篇", "14 篇", "21 篇"];

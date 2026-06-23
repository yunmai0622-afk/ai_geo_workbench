/** 平台化内容生产页（/weekly）当前产品文案，供验收脚本共用 */

export const WEEKLY_CONTENT_PAGE_LABELS = [
  "内容任务推进",
  "weekly-platform-content-page",
  "去 AI 实测诊断",
  "CurrentContentTaskCard",
  "PlatformTaskBoard",
];

export const WEEKLY_CONTENT_PAGE_SOURCE_SEGMENT_MARKERS = [
  "PlatformTaskBoard",
  "PlatformContentBoard",
  "WeeklyAdvancedInfoSections",
];

/** 浏览器渲染后的 segmented 文案（Playwright 全链路验收） */
export const WEEKLY_CONTENT_PAGE_RENDERED_SEGMENT_LABELS = ["7 篇", "14 篇", "21 篇"];

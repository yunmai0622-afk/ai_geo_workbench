/** GEO-V1.1-Publish-Time-Suggest：加入发布队列时的静态发布时间建议 */

export const PUBLISH_TIME_SUGGEST_ZHIHU = "工作日上午 10:00 或下午 15:00";
export const PUBLISH_TIME_SUGGEST_SOHU = "工作日上午 9:00";
export const PUBLISH_TIME_SUGGEST_BAIJIAHAO = "每天上午 10:00";
export const PUBLISH_TIME_SUGGEST_DEFAULT = "工作日白天";

/** 按发布平台 slug 返回客户可读的发布时间建议（静态文案，不做动态计算） */
export function getPublishTimeSuggest(platform: string): string {
  if (platform === "zhihu") return PUBLISH_TIME_SUGGEST_ZHIHU;
  if (platform === "sohu") return PUBLISH_TIME_SUGGEST_SOHU;
  if (platform === "baijiahao") return PUBLISH_TIME_SUGGEST_BAIJIAHAO;
  return PUBLISH_TIME_SUGGEST_DEFAULT;
}

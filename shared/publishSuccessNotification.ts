/** GEO-V1.1-Publish-Success-Toast：发布成功通知文案（Web / 测试共用） */

export const PUBLISH_SUCCESS_NOTIFICATION_TITLE = "发布成功";
export const PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL = "查看文章";
export const PUBLISH_SUCCESS_GO_TO_INCLUSION_LABEL = "去收录监测";
export const PUBLISH_SUCCESS_DISMISS_LABEL = "知道了";
export const PUBLISH_SUCCESS_NEXT_STEP = "建议7天后执行复测";

export function formatPublishSuccessPlatformPhrase(platformLabels: string[]): string {
  const unique = [...new Set(platformLabels.map(l => l.trim()).filter(Boolean))];
  if (unique.length === 0) return "目标平台";
  if (unique.length === 1) return unique[0]!;
  return unique.join("、");
}

export function formatPublishSuccessBody(platformLabel: string): string {
  const label = platformLabel.trim() || "目标平台";
  return `文章已发布到 ${label}，建议 7 天后执行 AI 复测，确认内容是否被收录并影响 AI 推荐结果。`;
}

export function resolvePublishSuccessArticleUrl(
  urls: Array<string | null | undefined>,
): string | null {
  for (const raw of urls) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  }
  return null;
}

import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";

export type DeliveryReportPublishedItem = {
  title: string;
  platform: string;
  publishedAt: string | null;
  url: string | null;
};

export const DEFAULT_REPORT_SUGGESTIONS = [
  "根据本轮 AI 搜索实测，优先补齐品牌在典型问答场景中的可引用内容与结构化表达。",
  "对已发布内容保持监测，在内容稳定收录后安排发布前与发布后复测。",
  "若竞品在 AI 回答中占位上升，及时更新品牌叙事并在下一轮实测中验证效果。",
] as const;

export function buildHeroSummaryLine(conclusionLine: string, visibilityScore: number | null): string {
  const trimmed = conclusionLine.trim();
  if (trimmed) {
    const first = trimmed.split(/[。；\n]/)[0]?.trim();
    if (first && first.length <= 120) return first.endsWith("。") ? first : `${first}。`;
  }
  if (visibilityScore != null) return `本轮 AI 搜索可见度综合评分为 ${visibilityScore} 分，建议结合下方实测结果持续优化品牌可见度。`;
  return "请先完成 AI 搜索实测，以便生成面向客户的核心结论。";
}

export function buildEngineMentionSubtitle(
  byEngine: AiTestEvidenceAggregate["byEngine"],
  mentionRate: number,
  recommendRate: number,
): string {
  const engines = byEngine.filter(e => e.questionCount > 0);
  if (engines.length === 0) {
    return "完成 AI 搜索实测后，将展示各主流 AI 引擎中的品牌提及与推荐表现。";
  }
  const names = engines.map(e => e.engineName).join(" / ");
  return `品牌在 ${names} 中提及率 ${Math.round(mentionRate * 100)}%，推荐率 ${Math.round(recommendRate * 100)}%`;
}

export function showPublishCompareSection(compare: AiTestEvidenceAggregate["publishCompare"]): boolean {
  return compare.before.hasData || compare.after.hasData;
}

export function formatPublishedAtLabel(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function mapPublishRecordsToItems(
  records: Array<Record<string, unknown>>,
  titleByArticleId: Map<number, string>,
): DeliveryReportPublishedItem[] {
  return records.map(r => {
    const articleId = typeof r.articleId === "number" ? r.articleId : null;
    const title =
      (articleId != null ? titleByArticleId.get(articleId) : undefined) ??
      (typeof r.publishTitle === "string" ? r.publishTitle : undefined) ??
      (typeof r.title === "string" ? r.title : undefined) ??
      "未命名内容";
    const platform = String(r.publishChannel ?? r.platform ?? "—");
    const url =
      (typeof r.publishUrl === "string" && r.publishUrl) ||
      (typeof r.publicUrl === "string" && r.publicUrl) ||
      null;
    const publishedAt = formatPublishedAtLabel(
      (r.publishedAt ?? r.published_at) as Date | string | null | undefined,
    );
    return { title, platform, publishedAt, url };
  });
}

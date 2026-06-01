import { isCompletedTestRound, type TestRoundRow } from "./workspaceMainChain";

export const BRAND_MENTION_RATE_THRESHOLD = 0.1;
export const INDUSTRY_RECOMMEND_RATE_THRESHOLD = 0.05;
export const T1_RETEST_AFTER_T0_DAYS = 14;

const MS_PER_DAY = 86_400_000;

export type GeoGrowthSuggestionId =
  | "brand_awareness_content"
  | "industry_recommend_content"
  | "expand_cross_platform"
  | "t1_retest"
  | "pending_publish";

export type GeoGrowthSuggestion = {
  id: GeoGrowthSuggestionId;
  message: string;
  actionLabel: string;
  /** 不含 projectId，由前端 buildProjectUrl 拼接 */
  actionPath: string;
};

export type GeoGrowthSuggestionInput = {
  mentionRate: number | null;
  recommendRate: number | null;
  distinctPublishPlatformCount: number;
  unpublishedArticleCount: number;
  hasCompletedT0Baseline: boolean;
  hasCompletedT1Retest: boolean;
  t0FinishedAt: Date | string | null;
  now?: Date;
};

export function countDistinctPublishPlatforms(
  records: Array<{ publishChannel?: string | null }>,
): number {
  const channels = new Set<string>();
  for (const record of records) {
    const channel = (record.publishChannel ?? "").trim();
    if (channel) channels.add(channel);
  }
  return channels.size;
}

export function countUnpublishedArticles(articles: Array<{ status?: string | null }>): number {
  return articles.filter(article => (article.status ?? "").trim() !== "已发布").length;
}

export function findLatestT0FinishedAt(rounds: TestRoundRow[]): Date | string | null {
  let latest: number | null = null;
  let value: Date | string | null = null;

  for (const round of rounds) {
    if (round.roundType !== "T0_BASELINE" || !isCompletedTestRound(round)) continue;
    const at = round.finishedAt ?? null;
    if (!at) continue;
    const ts = new Date(at).getTime();
    if (Number.isNaN(ts)) continue;
    if (latest == null || ts > latest) {
      latest = ts;
      value = at;
    }
  }

  return value;
}

export function shouldSuggestT1Retest(input: Pick<
  GeoGrowthSuggestionInput,
  "hasCompletedT0Baseline" | "hasCompletedT1Retest" | "t0FinishedAt" | "now"
>): boolean {
  if (!input.hasCompletedT0Baseline || input.hasCompletedT1Retest) return false;
  if (!input.t0FinishedAt) return false;
  const finishedMs = new Date(input.t0FinishedAt).getTime();
  if (Number.isNaN(finishedMs)) return false;
  const now = input.now ?? new Date();
  const elapsedDays = (now.getTime() - finishedMs) / MS_PER_DAY;
  return elapsedDays > T1_RETEST_AFTER_T0_DAYS;
}

export function buildGeoGrowthSuggestions(input: GeoGrowthSuggestionInput): GeoGrowthSuggestion[] {
  const suggestions: GeoGrowthSuggestion[] = [];

  if (input.mentionRate != null && input.mentionRate < BRAND_MENTION_RATE_THRESHOLD) {
    suggestions.push({
      id: "brand_awareness_content",
      message: "建议发布品牌认知类内容",
      actionLabel: "生成品牌认知内容",
      actionPath: "/weekly",
    });
  }

  if (input.recommendRate != null && input.recommendRate < INDUSTRY_RECOMMEND_RATE_THRESHOLD) {
    suggestions.push({
      id: "industry_recommend_content",
      message: "建议发布行业推荐类内容",
      actionLabel: "生成行业推荐内容",
      actionPath: "/weekly",
    });
  }

  if (input.distinctPublishPlatformCount === 1) {
    suggestions.push({
      id: "expand_cross_platform",
      message: "建议扩展到搜狐号/百家号增加交叉信源",
      actionLabel: "去多平台发布",
      actionPath: "/content-publishing",
    });
  }

  if (shouldSuggestT1Retest(input)) {
    suggestions.push({
      id: "t1_retest",
      message: "建议执行T1复测",
      actionLabel: "执行T1复测",
      actionPath: "/ai-diagnosis",
    });
  }

  if (input.unpublishedArticleCount > 0) {
    suggestions.push({
      id: "pending_publish",
      message: `有${input.unpublishedArticleCount}篇内容待发布`,
      actionLabel: "去发布",
      actionPath: "/content-publishing",
    });
  }

  return suggestions;
}

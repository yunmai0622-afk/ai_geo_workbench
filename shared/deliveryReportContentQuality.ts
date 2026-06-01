import { computeAverageGeoQualityScore } from "./geoQualityScoreDisplay";

export type DeliveryReportContentQualityPlatformStat = {
  platformLabel: string;
  articleCount: number;
  averageScore: number | null;
  passCount: number;
  failCount: number;
};

export type DeliveryReportContentQualityFailedItem = {
  articleId: number;
  title: string;
  platformLabel: string;
  totalScore: number | null;
  reasons: string[];
};

export type DeliveryReportContentQualityPriorityItem = {
  articleId: number;
  title: string;
  platformLabel: string;
  totalScore: number;
  suggestion: string;
};

export type DeliveryReportContentQualitySummary = {
  generatedArticleCount: number;
  scoredArticleCount: number;
  averageScore: number | null;
  platformDistribution: DeliveryReportContentQualityPlatformStat[];
  failedItems: DeliveryReportContentQualityFailedItem[];
  priorityItems: DeliveryReportContentQualityPriorityItem[];
};

export type ContentQualityReportArticleRow = {
  id: number;
  title: string;
  status: string;
  targetPlatformLabel: string;
};

export type ContentQualityReportScoreRow = {
  articleId: number;
  totalScore: number;
  blocked: number | boolean;
  blockReasons: string[];
  reviewSummary: string;
};

const GENERATED_STATUSES_EXCLUDED = new Set(["待生成"]);

export function hasComplianceQualityBlock(blockReasons: string[]): boolean {
  return blockReasons.some(reason => /禁用词|禁止承诺|合规/.test(reason));
}

export function isGeoArticleQualityScorePass(
  score: Pick<ContentQualityReportScoreRow, "totalScore" | "blocked" | "blockReasons">,
  minPassScore: number,
): boolean {
  const blockReasons = Array.isArray(score.blockReasons) ? score.blockReasons : [];
  const blocked = Boolean(score.blocked);
  return !blocked && score.totalScore >= minPassScore && !hasComplianceQualityBlock(blockReasons);
}

export function formatContentQualityPlatformDistributionLine(
  stats: DeliveryReportContentQualityPlatformStat[],
): string {
  if (stats.length === 0) return "暂无已评分内容";
  return stats
    .map(row => {
      const avg = row.averageScore == null ? "—" : `${row.averageScore}分`;
      return `${row.platformLabel} ${row.articleCount}篇（均分 ${avg}，未通过 ${row.failCount}）`;
    })
    .join(" / ");
}

function resolveFailedReasons(
  score: ContentQualityReportScoreRow | undefined,
  status: string,
  minPassScore: number,
): string[] {
  if (!score) {
    if (status === "质检未通过") return ["内容质检未通过，请修订后重新质检"];
    return ["尚未完成质检评分"];
  }
  const blockReasons = Array.isArray(score.blockReasons) ? score.blockReasons.filter(Boolean) : [];
  if (blockReasons.length > 0) return blockReasons.slice(0, 3);
  if (Boolean(score.blocked)) return ["存在质检阻断项，暂不建议发布"];
  if (score.totalScore < minPassScore) {
    return [`质量分 ${score.totalScore} 低于 ${minPassScore} 分参考线`];
  }
  const summary = (score.reviewSummary ?? "").trim();
  if (summary) return [summary.length > 120 ? `${summary.slice(0, 120)}…` : summary];
  return ["未达发布前质检要求"];
}

function resolvePrioritySuggestion(score: ContentQualityReportScoreRow, minPassScore: number): string {
  const blockReasons = Array.isArray(score.blockReasons) ? score.blockReasons : [];
  if (blockReasons[0]) return blockReasons[0];
  if (score.totalScore < minPassScore) {
    return `优先将质量分从 ${score.totalScore} 提升至 ${minPassScore} 分以上`;
  }
  const summary = (score.reviewSummary ?? "").trim();
  if (summary) return summary.length > 80 ? `${summary.slice(0, 80)}…` : summary;
  return "建议按质检摘要修订标题、结构与可引用片段";
}

/**
 * 基于 geo_articles + geo_article_quality_scores 汇总交付报告「内容质量」模块。
 * - 仅统计已生成文章（status 非「待生成」）
 * - 每篇文章取最新一条质检分
 */
export function buildDeliveryReportContentQualitySummary(
  articles: ContentQualityReportArticleRow[],
  qualityRows: ContentQualityReportScoreRow[],
  options?: {
    minPassScore?: number;
    maxFailedItems?: number;
    maxPriorityItems?: number;
  },
): DeliveryReportContentQualitySummary {
  const minPassScore = options?.minPassScore ?? 60;
  const maxFailedItems = options?.maxFailedItems ?? 8;
  const maxPriorityItems = options?.maxPriorityItems ?? 5;

  const generatedArticles = articles.filter(article => !GENERATED_STATUSES_EXCLUDED.has(article.status));
  const latestScoreByArticle = new Map<number, ContentQualityReportScoreRow>();
  for (const row of qualityRows) {
    if (!latestScoreByArticle.has(row.articleId)) {
      latestScoreByArticle.set(row.articleId, row);
    }
  }

  const scoredArticleCount = generatedArticles.filter(article => latestScoreByArticle.has(article.id)).length;
  const averageScore = computeAverageGeoQualityScore(
    generatedArticles.map(article => latestScoreByArticle.get(article.id)?.totalScore ?? null),
  );

  const platformBuckets = new Map<
    string,
    { scores: number[]; passCount: number; failCount: number; articleCount: number }
  >();

  for (const article of generatedArticles) {
    const platformLabel = (article.targetPlatformLabel ?? "").trim() || "待指定平台";
    const bucket = platformBuckets.get(platformLabel) ?? {
      scores: [],
      passCount: 0,
      failCount: 0,
      articleCount: 0,
    };
    bucket.articleCount += 1;
    const score = latestScoreByArticle.get(article.id);
    if (score) {
      bucket.scores.push(score.totalScore);
      if (isGeoArticleQualityScorePass(score, minPassScore)) bucket.passCount += 1;
      else bucket.failCount += 1;
    }
    platformBuckets.set(platformLabel, bucket);
  }

  const platformDistribution = [...platformBuckets.entries()]
    .map(([platformLabel, bucket]) => ({
      platformLabel,
      articleCount: bucket.articleCount,
      averageScore: computeAverageGeoQualityScore(bucket.scores),
      passCount: bucket.passCount,
      failCount: bucket.failCount,
    }))
    .sort((a, b) => b.articleCount - a.articleCount || a.platformLabel.localeCompare(b.platformLabel, "zh-CN"));

  const failedItems: DeliveryReportContentQualityFailedItem[] = [];
  for (const article of generatedArticles) {
    const score = latestScoreByArticle.get(article.id);
    const legacyFailed = article.status === "质检未通过" || article.status === "审核未通过";
    const scoredFailed = score ? !isGeoArticleQualityScorePass(score, minPassScore) : false;
    if (!legacyFailed && !scoredFailed) continue;
    failedItems.push({
      articleId: article.id,
      title: article.title.trim() || "未命名内容",
      platformLabel: (article.targetPlatformLabel ?? "").trim() || "待指定平台",
      totalScore: score?.totalScore ?? null,
      reasons: resolveFailedReasons(score, article.status, minPassScore),
    });
  }
  failedItems.sort((a, b) => (a.totalScore ?? -1) - (b.totalScore ?? -1));

  const priorityItems: DeliveryReportContentQualityPriorityItem[] = generatedArticles
    .map(article => {
      const score = latestScoreByArticle.get(article.id);
      if (!score || isGeoArticleQualityScorePass(score, minPassScore)) return null;
      return {
        articleId: article.id,
        title: article.title.trim() || "未命名内容",
        platformLabel: (article.targetPlatformLabel ?? "").trim() || "待指定平台",
        totalScore: score.totalScore,
        suggestion: resolvePrioritySuggestion(score, minPassScore),
      };
    })
    .filter((row): row is DeliveryReportContentQualityPriorityItem => row != null)
    .sort((a, b) => a.totalScore - b.totalScore)
    .slice(0, maxPriorityItems);

  return {
    generatedArticleCount: generatedArticles.length,
    scoredArticleCount,
    averageScore,
    platformDistribution,
    failedItems: failedItems.slice(0, maxFailedItems),
    priorityItems,
  };
}

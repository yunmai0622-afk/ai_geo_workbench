import {
  COMPETITOR_CONTENT_PLATFORMS,
  listActivePlatformLabels,
  parseCompetitorContentAssets,
  platformLabel,
  type CompetitorPlatformKey,
} from "./competitorContentPlatforms";

export type CompetitorAnalysisRow = {
  id: number;
  competitorName: string;
  aiMentionCount: number;
  advantageDescription: string;
  platformDistribution: Partial<Record<CompetitorPlatformKey, boolean>>;
  contentAssetsNote: string;
};

export type CompetitorAnalysisSummaryInput = {
  brandName: string;
  competitors: Array<{
    id: number;
    competitorName: string;
    strengths?: string | null;
    contentAssets?: string | null;
    aiRecommendationSignals?: string | null;
  }>;
  aiMentionCounts: Record<string, number>;
  totalAiTestRuns: number;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** 将 ai_test_runs.competitorNames 聚合到档案竞品名称（模糊匹配）。 */
export function aggregateCompetitorMentionCounts(
  profileNames: string[],
  runMentions: string[][],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of profileNames) {
    counts[name] = 0;
  }

  for (const mentions of runMentions) {
    for (const mention of mentions) {
      const normalizedMention = normalizeName(mention);
      if (!normalizedMention) continue;
      for (const profileName of profileNames) {
        const normalizedProfile = normalizeName(profileName);
        if (
          normalizedMention === normalizedProfile ||
          normalizedMention.includes(normalizedProfile) ||
          normalizedProfile.includes(normalizedMention)
        ) {
          counts[profileName] = (counts[profileName] ?? 0) + 1;
        }
      }
    }
  }

  return counts;
}

function buildAdvantageDescription(row: CompetitorAnalysisSummaryInput["competitors"][number]): string {
  const strengths = String(row.strengths ?? "").trim();
  if (strengths) return strengths;
  const signals = String(row.aiRecommendationSignals ?? "").trim();
  if (signals) return signals;
  return "暂未填写相对优势描述，可在竞品档案中补充 strengths 字段。";
}

export function buildCompetitorAnalysisRows(input: CompetitorAnalysisSummaryInput): CompetitorAnalysisRow[] {
  return input.competitors.map(row => {
    const parsed = parseCompetitorContentAssets(row.contentAssets);
    return {
      id: row.id,
      competitorName: row.competitorName,
      aiMentionCount: input.aiMentionCounts[row.competitorName] ?? 0,
      advantageDescription: buildAdvantageDescription(row),
      platformDistribution: parsed.platforms,
      contentAssetsNote: parsed.note,
    };
  });
}

/** 基于竞品档案与 AI 实测提及频次，生成建议补充的内容类型。 */
export function buildCompetitorContentSuggestions(input: CompetitorAnalysisSummaryInput): string[] {
  const rows = buildCompetitorAnalysisRows(input);
  const suggestions: string[] = [];

  const highMention = rows.filter(row => row.aiMentionCount >= 2).map(row => row.competitorName);
  if (highMention.length > 0) {
    suggestions.push(
      `建议补充「竞品对比页」：AI 实测中 ${highMention.join("、")} 出现频次较高，需用客观对比说明 ${input.brandName || "本品牌"} 的差异化价值。`,
    );
  }

  const platformCoverage = new Map<CompetitorPlatformKey, string[]>();
  for (const row of rows) {
    for (const platform of COMPETITOR_CONTENT_PLATFORMS) {
      if (row.platformDistribution[platform.key]) {
        const list = platformCoverage.get(platform.key) ?? [];
        list.push(row.competitorName);
        platformCoverage.set(platform.key, list);
      }
    }
  }

  for (const platform of COMPETITOR_CONTENT_PLATFORMS) {
    const names = platformCoverage.get(platform.key);
    if (names && names.length > 0) {
      suggestions.push(
        `建议补充「${platform.label}内容」：${names.join("、")} 在该平台已有公开内容，${input.brandName || "本品牌"} 可补齐同类型选型/对比/FAQ 内容以提升 AI 引用概率。`,
      );
    }
  }

  if (rows.some(row => listActivePlatformLabels(row.platformDistribution).length === 0)) {
    suggestions.push("建议逐条确认竞品公开内容分布（知乎/搜狐/百家号等），便于判断优先补哪些平台的内容。");
  }

  if (input.totalAiTestRuns === 0) {
    suggestions.push("尚未有 AI 实测数据，完成 AI 实测诊断后可更准确判断竞品提及频次。");
  } else if (highMention.length === 0) {
    suggestions.push("当前 AI 实测中竞品提及频次较低，仍建议预先准备 FAQ 与客户案例，避免后续样本扩大后失位。");
  }

  suggestions.push("建议补充「FAQ 问答集」与「客户案例页」，降低 AI 只引用竞品公开语料的概率。");

  return Array.from(new Set(suggestions)).slice(0, 8);
}

export { platformLabel, listActivePlatformLabels };

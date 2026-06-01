import { aggregateT0AiTestRunMetrics } from "./t0AiTestRunMetrics";
import { resolvePlatformDisplayLabel } from "./retestComparisonDisplay";

export type AiTestRunVisualizationRow = {
  questionId: number;
  platform: string;
  mentionedCompany: boolean;
  recommendedCompany: boolean;
  competitorMentioned: boolean;
  hasSourceLinks: boolean;
};

export type GeoScoreBarItem = {
  key: string;
  label: string;
  percent: number;
  sampleCount: number;
};

export type QuestionTypeHitRateItem = {
  key: string;
  label: string;
  percent: number;
  sampleCount: number;
};

export type PlatformMentionItem = {
  platform: string;
  label: string;
  percent: number;
  sampleCount: number;
};

export type T0DiagnosisVisualization = {
  geoScoreBars: GeoScoreBarItem[];
  questionTypeHitRates: QuestionTypeHitRateItem[];
  platformComparison: PlatformMentionItem[];
  totalRuns: number;
  dataSource: "ai_test_runs";
};

export const DIAGNOSIS_HIT_QUESTION_TYPES = [
  { key: "品牌认知", label: "品牌认知类" },
  { key: "行业推荐", label: "行业推荐类" },
  { key: "竞品对比", label: "竞品对比类" },
  { key: "scenario_need", label: "场景需求类" },
  { key: "long_tail_conversion", label: "长尾转化类" },
] as const;

const DIAGNOSIS_PLATFORM_ORDER = ["doubao", "kimi", "deepseek"] as const;

const GEO_SCORE_BAR_DEFS = [
  { key: "brand_recognition", label: "品牌识别率", questionType: "品牌认知", metric: "mention" as const },
  { key: "industry_recommend", label: "行业推荐率", questionType: "行业推荐", metric: "recommend" as const },
  { key: "scenario_coverage", label: "场景覆盖率", questionType: "scenario_need", metric: "mention" as const },
  { key: "competitor_resistance", label: "竞品压制情况", metric: "competitor_resistance" as const },
  { key: "content_asset", label: "内容资产完整度", metric: "source_links" as const },
] as const;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizePlatform(platform: string): string {
  const key = platform.trim().toLowerCase();
  if (key === "doubao" || key === "豆包") return "doubao";
  if (key === "kimi") return "kimi";
  if (key === "deepseek") return "deepseek";
  return key;
}

function runsForQuestionType(
  runs: AiTestRunVisualizationRow[],
  questionTypeByQuestionId: Map<number, string>,
  questionType: string,
): AiTestRunVisualizationRow[] {
  return runs.filter(run => questionTypeByQuestionId.get(run.questionId) === questionType);
}

function mentionPercent(runs: AiTestRunVisualizationRow[]): number {
  const metrics = aggregateT0AiTestRunMetrics(runs);
  return metrics ? clampPercent(metrics.mentionRate * 100) : 0;
}

function recommendPercent(runs: AiTestRunVisualizationRow[]): number {
  const metrics = aggregateT0AiTestRunMetrics(runs);
  return metrics ? clampPercent(metrics.recommendRate * 100) : 0;
}

function competitorResistancePercent(runs: AiTestRunVisualizationRow[]): number {
  if (runs.length === 0) return 0;
  const withCompetitor = runs.filter(run => run.competitorMentioned);
  if (withCompetitor.length === 0) {
    const resilient = runs.filter(run => run.mentionedCompany || run.recommendedCompany).length;
    return clampPercent((resilient / runs.length) * 100);
  }
  const resilient = withCompetitor.filter(run => run.mentionedCompany || run.recommendedCompany).length;
  return clampPercent((resilient / withCompetitor.length) * 100);
}

function sourceLinksPercent(runs: AiTestRunVisualizationRow[]): number {
  if (runs.length === 0) return 0;
  const withLinks = runs.filter(run => run.hasSourceLinks).length;
  return clampPercent((withLinks / runs.length) * 100);
}

export function buildT0DiagnosisVisualization(
  runs: AiTestRunVisualizationRow[],
  questionTypeByQuestionId: Map<number, string>,
): T0DiagnosisVisualization | null {
  if (runs.length === 0) return null;

  const geoScoreBars: GeoScoreBarItem[] = GEO_SCORE_BAR_DEFS.map(def => {
    if (def.metric === "competitor_resistance") {
      return {
        key: def.key,
        label: def.label,
        percent: competitorResistancePercent(runs),
        sampleCount: runs.length,
      };
    }
    if (def.metric === "source_links") {
      return {
        key: def.key,
        label: def.label,
        percent: sourceLinksPercent(runs),
        sampleCount: runs.length,
      };
    }
    const scopedRuns = runsForQuestionType(runs, questionTypeByQuestionId, def.questionType);
    const percent =
      def.metric === "recommend" ? recommendPercent(scopedRuns) : mentionPercent(scopedRuns);
    return {
      key: def.key,
      label: def.label,
      percent,
      sampleCount: scopedRuns.length,
    };
  });

  const questionTypeHitRates: QuestionTypeHitRateItem[] = DIAGNOSIS_HIT_QUESTION_TYPES.map(item => {
    const scopedRuns = runsForQuestionType(runs, questionTypeByQuestionId, item.key);
    return {
      key: item.key,
      label: item.label,
      percent: mentionPercent(scopedRuns),
      sampleCount: scopedRuns.length,
    };
  });

  const platformComparison: PlatformMentionItem[] = DIAGNOSIS_PLATFORM_ORDER.map(platform => {
    const scopedRuns = runs.filter(run => normalizePlatform(run.platform) === platform);
    return {
      platform,
      label: resolvePlatformDisplayLabel(platform),
      percent: mentionPercent(scopedRuns),
      sampleCount: scopedRuns.length,
    };
  });

  return {
    geoScoreBars,
    questionTypeHitRates,
    platformComparison,
    totalRuns: runs.length,
    dataSource: "ai_test_runs",
  };
}

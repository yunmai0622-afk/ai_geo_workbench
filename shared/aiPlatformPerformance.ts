import { T0_AI_ENGINE_OPTIONS, T0_DIAGNOSIS_PLATFORM_ORDER, normalizeT0Platform } from "./t0DiagnosisDisplay";

export type AiPlatformPerformanceStatus =
  | "未实测"
  | "未覆盖"
  | "已提及"
  | "已推荐"
  | "竞品占优";

export type AiPlatformPerformanceRow = {
  platformId: string;
  platformName: string;
  testedCount: number;
  mentionCount: number;
  recommendCount: number;
  citationCount: number;
  competitorCount: number;
  status: AiPlatformPerformanceStatus;
  summary: string;
};

export type AiPlatformPerformanceRunInput = {
  platform: string;
  mentionedCompany: boolean;
  recommendedCompany: boolean;
  competitorMentioned?: boolean;
  hasSourceLinks?: boolean;
};

function resolvePlatformStatus(input: {
  testedCount: number;
  mentionCount: number;
  recommendCount: number;
  competitorCount: number;
}): AiPlatformPerformanceStatus {
  if (input.testedCount <= 0) return "未实测";
  if (input.mentionCount <= 0) return "未覆盖";
  if (input.competitorCount > input.recommendCount) return "竞品占优";
  if (input.recommendCount > 0) return "已推荐";
  return "已提及";
}

function buildPlatformSummary(
  platformName: string,
  status: AiPlatformPerformanceStatus,
  input: {
    testedCount: number;
    mentionCount: number;
    recommendCount: number;
    competitorCount: number;
  },
): string {
  if (status === "未实测") return "本轮未实测";
  if (status === "未覆盖") {
    return `${platformName} 已实测 ${input.testedCount} 次，但 AI 回答中尚未提及本品牌。`;
  }
  if (status === "竞品占优") {
    return `${platformName} 提及本品牌 ${input.mentionCount} 次，但竞品出现 ${input.competitorCount} 次，高于推荐 ${input.recommendCount} 次。`;
  }
  if (status === "已推荐") {
    return `${platformName} 在 ${input.testedCount} 次实测中推荐本品牌 ${input.recommendCount} 次，表现稳定。`;
  }
  return `${platformName} 已提及本品牌 ${input.mentionCount} 次，但推荐信号仍不足，建议补强内容。`;
}

export function aggregateAiPlatformPerformance(
  runs: AiPlatformPerformanceRunInput[],
): AiPlatformPerformanceRow[] {
  const labelByPlatform = new Map(T0_AI_ENGINE_OPTIONS.map(option => [option.id, option.label]));
  const buckets = new Map<string, AiPlatformPerformanceRunInput[]>();

  for (const run of runs) {
    const platformId = normalizeT0Platform(run.platform);
    const bucket = buckets.get(platformId) ?? [];
    bucket.push(run);
    buckets.set(platformId, bucket);
  }

  return T0_DIAGNOSIS_PLATFORM_ORDER.map(platformId => {
    const groupRuns = buckets.get(platformId) ?? [];
    const testedCount = groupRuns.length;
    const mentionCount = groupRuns.filter(run => run.mentionedCompany).length;
    const recommendCount = groupRuns.filter(run => run.recommendedCompany).length;
    const competitorCount = groupRuns.filter(run => run.competitorMentioned).length;
    const citationCount = groupRuns.filter(run => run.hasSourceLinks).length;
    const platformName = labelByPlatform.get(platformId as (typeof T0_AI_ENGINE_OPTIONS)[number]["id"]) ?? platformId;
    const status = resolvePlatformStatus({
      testedCount,
      mentionCount,
      recommendCount,
      competitorCount,
    });
    return {
      platformId,
      platformName,
      testedCount,
      mentionCount,
      recommendCount,
      citationCount,
      competitorCount,
      status,
      summary: buildPlatformSummary(platformName, status, {
        testedCount,
        mentionCount,
        recommendCount,
        competitorCount,
      }),
    };
  });
}

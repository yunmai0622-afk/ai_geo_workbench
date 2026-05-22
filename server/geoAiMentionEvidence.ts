import type {
  AiTestCompetitorMention,
  AiTestEvidenceItem,
  AiTestParseStatus,
  AiTestSentiment,
  AiTestStage,
} from "@shared/aiTestEvidence";
import { eq } from "drizzle-orm";
import { competitorProfiles, enterpriseGeoProfiles, projects } from "../drizzle/schema";
import type { AiEngine, AiTestResult } from "./geoAiMentionCheck";
import { analyzeAnswer } from "./geoAiMentionCheck";
import type { getDb } from "./db";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

const URL_PATTERN = /https?:\/\/[^\s)\]>"'，。；]+/gi;
const NEGATIVE_KEYWORDS = ["不推荐", "不建议", "风险", "缺点", "不足", "不好", "谨慎", "问题较多", "有待", "劣势"];
const POSITIVE_KEYWORDS = ["推荐", "首选", "优质", "领先", "值得", "不错", "适合", "优势明显", "值得信赖"];

export function extractCitedUrls(answer: string): string[] {
  const matches = answer.match(URL_PATTERN) ?? [];
  return uniqueStrings(matches.map(u => u.replace(/[.,;:!?）)]+$/, "").trim()).filter(Boolean)).slice(0, 20);
}

export function analyzeSentiment(
  answer: string,
  brandNames: string[],
  mentionsBrand: boolean,
  recommendsBrand: boolean,
): AiTestSentiment {
  if (!mentionsBrand) return "neutral";

  const hasNegative = NEGATIVE_KEYWORDS.some(kw => {
    const idx = answer.indexOf(kw);
    if (idx === -1) return false;
    const ctx = answer.slice(Math.max(0, idx - 40), idx + 40);
    return brandNames.some(name => ctx.includes(name));
  });
  if (hasNegative) return "negative";

  const hasPositive =
    recommendsBrand ||
    POSITIVE_KEYWORDS.some(kw => {
      const idx = answer.indexOf(kw);
      if (idx === -1) return false;
      const ctx = answer.slice(Math.max(0, idx - 40), idx + 40);
      return brandNames.some(name => ctx.includes(name));
    });
  if (hasPositive) return "positive";

  return "neutral";
}

function excerptContext(answer: string, index: number, radius = 60) {
  return answer.slice(Math.max(0, index - radius), Math.min(answer.length, index + radius)).trim();
}

function detectRankBefore(answer: string, index: number): number | null {
  const before = answer.slice(Math.max(0, index - 20), index);
  const rankMatch = before.match(/第\s*([一二三四五六七八九十\d]+)|(\d+)\s*[\.、]/);
  if (!rankMatch) return null;
  const chineseMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const rankStr = rankMatch[1] || rankMatch[2];
  return chineseMap[rankStr] ?? parseInt(rankStr, 10) ?? null;
}

export function analyzeCompetitorMentions(answer: string, competitorNames: string[]): AiTestCompetitorMention[] {
  const uniqueNames = uniqueStrings(competitorNames.map(n => n.trim()).filter(Boolean)).slice(0, 12);
  return uniqueNames.map(name => {
    const idx = answer.indexOf(name);
    if (idx === -1) {
      return { name, mentioned: false, rank: null, context: undefined };
    }
    return {
      name,
      mentioned: true,
      rank: detectRankBefore(answer, idx),
      context: excerptContext(answer, idx),
    };
  });
}

export function buildEvidenceSummary(input: {
  engineName: string;
  mentionsBrand: boolean;
  recommendsBrand: boolean;
  sentiment: AiTestSentiment;
  competitorMentions: AiTestCompetitorMention[];
  citedUrls: string[];
}): string {
  const parts: string[] = [`${input.engineName} 实测：`];
  parts.push(input.mentionsBrand ? "回答中提及本品牌" : "回答中未提及本品牌");
  parts.push(input.recommendsBrand ? "，并出现推荐倾向" : "");
  parts.push(`；情感倾向为${input.sentiment === "positive" ? "正向" : input.sentiment === "negative" ? "负向" : "中性"}`);
  const compCount = input.competitorMentions.filter(c => c.mentioned).length;
  if (input.competitorMentions.length > 0) {
    parts.push(`；竞品提及 ${compCount} 个`);
  }
  if (input.citedUrls.length > 0) {
    parts.push(`；引用来源 ${input.citedUrls.length} 条`);
  }
  return parts.join("");
}

export function enrichAiTestResult(
  base: AiTestResult,
  competitorNames: string[],
  brandNames: string[],
  testStage: AiTestStage = "manual_check",
): AiTestEvidenceItem {
  const answer = base.answer;
  const namesForBrand = brandNames.filter(Boolean);
  let parseStatus: AiTestParseStatus = "success";
  let parseError: string | null = null;
  let competitorMentions: AiTestCompetitorMention[] = [];
  let sentiment: AiTestSentiment = "neutral";
  let citedUrls: string[] = [];

  try {
    citedUrls = extractCitedUrls(answer);
    sentiment = analyzeSentiment(answer, namesForBrand, base.mentionsBrand, base.recommendsBrand);
    competitorMentions = analyzeCompetitorMentions(answer, competitorNames);
  } catch (e) {
    parseStatus = "partial";
    parseError = e instanceof Error ? e.message : "结构化解析异常";
    sentiment = base.mentionsBrand ? "neutral" : "neutral";
    competitorMentions = competitorNames.map(name => ({ name, mentioned: false, rank: null }));
  }

  const evidenceSummary = buildEvidenceSummary({
    engineName: base.engineName,
    mentionsBrand: base.mentionsBrand,
    recommendsBrand: base.recommendsBrand,
    sentiment,
    competitorMentions,
    citedUrls,
  });

  return {
    engine: base.engine,
    engineName: base.engineName,
    question: base.question,
    testedAt: base.testedAt,
    answer,
    mentionsBrand: base.mentionsBrand,
    recommendsBrand: base.recommendsBrand,
    recommendationRank: base.recommendationRank,
    rawAnswer: answer,
    mentionedBrand: base.mentionsBrand,
    recommendedBrand: base.recommendsBrand,
    brandRank: base.recommendationRank,
    citedUrls,
    sentiment,
    competitorMentions,
    evidenceSummary,
    parseStatus,
    parseError,
    testStage,
  };
}

export function enrichAnswerAnalysis(
  answer: string,
  enterpriseName: string,
  shortName: string | undefined,
  competitorNames: string[],
  engine: AiEngine,
  engineName: string,
  question: string,
): AiTestEvidenceItem {
  const analysis = analyzeAnswer(answer, enterpriseName, shortName);
  const base: AiTestResult = {
    engine,
    engineName,
    question,
    answer,
    ...analysis,
    testedAt: new Date().toISOString(),
  };
  const brandNames = [enterpriseName, shortName].filter(Boolean) as string[];
  const enriched = enrichAiTestResult(base, competitorNames, brandNames, "manual_check");
  const sentiment = analyzeSentiment(answer, brandNames, analysis.mentionsBrand, analysis.recommendsBrand);
  return {
    ...enriched,
    sentiment,
    evidenceSummary: buildEvidenceSummary({
      engineName,
      mentionsBrand: analysis.mentionsBrand,
      recommendsBrand: analysis.recommendsBrand,
      sentiment,
      competitorMentions: enriched.competitorMentions,
      citedUrls: enriched.citedUrls,
    }),
  };
}

export async function resolveProjectCompetitorNames(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  projectId: number,
): Promise<string[]> {
  const [projectRows, profileRows, competitorRows] = await Promise.all([
    db.select({ competitorNames: projects.competitorNames }).from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select({ competitors: enterpriseGeoProfiles.competitors }).from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).limit(1),
    db.select({ competitorName: competitorProfiles.competitorName }).from(competitorProfiles).where(eq(competitorProfiles.projectId, projectId)),
  ]);

  const fromProject = projectRows[0]?.competitorNames ?? [];
  const fromProfile =
    profileRows[0]?.competitors?.filter((x): x is string => typeof x === "string" && x.trim().length > 0) ?? [];
  const fromAssets = competitorRows.map(r => r.competitorName).filter((s): s is string => Boolean(s?.trim()));

  return uniqueStrings([...fromProject, ...fromProfile, ...fromAssets].map(s => s.trim()).filter(Boolean));
}

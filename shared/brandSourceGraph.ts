import type { SearchPoolQuestionRow } from "./questionSearchPool";
import { resolveSourceTypeLabel } from "./questionSearchPool";

export const BRAND_SOURCE_PLATFORMS = [
  { value: "official_site", label: "官网" },
  { value: "zhihu", label: "知乎" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "sohu", label: "搜狐" },
  { value: "baijiahao", label: "百家号" },
  { value: "toutiao", label: "头条" },
  { value: "wechat", label: "微信公众号" },
  { value: "media", label: "媒体" },
  { value: "case_page", label: "案例页" },
  { value: "third_party", label: "第三方" },
  { value: "other", label: "其他" },
] as const;

export type BrandSourcePlatform = (typeof BRAND_SOURCE_PLATFORMS)[number]["value"];

export const BRAND_SOURCE_PLATFORM_GROUPS = [
  { key: "official", label: "官网", platforms: ["official_site"] as const },
  { key: "knowledge", label: "知识平台", platforms: ["zhihu", "xiaohongshu"] as const },
  {
    key: "content",
    label: "内容平台",
    platforms: ["sohu", "baijiahao", "toutiao", "wechat"] as const,
  },
  { key: "media", label: "媒体", platforms: ["media", "case_page"] as const },
  { key: "other", label: "其他", platforms: ["third_party", "other"] as const },
] as const;

export const BRAND_SOURCE_INDICATORS = [
  { key: "isPubliclyAccessible", label: "AI 可抓取" },
  { key: "containsBrandName", label: "含品牌名" },
  { key: "containsOfficialSite", label: "含官网/公司名" },
  { key: "containsCoreKeywords", label: "含核心关键词" },
  { key: "aiCitationConfirmed", label: "AI 已引用" },
  { key: "isCrossSourceConsistent", label: "跨信源一致" },
] as const;

export type BrandSourceIndicatorKey = (typeof BRAND_SOURCE_INDICATORS)[number]["key"];

export type BrandSourceRecordRow = {
  id: number;
  projectId: number;
  platform: string;
  platformName?: string | null;
  url?: string | null;
  isPubliclyAccessible: boolean;
  containsBrandName: boolean;
  containsOfficialSite: boolean;
  containsCoreKeywords: boolean;
  aiCitationConfirmed: boolean;
  isCrossSourceConsistent: boolean;
  notes?: string | null;
  lastVerifiedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type EntityAnchorRow = {
  id?: number;
  projectId: number;
  brandName?: string | null;
  companyName?: string | null;
  coreBusiness?: string | null;
  targetCustomer?: string | null;
  coreKeywords: string[];
  officialSite?: string | null;
  founderName?: string | null;
  typicalCases?: string | null;
};

const PLATFORM_LABEL = Object.fromEntries(BRAND_SOURCE_PLATFORMS.map(p => [p.value, p.label])) as Record<
  string,
  string
>;

const CONSISTENCY_WEIGHTS: Record<BrandSourceIndicatorKey, number> = {
  isPubliclyAccessible: 20,
  containsBrandName: 20,
  containsOfficialSite: 15,
  containsCoreKeywords: 20,
  aiCitationConfirmed: 15,
  isCrossSourceConsistent: 10,
};

const LOW_PASS_RATE_THRESHOLD = 50;

export function resolveBrandSourcePlatformLabel(platform: string, platformName?: string | null): string {
  if (platform === "other" && platformName?.trim()) return platformName.trim();
  return PLATFORM_LABEL[platform] ?? platformName?.trim() ?? platform;
}

export function parseCoreKeywordsInput(raw: string): string[] {
  return raw
    .split(/[,，、\n]/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function formatCoreKeywordsInput(keywords?: string[] | null): string {
  return (keywords ?? []).join("、");
}

export function isBrandSourceIncomplete(record: BrandSourceRecordRow): boolean {
  return !record.isPubliclyAccessible || !record.containsBrandName;
}

export function buildBrandSourceOverviewMetrics(records: BrandSourceRecordRow[]) {
  const total = records.length;
  const aiCited = records.filter(r => r.aiCitationConfirmed).length;
  const incomplete = records.filter(isBrandSourceIncomplete).length;
  const score = computeConsistencyScore(records).totalScore;
  const latestVerified = records
    .map(r => (r.lastVerifiedAt ? new Date(r.lastVerifiedAt).getTime() : 0))
    .reduce((max, ts) => Math.max(max, ts), 0);
  return {
    total,
    consistencyScore: score,
    aiCitedCount: aiCited,
    aiCitedRatio: total > 0 ? `${aiCited}/${total}` : "0/0",
    incompleteCount: incomplete,
    latestVerifiedAt: latestVerified > 0 ? new Date(latestVerified) : null,
  };
}

export function groupBrandSourcesByPlatformType(records: BrandSourceRecordRow[]) {
  return BRAND_SOURCE_PLATFORM_GROUPS.map(group => ({
    ...group,
    records: records.filter(r => (group.platforms as readonly string[]).includes(r.platform)),
  }));
}

function metricPassRate(records: BrandSourceRecordRow[], key: BrandSourceIndicatorKey): number {
  if (records.length === 0) return 0;
  const passed = records.filter(r => Boolean(r[key])).length;
  return Math.round((passed / records.length) * 100);
}

export function computeConsistencyScore(records: BrandSourceRecordRow[]) {
  const metricScores = BRAND_SOURCE_INDICATORS.map(indicator => ({
    key: indicator.key,
    label: indicator.label,
    passRate: metricPassRate(records, indicator.key),
    weight: CONSISTENCY_WEIGHTS[indicator.key],
  }));

  const totalScore =
    records.length === 0
      ? 0
      : Math.round(
          metricScores.reduce((sum, item) => sum + (item.passRate * item.weight) / 100, 0),
        );

  const mainIssues = metricScores
    .filter(item => item.passRate < LOW_PASS_RATE_THRESHOLD)
    .map(item => `${item.label}通过率偏低（${item.passRate}%）`);

  if (records.length === 0) {
    mainIssues.push("尚未录入任何信源");
  }

  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    metricScores,
    mainIssues,
  };
}

export type EnhancementSuggestion = {
  id: string;
  kind: "brand_name" | "core_keywords" | "ai_citation" | "accessibility" | "official_site" | "consistency";
  icon: "alert" | "keyword" | "citation" | "link";
  description: string;
  affectedSources: string[];
  relatedQuestions: string[];
  platform?: string;
};

function sourceDisplayName(record: BrandSourceRecordRow): string {
  return resolveBrandSourcePlatformLabel(record.platform, record.platformName);
}

export function buildEnhancementSuggestions(
  records: BrandSourceRecordRow[],
  questions: SearchPoolQuestionRow[],
  anchors?: EntityAnchorRow | null,
): EnhancementSuggestion[] {
  if (records.length === 0) return [];

  const suggestions: EnhancementSuggestion[] = [];
  const brandName = anchors?.brandName?.trim() || "品牌名";
  const keywordsText = formatCoreKeywordsInput(anchors?.coreKeywords) || "核心关键词";

  const missingBrand = records.filter(r => !r.containsBrandName);
  if (missingBrand.length > 0) {
    suggestions.push({
      id: "missing-brand-name",
      kind: "brand_name",
      icon: "alert",
      description: `建议在以下信源补充品牌名：${brandName}`,
      affectedSources: missingBrand.map(sourceDisplayName),
      relatedQuestions: [],
    });
  }

  const missingKeywords = records.filter(r => !r.containsCoreKeywords);
  if (missingKeywords.length > 0) {
    suggestions.push({
      id: "missing-core-keywords",
      kind: "core_keywords",
      icon: "keyword",
      description: `建议在以下信源加入核心关键词：${keywordsText}`,
      affectedSources: missingKeywords.map(sourceDisplayName),
      relatedQuestions: [],
    });
  }

  const missingCitation = records.filter(r => !r.aiCitationConfirmed);
  if (missingCitation.length > 0) {
    suggestions.push({
      id: "missing-ai-citation",
      kind: "ai_citation",
      icon: "citation",
      description: "以下信源尚未被 AI 引用，建议优先强化",
      affectedSources: missingCitation.map(sourceDisplayName),
      relatedQuestions: [],
    });
  }

  const platformsNeedingQuestions = new Set(records.map(r => r.platform));
  for (const platform of platformsNeedingQuestions) {
    const platformRecords = records.filter(r => r.platform === platform);
    const related = questions
      .filter(q => (q.requiredSourceTypes ?? []).includes(platform))
      .map(q => q.questionText);
    if (related.length === 0) continue;

    const weakRecords = platformRecords.filter(
      r => !r.isPubliclyAccessible || !r.containsBrandName || !r.aiCitationConfirmed,
    );
    if (weakRecords.length === 0) continue;

    suggestions.push({
      id: `questions-for-${platform}`,
      kind: "accessibility",
      icon: "link",
      description: `以下问题需要${resolveSourceTypeLabel(platform)}信源支撑`,
      affectedSources: weakRecords.map(sourceDisplayName),
      relatedQuestions: related.slice(0, 5),
      platform,
    });
  }

  return suggestions;
}

export function pickSidebarMainGaps(mainIssues: string[], limit = 2): string[] {
  return mainIssues.slice(0, limit);
}

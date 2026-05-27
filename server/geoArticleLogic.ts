import { invokeLLM } from "./_core/llm";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import {
  buildPlatformContentStrategyMeta,
  formatPlatformRulesForPrompt,
  getPlatformRule,
  getPlatformSpecificOutline,
  isPublishPlatformId,
  type PlatformContentStrategyInput,
} from "@shared/platformContentRules";
import { dedupeTargetQuestionRows } from "@shared/targetQuestionDedup";
import { getSystemComplianceRulesForPrePublish, getSystemComplianceUsageLines, SYSTEM_PUBLISH_STRATEGY_LINES } from "./systemConfig";

export { GEO_ARTICLE_MIN_PASS_SCORE };

export const articleTypes = ["官网版 GEO 文章", "问答型 GEO 文章", "竞品对比型 GEO 文章", "行业选型型 GEO 文章"] as const;
export const articleStatuses = ["待生成", "已生成", "待质检", "质检通过", "待审核", "审核通过", "已发布", "待复测", "质检未通过", "需人工审核", "审核未通过"] as const;
export const p11ForbiddenPatterns = [
  { label: "存在 example.com 或演示域名", pattern: /example\.com|示例链接/i },
  { label: "存在占位链接或假链接表述", pattern: /假链接|虚假链接|占位链接/i },
  { label: "存在虚假案例或编造案例", pattern: /虚假案例|编造案例|杜撰案例|伪造案例/i },
  { label: "存在攻击竞品表述", pattern: /恶意攻击竞品|贬低竞品|竞品(都是|全是|完全是|一定是)(错误|垃圾|骗子|无效)/i },
  { label: "存在绝对排名或效果承诺", pattern: /保证排名|一定排名|保证推荐|一定推荐|保证流量|保证成交|绝对排名承诺|百分百|100%/i },
] as const;

export type ArticleType = (typeof articleTypes)[number];
export type ArticleStatus = (typeof articleStatuses)[number];
export type ThirdPartyMaterialKey =
  | "GEO 内容页版"
  | "官网版"
  | "公众号长文版"
  | "知乎回答版"
  | "小红书笔记版"
  | "百家号/头条号版"
  | "搜狐号版"
  | "头条号版"
  | "百家号版"
  | "网易号版";

export type P12GenerationBasisAuditItem = {
  key: "diagnosticBasis" | "enterpriseProfile" | "productService" | "customerCase" | "competitorProfile" | "complianceRule" | "contentStyle" | "publishStrategy";
  label: string;
  status: "已接入" | "待补充";
  evidence: string;
  requiredForPublish: boolean;
  publishBlocking: boolean;
};

export type P11GenerationBasis = {
  customerQuestionId: number;
  customerQuestion: string;
  contentGap: string;
  optimizationTaskId: number;
  optimizationTask: string;
  notRecommendedReason: string;
  competitorGap: string;
  competitorNames: string[];
  sourceAnalysisIds: number[];
  sourceQuestionIds: number[];
  manualReviewConclusion: string;
  assetLibraryUsage?: P12AssetLibraryUsage;
  generationBasisAuditItems?: P12GenerationBasisAuditItem[];
  /** Phase F：平台化内容策略（写入 generation_basis JSON，不改表结构） */
  platformContentStrategy?: Record<string, unknown>;
};

export type P11CitableSnippet = {
  question: string;
  answer: string;
};

export type P12AssetCitation = {
  id: number;
  title: string;
  category: string;
  sourceType: string;
  trustLevel?: string | null;
  isPublic: boolean;
  canUseForGeneration: boolean;
  summary: string;
};

export type P12CustomerCaseCitation = {
  id: number;
  customerName: string;
  caseType: string;
  allowPublic: boolean;
  hasResultData: boolean;
  publicVersion: string;
};

export type P12CompetitorCitation = {
  id: number;
  competitorName: string;
  website?: string | null;
  differentiation?: string | null;
  canReference: boolean;
  sourceNotes?: string | null;
};

export type P12AssetLibraryUsage = {
  enterpriseMaterials: P12AssetCitation[];
  competitorMaterials: P12CompetitorCitation[];
  customerCaseUsage: {
    used: boolean;
    status: string;
    references: P12CustomerCaseCitation[];
  };
  complianceRules: string[];
  contentStyles: string[];
  publishStrategy: string[];
  missingEvidenceNotes: string[];
};

/** 企业档案新字段与旧列合并后的展示/生成口径（新字段非空优先，否则回退旧列） */
export type ResolvedEnterpriseProfileStrings = {
  brandName: string;
  productDesc: string;
  targetCustomer: string;
  customerPains: string[];
  oneLiner: string;
  keyPoints: string[];
  keywords: string[];
};

export type P12AssetLibraryContext = {
  profile?: Record<string, unknown> | null;
  /** 由 `withResolvedEnterpriseProfile` 注入；缺省时各消费方会现场计算 */
  resolvedEnterpriseProfile?: ResolvedEnterpriseProfileStrings;
  assetSources?: Array<Record<string, unknown>>;
  customerCases?: Array<Record<string, unknown>>;
  competitorProfiles?: Array<Record<string, unknown>>;
  complianceRules?: Array<Record<string, unknown>>;
  contentStyleProfiles?: Array<Record<string, unknown>>;
  publishStrategies?: Array<Record<string, unknown>>;
};

function parseProfileStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
  if (typeof value === "string" && value.trim()) {
    try {
      const j = JSON.parse(value) as unknown;
      if (Array.isArray(j)) return j.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
    } catch {
      /* ignore */
    }
  }
  return [];
}

function splitProfileLines(value: string): string[] {
  return value.split(/[\n；;]+/).map(s => s.trim()).filter(Boolean);
}

/** 新企业档案字段优先，旧 `enterprise_geo_profiles` 列作 fallback（旧列非空才参与） */
export function resolveEnterpriseProfileForContent(profile: Record<string, unknown> | null | undefined): ResolvedEnterpriseProfileStrings {
  const p = profile ?? {};
  const pickStr = (primary: unknown, ...fallbacks: unknown[]) => {
    const a = valueText(primary);
    if (a) return a;
    for (const f of fallbacks) {
      const b = valueText(f);
      if (b) return b;
    }
    return "";
  };
  const brandName = pickStr(p.brandName, p.enterpriseName);
  const productDesc = pickStr(p.productDesc, p.productServiceIntro, p.productIntro);
  const targetCustomer = pickStr(p.targetCustomer, p.targetCustomers);
  let customerPains = parseProfileStringArray(p.customerPains);
  if (customerPains.length === 0) customerPains = splitProfileLines(valueText(p.commonObjections)).slice(0, 12);
  let oneLiner = pickStr(p.oneLiner);
  if (!oneLiner) {
    const csp = valueText(p.coreSellingPoints);
    oneLiner = splitProfileLines(csp)[0] ?? "";
  }
  let keyPoints = parseProfileStringArray(p.keyPoints);
  if (keyPoints.length === 0) {
    const csp = valueText(p.coreSellingPoints);
    keyPoints = splitProfileLines(csp).slice(0, 12);
  }
  let keywords = parseProfileStringArray(p.keywords);
  if (keywords.length === 0) {
    const feat = valueText(p.featureNotes);
    keywords = splitProfileLines(feat).flatMap(line => line.split(/[,，、]/)).map(s => s.trim()).filter(s => s.length >= 2).slice(0, 16);
    if (keywords.length === 0) {
      const csp = valueText(p.coreSellingPoints);
      keywords = csp.split(/[,，、]/).map(s => s.trim()).filter(s => s.length >= 2).slice(0, 12);
    }
  }
  return { brandName, productDesc, targetCustomer, customerPains, oneLiner, keyPoints, keywords };
}

export function withResolvedEnterpriseProfile(ctx: P12AssetLibraryContext): P12AssetLibraryContext {
  return { ...ctx, resolvedEnterpriseProfile: resolveEnterpriseProfileForContent(ctx.profile ?? null) };
}

/** 生成前将企业档案 V2 字段合并进 projects 行，避免仅更新 enterprise_geo_profiles 时 projects 仍为空 */
export function mergeProjectWithEnterpriseProfile(
  project: P11ProjectLike,
  profile: Record<string, unknown> | null | undefined,
): P11ProjectLike {
  const resolved = resolveEnterpriseProfileForContent(profile);
  const pick = (...parts: Array<string | undefined | null>) => {
    for (const part of parts) {
      const t = valueText(part);
      if (t && t !== "待补充") return t;
    }
    return "";
  };
  const industry =
    pick(project.industry, valueText(profile?.industryTag), valueText(profile?.industry)) || project.industry;
  const productIntro = pick(project.productIntro, resolved.productDesc, resolved.oneLiner) || project.productIntro;
  const targetCustomers = pick(project.targetCustomers, resolved.targetCustomer) || project.targetCustomers;
  const enterpriseName = pick(project.enterpriseName, resolved.brandName) || project.enterpriseName;
  const coreSellingPoints =
    pick(project.coreSellingPoints, resolved.keyPoints.join("；"), resolved.oneLiner) || project.coreSellingPoints;
  const coreKeywords =
    project.coreKeywords.length > 0 ? project.coreKeywords : resolved.keywords.length > 0 ? resolved.keywords : project.coreKeywords;
  return {
    ...project,
    enterpriseName,
    industry,
    productIntro,
    targetCustomers,
    coreSellingPoints,
    coreKeywords,
  };
}

export type P12PrePublishCheck = {
  enterprisePositioningConsistent: boolean;
  productDescriptionConsistent: boolean;
  competitorDifferenceConsistent: boolean;
  usesNonPublicAsset: boolean;
  forbiddenTerms: string[];
  forbiddenClaims: string[];
  unconfirmedFacts: string[];
  /** 仅合规类（禁用词、禁止承诺等）；用于硬阻断。 */
  blocked: boolean;
  blockReasons: string[];
  /** 非合规类发布前提示，不触发阻断。 */
  advisoryReasons: string[];
  summary: string;
};

export type P12FactTraceabilityItem = {
  factPoint: string;
  articleStatement: string;
  sourceType: string;
  sourceName: string;
  sourceId: string;
  isPublic: boolean;
  credibility: "高" | "中" | "低";
  manuallyConfirmed: boolean;
  riskNote: string;
};

export type P12ConsistencyConflictItem = {
  field: string;
  articleStatement: string;
  expectedStatement: string;
  riskLevel: "低" | "中" | "高";
  suggestion: string;
};

export type P12ConsistencyCheckResult = {
  score: number;
  passed: boolean;
  publishAllowed: boolean;
  riskLevel: "低" | "中" | "高";
  conflictItems: P12ConsistencyConflictItem[];
  blockReasons: string[];
  suggestions: string[];
  checkedAt: string;
  summary: string;
};

export type P12OptimizationVersion = {
  version: number;
  createdAt: string;
  mode: string;
  previousStatus: string;
  previousScore?: number;
  title: string;
  markdownContent: string;
  consistencyScore?: number;
  reason: string;
};

export type P11GeoStructure = {
  summary: string;
  coreAnswer: string;
  suitableCustomers: string;
  unsuitableCustomers: string;
  comparison: string;
  faq: Array<{ question: string; answer: string }>;
  conclusion: string;
  actionGuide: string;
  updatedAt: string;
  entityInfo: string;
};

export type P11ProjectLike = {
  id: number;
  enterpriseName: string;
  industry: string;
  website: string;
  region: string;
  productIntro: string;
  targetCustomers: string;
  coreSellingPoints: string;
  competitorNames: string[];
  coreKeywords: string[];
};

export type P11QuestionLike = {
  id: number;
  questionText: string;
  source?: string;
  questionType?: string;
  businessValue?: number;
};

export type P11AnalysisLike = {
  id: number;
  aiResponseId?: number | null;
  questionText?: string | null;
  mentionsEnterprise: number;
  recommendsEnterprise: number;
  mentionsCompetitors: number;
  recommendedCompetitors: string[];
  enterpriseWins: number;
  recommendationReason?: string | null;
  notRecommendedReason?: string | null;
  contentGap?: string | null;
  optimizationSuggestion?: string | null;
  manuallyReviewed?: number | boolean | null;
  reviewNote?: string | null;
};

export type P11TaskLike = {
  id: number;
  taskType: string;
  taskName: string;
  priority: "P0" | "P1" | "P2";
  generationReason: string;
  executionSuggestion: string;
  expectedImpact: string;
  status?: string;
};

const GEO_OPT_TASK_CARD_MARK = "__GEO_TASK_CARD__";

/** 从优化任务 executionSuggestion 中解析 V12 任务卡片 JSON（与 geoLogic / 前端 parseGeoTaskCard 对齐）。 */
export function parseOptimizationTaskCard(executionSuggestion?: string | null): {
  articleTitle: string;
  keyPoints: string[];
  targetKeywords: string[];
  recommendedPlatform: string[];
  contentType: string;
} | null {
  if (!executionSuggestion?.includes(GEO_OPT_TASK_CARD_MARK)) return null;
  const parts = executionSuggestion.split(`${GEO_OPT_TASK_CARD_MARK}\n`);
  const jsonPart = parts[1]?.trim();
  if (!jsonPart) return null;
  try {
    const j = JSON.parse(jsonPart) as Record<string, unknown>;
    const articleTitle = typeof j.articleTitle === "string" ? j.articleTitle.trim() : "";
    const keyPoints = Array.isArray(j.keyPoints) ? j.keyPoints.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()) : [];
    const targetKeywords = Array.isArray(j.targetKeywords) ? j.targetKeywords.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()) : [];
    const recommendedPlatform = Array.isArray(j.recommendedPlatform)
      ? j.recommendedPlatform.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim())
      : [];
    const contentType = typeof j.contentType === "string" ? j.contentType.trim() : "";
    return { articleTitle, keyPoints, targetKeywords, recommendedPlatform, contentType };
  } catch {
    return null;
  }
}

function contentTypeLabelToArticleType(contentType: string): ArticleType {
  const key = contentType.trim();
  const map: Record<string, ArticleType> = {
    竞品对比: "竞品对比型 GEO 文章",
    案例文章: "官网版 GEO 文章",
    场景指南: "行业选型型 GEO 文章",
    FAQ: "问答型 GEO 文章",
    产品页: "官网版 GEO 文章",
  };
  return map[key] ?? "官网版 GEO 文章";
}

export type P11TopicDraft = {
  projectId: number;
  optimizationTaskId: number;
  sourceAnalysisIds: number[];
  sourceQuestionIds: number[];
  title: string;
  articleType: ArticleType;
  contentGap: string;
  businessReason: string;
  status: ArticleStatus;
};

export type P11ArticleDraft = {
  projectId: number;
  topicId: number;
  optimizationTaskId: number;
  title: string;
  articleType: ArticleType;
  markdownContent: string;
  generationBasis: P11GenerationBasis;
  citableSnippets: P11CitableSnippet[];
  geoStructure: P11GeoStructure;
  thirdPartyMaterials: Record<string, string>;
  factTraceability: P12FactTraceabilityItem[];
  consistencyCheck: P12ConsistencyCheckResult;
  optimizationVersions: P12OptimizationVersion[];
  status: "待质检";
  contentStrategyType?: string | null;
  publishIdentity?: string | null;
  recommendedAccountGroup?: string | null;
};

export type P11QualityScore = {
  problemMatchScore: number;
  evidenceScore: number;
  structureScore: number;
  originalityScore: number;
  geoCitableScore: number;
  complianceScore: number;
  totalScore: number;
  blocked: boolean;
  blockReasons: string[];
  optimizationSuggestions: string[];
  reviewSummary: string;
  assetEvidenceStrength: string;
  factSourceSummary: string;
  unconfirmedFacts: string[];
  complianceRiskSummary: string;
  prePublishCheck: P12PrePublishCheck;
  factTraceability: P12FactTraceabilityItem[];
  consistencyCheck: P12ConsistencyCheckResult;
};

const unique = <T>(items: T[]) => Array.from(new Set(items.filter(Boolean)));
const nonEmpty = (value?: string | null) => typeof value === "string" && value.trim().length > 0;
const compactTexts = (items: Array<string | null | undefined>) => items.map(item => item?.trim()).filter((item): item is string => Boolean(item));
const truncate = (value: string, max = 90) => value.length > max ? `${value.slice(0, max)}…` : value;
const countIncludes = (content: string, values: string[]) => values.filter(value => value && content.includes(value)).length;
const priorityWeight = (priority: P11TaskLike["priority"]) => priority === "P0" ? 0 : priority === "P1" ? 1 : 2;
const taskPriorityScore = (priority: P11TaskLike["priority"]) => priority === "P0" ? 3 : priority === "P1" ? 2 : 1;

const asBool = (value: unknown) => value === true || value === 1 || value === "1";
const valueText = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const jsonSummaryText = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 180);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [record.digest, record.title, record.keywords].flatMap(item => Array.isArray(item) ? item : [item]).map(valueText).filter(Boolean).join("；").slice(0, 180);
  }
  return String(value).slice(0, 180);
};
const splitGovernanceTerms = (value: unknown) => Array.isArray(value)
  ? value.map(valueText).filter(Boolean)
  : valueText(value).split(/\n|,|，|；|;/).map(item => item.trim()).filter(Boolean);

function summarizeAssetSource(asset: Record<string, unknown>, category: string): P12AssetCitation {
  return {
    id: Number(asset.id ?? 0),
    title: valueText(asset.title) || category,
    category,
    sourceType: valueText(asset.sourceType) || category,
    trustLevel: valueText(asset.trustLevel) || null,
    isPublic: asBool(asset.isPublic),
    canUseForGeneration: asBool(asset.canUseForGeneration),
    summary: jsonSummaryText(asset.structuredSummary) || valueText(asset.contentDigest).slice(0, 180),
  };
}

export function buildAssetLibraryUsage(assetLibrary?: P12AssetLibraryContext | null): P12AssetLibraryUsage {
  const sources = assetLibrary?.assetSources ?? [];
  const profile = assetLibrary?.profile ?? null;
  const resolved = assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(profile);
  const enterpriseDigest = compactTexts([
    resolved.brandName ? `企业/品牌：${resolved.brandName}` : "",
    resolved.targetCustomer ? `目标客户：${resolved.targetCustomer}` : "",
    resolved.customerPains.length > 0 ? `客户痛点：${resolved.customerPains.join("、")}` : "",
  ]).join("。").slice(0, 320);
  const productDigest = compactTexts([
    resolved.productDesc ? `产品/服务：${resolved.productDesc}` : "",
    resolved.oneLiner ? `一句话：${resolved.oneLiner}` : "",
    resolved.keyPoints.length > 0 ? `核心卖点：${resolved.keyPoints.join("；")}` : "",
    resolved.keywords.length > 0 ? `关键词：${resolved.keywords.join("、")}` : "",
  ]).join("。").slice(0, 400);

  const profileMaterial: P12AssetCitation[] = [
    ...(enterpriseDigest
      ? [{
          id: -998,
          title: "企业档案·身份与客户",
          category: "企业基础资料",
          sourceType: "企业档案",
          trustLevel: "高",
          isPublic: true,
          canUseForGeneration: true,
          summary: enterpriseDigest,
        } as P12AssetCitation]
      : []),
    ...(productDigest
      ? [{
          id: -999,
          title: "企业档案·产品与表达",
          category: "产品服务资料",
          sourceType: "企业档案",
          trustLevel: "高",
          isPublic: true,
          canUseForGeneration: true,
          summary: productDigest,
        } as P12AssetCitation]
      : []),
  ];

  const enterpriseMaterials = [...profileMaterial, ...sources
    .filter(asset => asBool(asset.canUseForGeneration) && asBool(asset.manuallyConfirmed))
    .filter(asset => ["企业基础资料", "产品服务资料", "官网内容", "销售话术", "产品手册", "通用资料", "客户案例文档"].includes(valueText(asset.sourceType)))
    .map(asset => summarizeAssetSource(asset, valueText(asset.sourceType) || "企业资料"))]
    .slice(0, 8);

  const profileCompetitors = parseProfileStringArray(profile?.competitors);
  const tagCompetitorMaterials: P12CompetitorCitation[] = profileCompetitors.map((name, i) => ({
    id: -(i + 1),
    competitorName: name,
    website: null,
    differentiation: "企业档案「主要竞品」标签",
    canReference: true,
    sourceNotes: "企业档案",
  }));

  const competitorMaterials: P12CompetitorCitation[] = [...tagCompetitorMaterials, ...(assetLibrary?.competitorProfiles ?? [])
    .filter(item => asBool(item.canReference))
    .map(item => ({
      id: Number(item.id ?? 0),
      competitorName: valueText(item.competitorName),
      website: valueText(item.website) || null,
      differentiation: valueText(item.comparisonNotes) || valueText(item.positioning) || null,
      canReference: asBool(item.canReference),
      sourceNotes: valueText(item.aiRecommendationSignals) || valueText(item.contentAssets) || "资产库竞品资料",
    }))]
    .filter(item => item.competitorName)
    .slice(0, 6);

  const realPublicCases: P12CustomerCaseCitation[] = (assetLibrary?.customerCases ?? [])
    .filter(item => valueText(item.caseType) === "真实案例" && asBool(item.allowPublic) && valueText(item.verificationStatus) === "已确认")
    .map(item => ({
      id: Number(item.id ?? 0),
      customerName: valueText(item.customerName) || "可公开客户案例",
      caseType: valueText(item.caseType),
      allowPublic: asBool(item.allowPublic),
      hasResultData: Boolean(valueText(item.resultData)),
      publicVersion: valueText(item.publicVersion),
    }))
    .slice(0, 4);

  const hasCaseResultData = realPublicCases.some(item => item.hasResultData);
  const priceText = [profile?.servicePriceRange, profile?.priceExplanation].map(valueText).filter(Boolean).join("；");
  const dbComplianceLines = (assetLibrary?.complianceRules ?? [])
    .filter(item => asBool(item.enabled ?? 1))
    .map(item => {
      const name = valueText(item.ruleName);
      const claims = valueText(item.forbiddenClaims);
      const words = splitGovernanceTerms(item.forbiddenWords).slice(0, 10).join("、");
      const body = compactTexts([claims, words && `禁用词：${words}`]).join("；");
      if (!name && !body) return "";
      return name ? `${name}${body ? `：${body}` : ""}` : body;
    })
    .filter(Boolean);
  const complianceRules = unique([...dbComplianceLines, ...getSystemComplianceUsageLines()]);
  const contentStyles = (assetLibrary?.contentStyleProfiles ?? [])
    .filter(item => asBool(item.enabled ?? 1))
    .map(item => [valueText(item.profileName) || "内容风格", valueText(item.tone), valueText(item.writingStyle)].filter(Boolean).join("："))
    .filter(Boolean)
    .slice(0, 5);
  const publishStrategy = [...SYSTEM_PUBLISH_STRATEGY_LINES];

  const missingEvidenceNotes = [
    ...(realPublicCases.length === 0 ? ["案例信息待补充"] : []),
    ...(!hasCaseResultData ? ["数据暂无公开来源"] : []),
    ...(!priceText ? ["价格口径需客户确认"] : []),
  ];

  return {
    enterpriseMaterials,
    competitorMaterials,
    customerCaseUsage: {
      used: realPublicCases.length > 0,
      status: realPublicCases.length > 0 ? "已使用允许公开的真实案例" : "案例信息待补充",
      references: realPublicCases,
    },
    complianceRules,
    contentStyles,
    publishStrategy,
    missingEvidenceNotes,
  };
}

function formatCitationList(items: Array<{ title?: string; competitorName?: string; trustLevel?: string | null; isPublic?: boolean; summary?: string; differentiation?: string | null }>, emptyText: string) {
  if (items.length === 0) return emptyText;
  return items.map(item => {
    const name = item.title ?? item.competitorName ?? "未命名资料";
    const publicText = typeof item.isPublic === "boolean" ? `；公开状态：${item.isPublic ? "可公开" : "不可公开"}` : "";
    const trustText = item.trustLevel ? `；可信度：${item.trustLevel}` : "";
    const summary = item.summary || item.differentiation || "已进入资产库";
    return `- ${name}${trustText}${publicText}；摘要：${summary}`;
  }).join("\n");
}

function containsUnsafeForbiddenTerm(content: string, term: string) {
  if (!term) return false;
  let index = content.indexOf(term);
  while (index >= 0) {
    const before = content.slice(Math.max(0, index - 40), index);
    const after = content.slice(index + term.length, index + term.length + 20);
    const guardedContext = /(不得承诺|不得|不应|不要|不能|禁止|禁用|避免|不承诺)[^。；\n]{0,32}$/.test(before) || /^(等高风险表述|等违规表述|等禁用词|作为禁用词|风险提示|内容合规规则)/.test(after);
    if (!guardedContext) return true;
    index = content.indexOf(term, index + term.length);
  }
  return false;
}

export function evaluateAssetLibraryPrePublishCheck(input: {
  content: string;
  project: P11ProjectLike;
  basis?: P11GenerationBasis | null;
  assetLibrary?: P12AssetLibraryContext | null;
}): P12PrePublishCheck {
  const usage = input.basis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const profile = input.assetLibrary?.profile ?? null;
  const resolved = input.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(profile);
  const content = input.content;
  const complianceRules = getSystemComplianceRulesForPrePublish() as Array<Record<string, unknown>>;
  const enterprisePositioning = unique([
    resolved.brandName,
    input.project.enterpriseName,
    resolved.targetCustomer,
    input.project.targetCustomers,
    valueText(profile?.targetCustomers),
  ].filter(Boolean));
  const productSignals = unique([
    resolved.productDesc,
    input.project.productIntro,
    valueText(profile?.productServiceIntro),
    valueText(profile?.productIntro),
  ].filter(Boolean));
  const competitorSignals = usage.competitorMaterials.map(item => item.competitorName).concat(input.basis?.competitorNames ?? input.project.competitorNames).filter(Boolean);
  const forbiddenTerms = complianceRules.flatMap(rule => splitGovernanceTerms(rule.forbiddenWords)).filter(term => term && containsUnsafeForbiddenTerm(content, term));
  const forbiddenClaimsFromRules = complianceRules.flatMap(rule => splitGovernanceTerms(rule.forbiddenClaims));
  const unsafeGenericClaims = ["保证收录", "保证排名", "一定收录", "一定排名", "保证推荐", "一定推荐", "百分百", "100%"].some(term => containsUnsafeForbiddenTerm(content, term));
  const forbiddenClaims = unique([
    ...forbiddenClaimsFromRules.filter(term => term && !/^(不得|禁止|不应|不要|不能|避免)/.test(term.trim()) && containsUnsafeForbiddenTerm(content, term)),
    ...(unsafeGenericClaims ? ["禁止承诺保证收录或排名"] : []),
    ...detectForbiddenArticleContent(content),
  ]);
  const undisclosedUnconfirmedFacts = [
    ...(usage.customerCaseUsage.used ? [] : (content.includes("案例信息待补充") ? [] : ["客户案例缺失但文章未标注案例信息待补充"])),
    ...(usage.missingEvidenceNotes.includes("数据暂无公开来源") && !content.includes("数据暂无公开来源") ? ["结果数据缺少公开来源但文章未标注"] : []),
    ...(usage.missingEvidenceNotes.includes("价格口径需客户确认") && !content.includes("价格口径需客户确认") ? ["价格数据缺少确认口径但文章未标注"] : []),
  ];
  const unconfirmedFacts = unique([...usage.missingEvidenceNotes, ...undisclosedUnconfirmedFacts]);
  const appearsToUseNonPublicAsset = /(引用|使用|采用|根据|来自|依据)不可公开资料/.test(content) && !/(不得|不能|避免|移除|改为|不要).{0,12}(引用|使用|采用|根据|来自|依据)?不可公开资料/.test(content);
  const usesNonPublicAsset = appearsToUseNonPublicAsset || usage.enterpriseMaterials.some(item => !item.isPublic) || usage.customerCaseUsage.references.some(item => !item.allowPublic);
  const enterprisePositioningConsistent =
    enterprisePositioning.length === 0 || enterprisePositioning.some(signal => corpusReflectsSignal(content, signal, 48));
  const productDescriptionConsistent =
    productSignals.length === 0 || productSignals.some(signal => corpusReflectsSignal(content, signal, 96));
  const competitorDifferenceConsistent = competitorSignals.length === 0 || competitorSignals.some(signal => content.includes(signal));
  const complianceBlockReasons = unique([
    ...(forbiddenTerms.length > 0 ? [`命中禁用词：${unique(forbiddenTerms).join("、")}`] : []),
    ...(forbiddenClaims.length > 0 ? [`存在不允许承诺或高风险表述：${forbiddenClaims.join("、")}`] : []),
  ]);
  const advisoryReasons = unique([
    ...(enterprisePositioningConsistent ? [] : ["内容与企业定位一致性建议：对照企业档案核对公开表述。"]),
    ...(productDescriptionConsistent ? [] : ["内容与产品说明一致性建议：对照产品服务资料核对口径。"]),
    ...(competitorDifferenceConsistent ? [] : ["竞品差异呈现建议：可补充资产库竞品资料与客观对照。"]),
    ...(usesNonPublicAsset ? ["生成依据或资产库含不可公开资料：公开版本请改为资料待补充表述。"] : []),
    ...(undisclosedUnconfirmedFacts.length > 0 ? [`未披露或未确认的表述建议：${undisclosedUnconfirmedFacts.join("、")}`] : []),
  ]);
  const blocked = complianceBlockReasons.length > 0;
  return {
    enterprisePositioningConsistent,
    productDescriptionConsistent,
    competitorDifferenceConsistent,
    usesNonPublicAsset,
    forbiddenTerms: unique(forbiddenTerms),
    forbiddenClaims,
    unconfirmedFacts,
    blocked,
    blockReasons: complianceBlockReasons,
    advisoryReasons,
    summary: blocked
      ? `合规检查未通过：${complianceBlockReasons.join("；")}`
      : advisoryReasons.length > 0
        ? `合规检查通过。发布前可参考：${advisoryReasons.join("；")}`
        : "合规检查通过：未发现禁用词或禁止承诺类问题。",
  };
}

export function buildGenerationBasisAuditItems(basis: Partial<P11GenerationBasis> | null | undefined): P12GenerationBasisAuditItem[] {
  const usage = basis?.assetLibraryUsage;
  const enterpriseBaseMaterials = usage?.enterpriseMaterials?.filter(item => !/(产品|服务|手册)/.test(`${item.category}${item.sourceType}${item.title}`)) ?? [];
  const productServiceMaterials = usage?.enterpriseMaterials?.filter(item => /(产品|服务|手册)/.test(`${item.category}${item.sourceType}${item.title}`)) ?? [];
  const diagnosticComplete = nonEmpty(basis?.customerQuestion) && nonEmpty(basis?.contentGap) && nonEmpty(basis?.optimizationTask) && nonEmpty(basis?.notRecommendedReason) && nonEmpty(basis?.competitorGap);
  return [
    { key: "diagnosticBasis", label: "客户问题与诊断缺口", status: diagnosticComplete ? "已接入" : "待补充", evidence: compactTexts([basis?.customerQuestion, basis?.contentGap, basis?.optimizationTask, basis?.notRecommendedReason, basis?.competitorGap]).join("；") || "缺少客户问题、内容缺口、优化任务、AI 未推荐原因或竞品差距。", requiredForPublish: true, publishBlocking: !diagnosticComplete },
    { key: "enterpriseProfile", label: "企业基础资料", status: enterpriseBaseMaterials.length > 0 ? "已接入" : "待补充", evidence: enterpriseBaseMaterials.map(item => item.title).join("、") || "缺少可公开且已确认的企业基础资料。", requiredForPublish: true, publishBlocking: enterpriseBaseMaterials.length === 0 },
    { key: "productService", label: "产品服务资料", status: productServiceMaterials.length > 0 ? "已接入" : "待补充", evidence: productServiceMaterials.map(item => item.title).join("、") || "缺少可公开且已确认的产品服务资料。", requiredForPublish: true, publishBlocking: productServiceMaterials.length === 0 },
    { key: "customerCase", label: "客户案例", status: usage?.customerCaseUsage?.used ? "已接入" : "待补充", evidence: usage?.customerCaseUsage?.references?.map(item => item.customerName).join("、") || "客户案例、结果数据或公开授权待补充；草稿必须标注资料待补充。", requiredForPublish: true, publishBlocking: !(usage?.customerCaseUsage?.used) },
    { key: "competitorProfile", label: "竞品资料", status: (usage?.competitorMaterials?.length ?? 0) > 0 ? "已接入" : "待补充", evidence: usage?.competitorMaterials?.map(item => item.competitorName).join("、") || "缺少可引用竞品资料。", requiredForPublish: true, publishBlocking: (usage?.competitorMaterials?.length ?? 0) === 0 },
    { key: "complianceRule", label: "合规规则", status: (usage?.complianceRules?.length ?? 0) > 0 ? "已接入" : "待补充", evidence: usage?.complianceRules?.join("；") || "缺少合规禁用词、禁用主张或披露规则。", requiredForPublish: true, publishBlocking: (usage?.complianceRules?.length ?? 0) === 0 },
    { key: "contentStyle", label: "内容风格", status: (usage?.contentStyles?.length ?? 0) > 0 ? "已接入" : "待补充", evidence: usage?.contentStyles?.join("；") || "缺少内容语气、写作风格或结构规范。", requiredForPublish: false, publishBlocking: false },
    { key: "publishStrategy", label: "发布策略", status: (usage?.publishStrategy?.length ?? 0) > 0 ? "已接入" : "待补充", evidence: usage?.publishStrategy?.join("；") || "缺少发布平台优先级、审核模式或质量阈值。", requiredForPublish: true, publishBlocking: (usage?.publishStrategy?.length ?? 0) === 0 },
  ];
}

export function validateGenerationBasis(basis: Partial<P11GenerationBasis> | null | undefined): asserts basis is P11GenerationBasis {
  const auditItems = buildGenerationBasisAuditItems(basis);
  const missingCoreFields = [
    ["客户指定问题", basis?.customerQuestion],
    ["内容缺口", basis?.contentGap],
    ["优化任务", basis?.optimizationTask],
    ["AI 未推荐原因", basis?.notRecommendedReason],
    ["竞品差距", basis?.competitorGap],
  ].filter(([, value]) => !nonEmpty(String(value ?? ""))).map(([label]) => label);
  const missingDiagnostic = missingCoreFields.length > 0 ? missingCoreFields : auditItems.filter(item => item.key === "diagnosticBasis" && item.publishBlocking).map(item => item.label);
  const missingUsage = !basis?.assetLibraryUsage ? ["企业 GEO 资产库使用情况"] : [];
  const missing = [...missingDiagnostic, ...missingUsage];
  if (missing.length > 0) throw new Error(`缺少生成依据：${missing.join("、")}，无法生成正式文章；请补齐资料后重试，或仅保留不允许发布的草稿。`);
}

function normalizeGap(value?: string | null) {
  return value?.trim().replace(/\s+/g, "") ?? "";
}

export function calculateContentGapPriorityScore(input: {
  analysis: P11AnalysisLike;
  questions: P11QuestionLike[];
  gapFrequency: number;
}) {
  const matchedQuestion = input.questions.find(question => question.questionText === input.analysis.questionText);
  const manualReviewScore = input.analysis.manuallyReviewed ? 3 : 0;
  const businessValueScore = matchedQuestion?.businessValue ?? 0;
  const frequencyScore = input.gapFrequency;
  return manualReviewScore + businessValueScore + frequencyScore;
}

export function sortContentGapAnalysesByPriority(analyses: P11AnalysisLike[], questions: P11QuestionLike[]) {
  const gapFrequency = analyses.reduce((map, analysis) => {
    const key = normalizeGap(analysis.contentGap);
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  return analyses
    .map(analysis => ({
      analysis,
      contentGapPriorityScore: calculateContentGapPriorityScore({
        analysis,
        questions,
        gapFrequency: gapFrequency.get(normalizeGap(analysis.contentGap)) ?? 0,
      }),
    }))
    .sort((a, b) => b.contentGapPriorityScore - a.contentGapPriorityScore || a.analysis.id - b.analysis.id)
    .map(item => item.analysis);
}

export function detectForbiddenArticleContent(content: string): string[] {
  const normalized = content
    .replace(/不虚构案例/g, "")
    .replace(/不得包含虚假案例/g, "")
    .replace(/不要攻击竞品/g, "")
    .replace(/不是攻击竞品/g, "")
    .replace(/不承诺任何平台的绝对排名结果/g, "")
    .replace(/不承诺绝对排名/g, "")
    .replace(/不要承诺绝对排名/g, "");
  const labels: string[] = [];
  if (/example\.com|示例链接/i.test(normalized)) labels.push("存在 example.com 或演示域名");
  if (/假链接|虚假链接|占位链接/i.test(normalized)) labels.push("存在占位链接或假链接表述");
  if (/虚假案例|编造案例|杜撰案例|伪造案例/i.test(normalized)) labels.push("存在虚假案例或编造案例");
  if (/恶意攻击竞品|贬低竞品|竞品(都是|全是|完全是|一定是)(错误|垃圾|骗子|无效)/i.test(normalized)) labels.push("存在攻击竞品表述");
  const unsafePromises = ["保证排名", "一定排名", "保证推荐", "一定推荐", "保证流量", "保证成交", "绝对排名承诺", "百分百", "100%"].some(term => containsUnsafeForbiddenTerm(normalized, term));
  if (unsafePromises) labels.push("存在绝对排名或效果承诺");
  return unique(labels);
}


function trustToCredibility(value?: string | null): "高" | "中" | "低" {
  if (value === "官方" || value === "合同" || value === "截图" || value === "客户确认") return "高";
  if (value === "高" || value === "中") return value;
  if (value === "公开资料" || value === "人工录入") return "中";
  return "低";
}

function buildFactItem(input: {
  factPoint: string;
  articleStatement: string;
  sourceType: string;
  sourceName: string;
  sourceId?: string | number | null;
  isPublic?: boolean;
  credibility?: "高" | "中" | "低";
  manuallyConfirmed?: boolean;
  riskNote?: string;
}): P12FactTraceabilityItem {
  return {
    factPoint: input.factPoint,
    articleStatement: input.articleStatement,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    sourceId: String(input.sourceId ?? "待补充"),
    isPublic: input.isPublic !== false,
    credibility: input.credibility ?? "中",
    manuallyConfirmed: input.manuallyConfirmed !== false,
    riskNote: input.riskNote ?? "暂无明显风险，发布前仍建议人工复核。",
  };
}

export function buildFactTraceability(input: {
  project: P11ProjectLike;
  basis: P11GenerationBasis;
  content: string;
  assetLibrary?: P12AssetLibraryContext | null;
}): P12FactTraceabilityItem[] {
  const usage = input.basis.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const profile = input.assetLibrary?.profile ?? null;
  const resolved = input.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(profile);
  const sourceFacts = usage.enterpriseMaterials.slice(0, 4).map(item => buildFactItem({
    factPoint: item.category.includes("产品") ? "产品服务资料" : "企业资料",
    articleStatement: item.summary || item.title,
    sourceType: item.sourceType || item.category || "资产库资料",
    sourceName: item.title,
    sourceId: item.id,
    isPublic: item.isPublic,
    credibility: trustToCredibility(item.trustLevel),
    manuallyConfirmed: item.canUseForGeneration,
    riskNote: item.isPublic ? "可作为公开内容生成依据。" : "不可公开资料只能用于内部理解，不能进入公开发布版本。",
  }));
  const caseFacts = usage.customerCaseUsage.references.length > 0
    ? usage.customerCaseUsage.references.slice(0, 2).map(item => buildFactItem({
      factPoint: "客户案例",
      articleStatement: item.publicVersion || item.customerName + "案例已允许公开引用",
      sourceType: item.caseType,
      sourceName: item.customerName,
      sourceId: item.id,
      isPublic: item.allowPublic,
      credibility: item.hasResultData ? "高" : "中",
      manuallyConfirmed: item.allowPublic,
      riskNote: item.allowPublic ? "真实案例允许公开引用。" : "该案例不可公开，不能发布。",
    }))
    : [buildFactItem({
      factPoint: "客户案例",
      articleStatement: "案例信息待补充，文章不得编造真实客户案例或结果数据。",
      sourceType: "资产库缺口",
      sourceName: "未提供真实客户案例",
      sourceId: "missing-customer-case",
      isPublic: true,
      credibility: "低",
      manuallyConfirmed: true,
      riskNote: "这是允许公开的资料待补充占位提示，没有真实案例时必须使用该表述，不能写成已验证客户成功故事。",
    })];
  const competitorFacts = usage.competitorMaterials.slice(0, 3).map(item => buildFactItem({
    factPoint: "竞品资料",
    articleStatement: item.differentiation || item.competitorName + "差异化信息待补充",
    sourceType: "资产库竞品资料",
    sourceName: item.competitorName,
    sourceId: item.id,
    isPublic: item.canReference,
    credibility: item.sourceNotes ? "中" : "低",
    manuallyConfirmed: item.canReference,
    riskNote: item.canReference ? "仅可用于客观对比，不得攻击竞品。" : "竞品资料未确认可引用，发布前需复核。",
  }));
  const governanceFacts = [
    ...usage.complianceRules.slice(0, 2).map((rule, index) => buildFactItem({
      factPoint: "合规规则",
      articleStatement: rule,
      sourceType: "资产库合规规则",
      sourceName: "合规规则 " + (index + 1),
      sourceId: "compliance-" + (index + 1),
      isPublic: true,
      credibility: "高",
      manuallyConfirmed: true,
      riskNote: "发布内容必须遵守该规则。",
    })),
    ...usage.contentStyles.slice(0, 1).map((style, index) => buildFactItem({
      factPoint: "内容风格",
      articleStatement: style,
      sourceType: "资产库内容风格",
      sourceName: "内容风格 " + (index + 1),
      sourceId: "style-" + (index + 1),
      isPublic: true,
      credibility: "中",
      manuallyConfirmed: true,
      riskNote: "用于统一表达方式，不代表事实承诺。",
    })),
    ...usage.publishStrategy.slice(0, 1).map((strategy, index) => buildFactItem({
      factPoint: "发布策略",
      articleStatement: strategy,
      sourceType: "资产库发布策略",
      sourceName: "发布策略 " + (index + 1),
      sourceId: "publish-" + (index + 1),
      isPublic: true,
      credibility: "中",
      manuallyConfirmed: true,
      riskNote: "发布前仍需按平台优先级和人工审核执行。",
    })),
  ];
  const diagnosticFacts = [
    buildFactItem({
      factPoint: "客户指定问题",
      articleStatement: input.basis.customerQuestion,
      sourceType: "GEO 诊断问题库",
      sourceName: "客户指定问题",
      sourceId: input.basis.customerQuestionId,
      isPublic: true,
      credibility: "高",
      manuallyConfirmed: true,
      riskNote: "文章必须围绕该问题展开，不能偏离客户真实搜索意图。",
    }),
    buildFactItem({
      factPoint: "内容缺口与 AI 未推荐原因",
      articleStatement: input.basis.contentGap + "；" + input.basis.notRecommendedReason,
      sourceType: "AI 诊断结果",
      sourceName: "语义分析与优化任务",
      sourceId: input.basis.sourceAnalysisIds.join(",") || input.basis.optimizationTaskId,
      isPublic: true,
      credibility: "中",
      manuallyConfirmed: Boolean(input.basis.manualReviewConclusion),
      riskNote: "该诊断结论用于内容方向，不应被写成确定的外部事实。",
    }),
    buildFactItem({
      factPoint: "产品服务口径",
      articleStatement: resolved.productDesc || valueText(profile?.productServiceIntro) || input.project.productIntro || "产品服务资料待补充",
      sourceType: "企业资料/项目资料",
      sourceName: resolved.brandName || input.project.enterpriseName,
      sourceId: input.project.id,
      isPublic: true,
      credibility: resolved.productDesc ? "高" : valueText(profile?.productServiceIntro) ? "高" : "中",
      manuallyConfirmed: true,
      riskNote: "公开文章中的产品服务说明必须与企业资产库保持一致。",
    }),
  ];
  return unique([...diagnosticFacts, ...sourceFacts, ...caseFacts, ...competitorFacts, ...governanceFacts].map(item => JSON.stringify(item))).map(item => JSON.parse(item) as P12FactTraceabilityItem);
}

export function evaluateArticleConsistencyCheck(input: {
  content: string;
  project: P11ProjectLike;
  basis?: P11GenerationBasis | null;
  assetLibrary?: P12AssetLibraryContext | null;
  factTraceability?: P12FactTraceabilityItem[] | null;
  prePublishCheck?: P12PrePublishCheck | null;
}): P12ConsistencyCheckResult {
  const basis = input.basis;
  const content = input.content;
  const usage = basis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const prePublishCheck = input.prePublishCheck ?? evaluateAssetLibraryPrePublishCheck({ content, project: input.project, basis: basis ?? undefined, assetLibrary: input.assetLibrary });
  const facts = input.factTraceability ?? (basis ? buildFactTraceability({ project: input.project, basis, content, assetLibrary: input.assetLibrary }) : []);
  const conflicts: P12ConsistencyConflictItem[] = [];
  const addConflict = (field: string, articleStatement: string, expectedStatement: string, riskLevel: "低" | "中" | "高", suggestion: string) => conflicts.push({ field, articleStatement, expectedStatement, riskLevel, suggestion });
  if (!basis) addConflict("生成依据", "文章缺少生成依据对象", "必须包含客户问题、内容缺口、优化任务、AI 未推荐原因、竞品差距和资产库使用情况", "高", "重新从真实选题生成文章，补齐生成依据卡。加做重新评分与重新一致性检查。");
  if (basis && !content.includes(basis.customerQuestion.slice(0, Math.min(16, basis.customerQuestion.length)))) addConflict("客户指定问题", "正文未稳定呈现客户指定问题", basis.customerQuestion, "中", "在引言、FAQ 和便于引用的要点中补充客户问题原文。重新评分。加做重新一致性检查。");
  if (basis && !content.includes(basis.optimizationTask.slice(0, Math.min(12, basis.optimizationTask.length)))) addConflict("优化任务", "正文未体现优化任务", basis.optimizationTask, "中", "增加优化任务说明和执行边界，生成增强版后重新评分。");
  if (prePublishCheck.usesNonPublicAsset) addConflict("不可公开资料", "文章生成依据或资产库含不可公开资料", "公开版本只能使用允许公开或资料待补充表述", "高", "移除不可公开资料，改为资料待补充表述，并重新一致性检查。");
  if (usage.customerCaseUsage.references.length === 0 && /(成功案例|客户案例|真实客户|转化提升|收入增长|效率提升\d|提升\d+%|增长\d+%)/.test(content) && !content.includes("案例信息待补充")) addConflict("客户案例", "文章出现案例或结果型表述但资产库无真实公开案例", "没有真实案例时必须标注案例信息待补充，不得编造案例或结果数据", "高", "移除无来源数据，加入案例采集模板，并使用资料待补充表述。");
  for (const note of prePublishCheck.unconfirmedFacts.filter(note => /未标注|未披露|未确认/.test(note) && !content.includes(note))) addConflict("未确认事实", note, "未确认事实必须显式披露或补充来源", "高", "补充来源、使用资料待补充表述，或移除相关事实后重新评分。");
  for (const fact of facts.filter(item => !item.isPublic)) addConflict("事实溯源公开性", fact.articleStatement, fact.sourceName + " 当前不可公开或未确认", fact.manuallyConfirmed ? "中" : "高", "公开版本不能引用不可公开事实；改成内部参考或待补充提示。重新一致性检查。");
  const generationBasisAuditItems = basis?.generationBasisAuditItems ?? buildGenerationBasisAuditItems(basis);
  const basisPublishBlocks = generationBasisAuditItems.filter(item => item.publishBlocking).map(item => "生成依据待补充：" + item.label + "｜" + item.evidence);
  const highCount = conflicts.filter(item => item.riskLevel === "高").length;
  const mediumCount = conflicts.filter(item => item.riskLevel === "中").length;
  const score = Math.max(0, 100 - highCount * 8 - mediumCount * 4);
  const riskLevel: "低" | "中" | "高" = highCount > 2 ? "高" : mediumCount > 2 ? "中" : "低";
  const suggestions = unique([
    ...conflicts.map(item => `${item.field}：${item.suggestion}`),
    ...basisPublishBlocks.map(reason => reason.replace(/^生成依据待补充：/, "补齐生成依据：")),
    ...prePublishCheck.advisoryReasons,
    "发布前仍建议人工复核事实、案例、平台格式与合规口径。",
  ]);
  return {
    score,
    passed: true,
    publishAllowed: true,
    riskLevel,
    conflictItems: conflicts,
    blockReasons: [],
    suggestions,
    checkedAt: new Date().toISOString(),
    summary: `一致性参考（不阻断发布）：统一口径约 ${score} 分；${suggestions.slice(0, 4).join("；")}`,
  };
}

export function canQualityCheckArticle(status: ArticleStatus) {
  return status === "待质检" || status === "已生成" || status === "需人工审核";
}

export function canAuditArticle(status: ArticleStatus, quality?: Pick<P11QualityScore, "totalScore" | "blocked"> | null) {
  return (status === "质检通过" || status === "待审核") && Boolean(quality) && !quality?.blocked && (quality?.totalScore ?? 0) >= GEO_ARTICLE_MIN_PASS_SCORE;
}

export function canPublishArticle(status: ArticleStatus) {
  return status === "审核通过";
}

function buildTopicDraftFromTask(projectId: number, task: P11TaskLike, variantRound: number): P11TopicDraft {
  const card = parseOptimizationTaskCard(task.executionSuggestion);
  const titleRaw = (card?.articleTitle || task.taskName || "内容选题").trim();
  const suffix = variantRound > 0 ? ` · 延伸篇${variantRound + 1}` : "";
  const titleBase = titleRaw.length + suffix.length > 255 ? titleRaw.slice(0, Math.max(1, 255 - suffix.length)) : titleRaw;
  const title = `${titleBase}${suffix}`.trim() || "内容选题";
  const problemSolved = (task.generationReason || "").trim() || "（待补充任务缺口说明）";
  const contentType = (card?.contentType || "").trim() || "场景指南";
  const articleType = contentTypeLabelToArticleType(contentType);
  const platforms = card?.recommendedPlatform?.length ? card.recommendedPlatform.join("、") : "待选";
  const kw = card?.targetKeywords?.length ? card.targetKeywords.join("、") : "";
  const kp = card?.keyPoints?.length ? card.keyPoints.join("；") : "";
  const variantNote = variantRound > 0 ? `；本篇为同优化任务延伸内容（第 ${variantRound + 1} 篇）` : "";
  const businessReason = `优化任务：${task.taskName}；内容类型：${contentType}；推荐平台：${platforms}${kw ? `；目标关键词：${kw}` : ""}${kp ? `；核心论点：${kp}` : ""}${variantNote}`;

  return {
    projectId,
    optimizationTaskId: task.id,
    sourceAnalysisIds: [] as number[],
    sourceQuestionIds: [] as number[],
    title,
    articleType,
    contentGap: problemSolved,
    businessReason,
    status: "待生成" as const,
  };
}

/**
 * 按目标篇数生成内容选题：优先每个优化任务 1 条；不足时按任务轮询生成延伸篇选题。
 */
export function generateGeoArticleTopics(input: {
  project: P11ProjectLike;
  tasks: P11TaskLike[];
  targetCount?: number;
}): P11TopicDraft[] {
  if (input.tasks.length === 0) throw new Error("缺少优化任务，不能生成内容选题。");
  const uniqueTasks: P11TaskLike[] = [];
  const seenIds = new Set<number>();
  for (const task of input.tasks) {
    if (seenIds.has(task.id)) continue;
    seenIds.add(task.id);
    uniqueTasks.push(task);
  }

  const target =
    input.targetCount != null
      ? Math.max(1, Math.min(50, input.targetCount))
      : uniqueTasks.length;

  const result: P11TopicDraft[] = [];
  const usedTitles = new Set<string>();
  let round = 0;
  while (result.length < target && uniqueTasks.length > 0 && round < 60) {
    for (const task of uniqueTasks) {
      if (result.length >= target) break;
      const draft = buildTopicDraftFromTask(input.project.id, task, round);
      const key = draft.title.trim().toLowerCase();
      if (!key || usedTitles.has(key)) continue;
      usedTitles.add(key);
      result.push(draft);
    }
    round += 1;
  }

  if (result.length === 0) throw new Error("缺少优化任务，不能生成内容选题。");
  return result.slice(0, target);
}

function paragraph(title: string, body: string) {
  return `## ${title}\n\n${body.trim()}\n`;
}

function buildEvidenceList(input: { questions: P11QuestionLike[]; analyses: P11AnalysisLike[]; task: P11TaskLike; project: P11ProjectLike }) {
  const questionsText = input.questions.slice(0, 5).map((question, index) => `${index + 1}. ${question.questionText}`).join("\n");
  const gaps = compactTexts(input.analyses.map(analysis => analysis.contentGap)).slice(0, 4).map((gap, index) => `${index + 1}. ${gap}`).join("\n");
  const reasons = compactTexts(input.analyses.map(analysis => analysis.notRecommendedReason)).slice(0, 4).map((reason, index) => `${index + 1}. ${reason}`).join("\n");
  const competitors = unique(input.analyses.flatMap(analysis => analysis.recommendedCompetitors ?? []).concat(input.project.competitorNames)).slice(0, 5);
  return { questionsText, gaps, reasons, competitors };
}

export function buildGenerationBasis(input: { project: P11ProjectLike; topic: P11TopicDraft & { id?: number }; task: P11TaskLike; questions: P11QuestionLike[]; analyses: P11AnalysisLike[]; assetLibrary?: P12AssetLibraryContext | null }): P11GenerationBasis {
  const specifiedQuestion = input.questions.find(question => question.source === "manual" || question.questionType === "指定问题") ?? input.questions[0];
  const gapAnalysis = input.analyses.find(analysis => nonEmpty(analysis.contentGap) && nonEmpty(analysis.notRecommendedReason));
  const competitorNames = unique((gapAnalysis?.recommendedCompetitors ?? []).concat(input.project.competitorNames));
  const contentGap = compactTexts([gapAnalysis?.contentGap, input.topic.contentGap]).join("；");
  const notRecommendedReason = compactTexts([gapAnalysis?.notRecommendedReason, input.task.generationReason]).join("；");
  const competitorGap = competitorNames.length > 0
    ? `${competitorNames.slice(0, 3).join("、")}在 AI 回答中更容易被识别，主要差距来自公开内容中的定位、适用场景、证据和对比信息更完整。`
    : "";
  const manualReviewConclusion = input.analyses.filter(analysis => analysis.manuallyReviewed).slice(0, 2).map(analysis => compactTexts([analysis.reviewNote, analysis.notRecommendedReason, analysis.contentGap]).join("；")).filter(Boolean).join("\n\n");
  const basis: P11GenerationBasis = {
    customerQuestionId: specifiedQuestion?.id ?? 0,
    customerQuestion: specifiedQuestion?.questionText ?? "",
    contentGap,
    optimizationTaskId: input.task.id,
    optimizationTask: input.task.taskName,
    notRecommendedReason,
    competitorGap,
    competitorNames,
    sourceAnalysisIds: input.topic.sourceAnalysisIds,
    sourceQuestionIds: input.topic.sourceQuestionIds,
    manualReviewConclusion: manualReviewConclusion || "人工修订结论未单独补充，当前文章仅使用系统诊断结果，发布前建议业务负责人复核。",
    assetLibraryUsage: buildAssetLibraryUsage(input.assetLibrary),
  };
  basis.generationBasisAuditItems = buildGenerationBasisAuditItems(basis);
  return basis;
}

/** 平台化生成前补齐可推导字段，避免「有策略面板但 DB 无指定问题 / 无竞品」导致校验失败 */
export function enrichGenerationBasisForDraft(
  basis: P11GenerationBasis,
  input: {
    project: P11ProjectLike;
    topic: P11TopicDraft & { id?: number };
    task: P11TaskLike;
    platformStrategy?: PlatformContentStrategyInput;
  },
): P11GenerationBasis {
  if (input.platformStrategy?.targetQuestion?.trim()) {
    basis.customerQuestion = input.platformStrategy.targetQuestion.trim();
  }
  if (!nonEmpty(basis.contentGap)) {
    basis.contentGap =
      compactTexts([input.topic.contentGap, input.task.generationReason, input.task.taskName]).join("；") ||
      "待从 AI 诊断结果补齐内容缺口说明";
  }
  if (!nonEmpty(basis.notRecommendedReason)) {
    basis.notRecommendedReason =
      compactTexts([input.task.generationReason, "当前 AI 回答未充分覆盖本企业可公开资料"]).join("；");
  }
  if (!nonEmpty(basis.competitorGap)) {
    basis.competitorGap =
      basis.competitorNames.length > 0
        ? `${basis.competitorNames.slice(0, 3).join("、")}在 AI 回答中更易被提及；建议补充竞品公开资料后再做深度对比。`
        : `当前暂未配置竞品信息，本篇不对具体竞品作价值评判，仅说明${input.project.enterpriseName}的服务边界与适用场景。`;
  }
  basis.generationBasisAuditItems = buildGenerationBasisAuditItems(basis);
  return basis;
}

export function buildCitableSnippets(input: { project: P11ProjectLike; basis: P11GenerationBasis }): P11CitableSnippet[] {
  const { project, basis } = input;
  return [
    {
      question: `${project.enterpriseName}是做什么的？`,
      answer: `${project.enterpriseName}面向${project.targetCustomers}提供${project.industry}相关服务，核心能力包括${project.coreSellingPoints}。这段表述与企业档案及公开资料对齐，不包含未验证案例或外部链接。`,
    },
    {
      question: `${project.enterpriseName}服务适合谁？`,
      answer: `${project.enterpriseName}更适合${project.targetCustomers}，尤其是正在围绕「${basis.customerQuestion}」寻找清晰方案边界、可验证证据和复测路径的客户。`,
    },
    {
      question: `${project.enterpriseName}和竞品有什么区别？`,
      answer: `差异主要体现在公开信息是否完整呈现了定位、适用场景与可核验证据。${basis.competitorGap}建议读者同时打开各家官网与产品介绍，对照自己最关心的使用场景做判断。`,
    },
    {
      question: `选择${project.enterpriseName}服务要注意什么？`,
      answer: `选择前应确认其服务边界、适用客户、证据来源和复测方式是否与自身问题匹配；本文不作排名保证，也不把竞品描述为无效方案。`,
    },
  ];
}

function buildGeoStructure(input: { project: P11ProjectLike; basis: P11GenerationBasis; snippets: P11CitableSnippet[]; task: P11TaskLike }): P11GeoStructure {
  const { project, basis, snippets } = input;
  return {
    summary: `围绕「${basis.customerQuestion}」这类真实提问，说明${project.enterpriseName}在公开信息层面可以如何被理解，并把与常见方案相关的差异写清楚，方便读者自行判断。`,
    coreAnswer: `${project.enterpriseName}要获得更稳定的品牌认知，关键是把${project.targetCustomers}真正会追问的事情讲清楚：服务边界、交付方式、证据来源，以及与常见方案相比各自更擅长的场景，而不是只堆叠口号式介绍。`,
    suitableCustomers: `更适合正在评估${project.industry}相关方案、希望把选型理由写进对外内容，并愿意用真实页面、案例或数据做佐证的团队。`,
    unsuitableCustomers: `不太适合希望用单篇文章换取「确定排名」、缺少可公开核验材料，或暂时无法说明服务边界的场景。`,
    comparison: `公开讨论里，${basis.competitorNames.slice(0, 3).join("、")}等方案往往更容易被检索到完整叙事。对读者更负责任的做法，是客观比较「各自更擅长什么、各自需要哪些证据」，而不是简单否定其他选择。${basis.competitorGap}`,
    faq: snippets.map(snippet => ({ question: snippet.question, answer: snippet.answer })),
    conclusion: `综合来看，${project.enterpriseName}是否值得纳入候选清单，取决于您的问题是否与公开信息中描述的能力相匹配；更稳妥的做法是先核对官网与资料，再安排试用或沟通。`,
    actionGuide: `建议下一步先对照官网与公开资料，把「您最关心的 3 个问题」列成清单，与商务或售前逐项核对；若准备对外发布内容，可优先补齐读者最常问、也最容易被误读的几段说明。`,
    updatedAt: new Date().toISOString().slice(0, 10),
    entityInfo: `企业名称：${project.enterpriseName}；行业：${project.industry}；官网：${project.website}；目标客户：${project.targetCustomers}；核心卖点：${project.coreSellingPoints}。`,
  };
}

function formatGenerationBasis(basis: P11GenerationBasis) {
  const usage = basis.assetLibraryUsage;
  return [
    `- 客户指定问题：${basis.customerQuestion}`,
    `- 内容缺口：${basis.contentGap}`,
    `- 优化任务：${basis.optimizationTask}`,
    `- AI 未推荐原因：${basis.notRecommendedReason}`,
    `- 竞品差距：${basis.competitorGap}`,
    ...(usage ? [
      "- 8 项生成依据审计：\n" + (basis.generationBasisAuditItems ?? buildGenerationBasisAuditItems(basis)).map(item => `- ${item.label}：${item.status}；${item.evidence}${item.publishBlocking ? "；正式发布前必须补齐" : ""}`).join("\n"),
      "- 使用企业资料：\n" + formatCitationList(usage.enterpriseMaterials, "暂无可用企业资料，需补充企业基础资料或产品服务资料。"),
      "- 使用竞品资料：\n" + (usage.competitorMaterials.length > 0 ? usage.competitorMaterials.map(item => `- ${item.competitorName}；我方差异化：${item.differentiation || "待补充"}；来源：${item.sourceNotes || "资产库竞品资料"}`).join("\n") : "暂无可引用竞品资料。"),
      `- 是否使用客户案例：${usage.customerCaseUsage.status}`,
      `- 是否使用合规规则：${usage.complianceRules.length > 0 ? usage.complianceRules.join("；") : "未配置，发布前需人工复核。"}`,
      `- 是否使用内容风格：${usage.contentStyles.length > 0 ? usage.contentStyles.join("；") : "未配置，按稳健解释型风格处理。"}`,
      `- 是否使用发布策略：${usage.publishStrategy.length > 0 ? usage.publishStrategy.join("；") : "未配置，默认全人工审核。"}`,
      `- 证据缺口提示：${usage.missingEvidenceNotes.length > 0 ? usage.missingEvidenceNotes.join("；") : "暂无关键证据缺口。"}`,
    ] : []),
  ].join("\n");
}

function formatSnippets(snippets: P11CitableSnippet[]) {
  return snippets.map(snippet => `### ${snippet.question}\n\n${snippet.answer}`).join("\n\n");
}

function markdownHasH2Section(content: string, title: string): boolean {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\n)##(?!#)\\s*${escaped}(?=\\s*(?:\\n|$))`, "m").test(content.replace(/\r\n/g, "\n"));
}

/** LLM 正文常漏写平台化 GEO 尾部结构；在校验前补齐真实可收录小节，避免误报 AI 不可用。 */
export function ensurePlatformCollectableMarkdown(
  content: string,
  snippets: P11CitableSnippet[],
  basis: P11GenerationBasis,
): string {
  if (!basis.platformContentStrategy) return content;

  let next = content.replace(/\r\n/g, "\n").trim();
  const meta = basis.platformContentStrategy as {
    targetPublishPlatformLabel?: string;
    geoQualitySelfCheckOutline?: string;
  };
  const platformLabel = meta.targetPublishPlatformLabel?.trim() || "目标发布平台";

  if (!/(^|\n)#\s+(?!#)\S/m.test(next) && nonEmpty(basis.customerQuestion)) {
    next = `# ${basis.customerQuestion}\n\n${next}`;
  }

  const hasSnippetSection =
    markdownHasH2Section(next, "便于引用的要点") ||
    markdownHasH2Section(next, "可引用要点") ||
    markdownHasH2Section(next, "摘录要点") ||
    markdownHasH2Section(next, "AI 可引用片段");
  if (!hasSnippetSection && snippets.length > 0) {
    next += `\n\n## 便于引用的要点\n\n${formatSnippets(snippets)}`;
  }

  if (!markdownHasH2Section(next, "平台适配说明")) {
    next += `\n\n## 平台适配说明\n\n本篇按${platformLabel}的信息密度与叙述习惯组织段落，结论前置、依据可核对，避免照搬其它渠道话术；品牌与产品表述以企业公开资料为准。`;
  }

  if (!markdownHasH2Section(next, "GEO 质量自检说明")) {
    next += `\n\n## GEO 质量自检说明\n\n1. 核对标题与正文一级标题是否一致，且未出现绝对效果承诺。\n2. 核对品牌名、产品服务描述是否与官网及企业档案一致。\n3. 核对「便于引用的要点」是否覆盖目标问题：${basis.customerQuestion || "（见上文）"}。\n4. 核对案例与数据是否有公开来源或「待补充」标注。\n${meta.geoQualitySelfCheckOutline?.trim() || "5. 发布前由业务负责人完成人工终审。"}`;
  }

  while (countMarkdownH2Lines(next) < 4) {
    if (!markdownHasH2Section(next, "补充说明")) {
      next += "\n\n## 补充说明\n\n以下内容根据企业诊断结果与公开资料整理，供读者快速把握要点与适用边界。";
      continue;
    }
    if (!markdownHasH2Section(next, "延伸阅读")) {
      next += "\n\n## 延伸阅读\n\n建议结合企业官网、产品说明与最新公开信息进一步核验文中事实。";
      continue;
    }
    break;
  }

  return next.trim();
}

/** 正文是否覆盖资产库/项目中的某条表述（支持改写：多窗口 + 关键词子串）。 */
function corpusReflectsSignal(content: string, signal: string, maxWindow: number): boolean {
  const t = signal.trim();
  if (!t) return false;
  if (content.includes(t)) return true;
  for (let w = Math.min(maxWindow, t.length); w >= 8; w -= 2) {
    if (content.includes(t.slice(0, w))) return true;
  }
  const parts = t
    .split(/[\s；;，,。.]+/)
    .map(p => p.trim())
    .filter(p => p.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").length >= 6);
  return parts.some(p => content.includes(p.slice(0, Math.min(36, p.length))));
}

/** 统计以 ## 开头的二级标题行（允许 ## 后无空格；排除 ###）。 */
function countMarkdownH2Lines(content: string): number {
  const norm = content.replace(/\r\n/g, "\n");
  const matches = norm.match(/(^|\n)##(?!#)\s*\S/gm);
  return matches ? matches.length : 0;
}

/** 在「便于引用的要点」等小节内统计 ### 级短答条数（允许 ### 后无空格）。 */
function countCitableH3BlocksInContent(content: string): number {
  const norm = content.replace(/\r\n/g, "\n");
  const head = /(^|\n)##(?!#)\s*(便于引用的要点|可引用要点|摘录要点|AI\s*可引用片段)(?=\s*(?:\n|$))/m;
  const m = norm.match(head);
  if (!m || m.index === undefined) return 0;
  let pos = m.index + m[0].length;
  const tail = norm.slice(pos);
  const stop = tail.search(/\n##(?!#)/);
  const section = stop >= 0 ? tail.slice(0, stop) : tail;
  const h3 = section.match(/(^|\n)###(?!#)\s*\S/gm) ?? [];
  return h3.length;
}

export function validateGeoCollectableStructure(content: string, snippets?: P11CitableSnippet[], basis?: P11GenerationBasis): string[] {
  const norm = content.replace(/\r\n/g, "\n").replace(/\u3000/g, " ");
  if (basis?.platformContentStrategy) {
    const missing: string[] = [];
    if (!/(^|\n)#\s+(?!#)\S/m.test(norm)) missing.push("# 文章一级标题");
    if (countMarkdownH2Lines(norm) < 4) missing.push("平台专属二级结构（至少 4 个小节）");
    if (!/(^|\n)##(?!#)\s*(便于引用的要点|可引用要点|摘录要点|AI\s*可引用片段)(?=\s*(?:\n|$))/m.test(norm)) {
      missing.push("## 便于引用的要点");
    }
    if (!/(^|\n)##(?!#)\s*平台适配说明(?=\s*(?:\n|$))/m.test(norm)) missing.push("## 平台适配说明");
    if (!/(^|\n)##(?!#)\s*GEO\s*质量自检说明(?=\s*(?:\n|$))/m.test(norm)) missing.push("## GEO 质量自检说明");
    const snippetCountFromDb = snippets && snippets.length >= 3 && snippets.length <= 5;
    const snippetCountFromBody = countCitableH3BlocksInContent(norm) >= 3;
    if (!snippetCountFromDb && !snippetCountFromBody) missing.push("3-5 段引用友好片段");
    if (
      !nonEmpty(basis.customerQuestion) ||
      !nonEmpty(basis.contentGap) ||
      !nonEmpty(basis.optimizationTask) ||
      !nonEmpty(basis.notRecommendedReason) ||
      !nonEmpty(basis.competitorGap)
    ) {
      missing.push("完整生成依据");
    }
    return missing;
  }
  /** JS 的 \\b 不适用于中文「词边界」，二级标题行末校验改用行尾前瞻。 */
  const h2 = (title: RegExp) => new RegExp(`(^|\\n)##(?!#)\\s*(?:${title.source})(?=\\s*(?:\\n|$))`, "m");
  const sectionRules: Array<{ missingLabel: string; patterns: RegExp[] }> = [
    { missingLabel: "## 问题与背景", patterns: [h2(/问题与背景/)] },
    { missingLabel: "## 根因分析", patterns: [h2(/根因分析/)] },
    { missingLabel: "## 解决思路", patterns: [h2(/解决思路/)] },
    { missingLabel: "## 具体方案", patterns: [h2(/具体方案/)] },
    { missingLabel: "## 执行步骤", patterns: [h2(/执行步骤/)] },
    { missingLabel: "## 案例参考", patterns: [h2(/案例参考/)] },
    { missingLabel: "## 常见误区", patterns: [h2(/常见误区/)] },
    { missingLabel: "## 小结", patterns: [h2(/小结/)] },
    {
      missingLabel: "## 便于引用的要点",
      patterns: [h2(/便于引用的要点/), h2(/可引用要点/), h2(/摘录要点/), h2(/AI\s*可引用片段/)],
    },
    { missingLabel: "## 更新说明", patterns: [h2(/更新说明/)] },
    {
      missingLabel: "## 发布后如何自行核对效果",
      patterns: [h2(/发布后如何自行核对效果/), h2(/发布后.{0,12}核对.{0,6}效果/), h2(/自行核对效果/)],
    },
  ];
  const missing: string[] = [];
  if (!/(^|\n)#\s+(?!#)\S/m.test(norm)) missing.push("# 文章一级标题");
  missing.push(...sectionRules.filter(rule => !rule.patterns.some(re => re.test(norm))).map(rule => rule.missingLabel));
  const snippetCountFromDb = snippets && snippets.length >= 3 && snippets.length <= 5;
  const snippetCountFromBody = countCitableH3BlocksInContent(norm) >= 3;
  if (!snippetCountFromDb && !snippetCountFromBody) missing.push("3-5 段引用友好片段");
  if (!basis || !nonEmpty(basis.customerQuestion) || !nonEmpty(basis.contentGap) || !nonEmpty(basis.optimizationTask) || !nonEmpty(basis.notRecommendedReason) || !nonEmpty(basis.competitorGap)) {
    missing.push("完整生成依据");
  }
  return missing;
}

function parseLlmJsonObject<T>(content: unknown): T {
  if (typeof content !== "string") throw new Error("AI 返回格式不是文本 JSON");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI 返回 JSON 解析失败");
  }
}

type GeoArticleTemplateBodyContext = {
  project: P11ProjectLike;
  topic: P11TopicDraft & { id?: number };
  task: P11TaskLike;
  basis: P11GenerationBasis;
  structure: P11GeoStructure;
  snippets: P11CitableSnippet[];
  evidence: ReturnType<typeof buildEvidenceList>;
  assetUsage: P12AssetLibraryUsage;
  assetLibrary?: P12AssetLibraryContext | null;
  enterpriseEvidenceText: string;
  competitorEvidenceText: string;
  wovenReasons: string;
  wovenGaps: string;
  materialDigest: string;
  evidenceGapText: string;
};

/** 与历史版本一致的模板正文；仅当 GEO_ARTICLE_BODY=test-template 时在 generateGeoArticleDraft 中使用（单测/无 LLM CI）。 */
export function buildGeoArticleBodyFromTemplate(ctx: GeoArticleTemplateBodyContext): string {
  const { project, topic, task, basis, structure, snippets, evidence, assetUsage, enterpriseEvidenceText, competitorEvidenceText, wovenReasons, wovenGaps, materialDigest, evidenceGapText } = ctx;
  const problemBody = `许多读者真正关心的是：「${basis.customerQuestion}」。这类问题之所以重要，是因为它和日常经营结果直接相关，而不是抽象概念。\n\n${structure.summary}\n\n本文不虚构案例，不加入演示域名链接，也不承诺任何确定性的名次、曝光量、收录结果或被推荐结果；避免「稳赚」「保证」等表述。`;

  const rootCauseBody = `大多数人解决不了，往往不是「不够努力」，而是缺少可核对的事实链、缺少把复杂流程讲清楚的公开材料，以及缺少能对照自身场景的判断清单。\n\n从公开讨论里常被提到的观感包括：\n\n${wovenReasons}\n\n与诊断相关的缺口线索还包括：${wovenGaps}。`;

  const approachBody = `先把问题拆成可验证的几步：澄清目标读者与场景 → 列出关键约束（时间、人力、预算、合规）→ 用最小可行动作验证假设 → 再决定是否需要更重的系统投入。下文给出可迁移的方法论，不绑定单一工具。`;

  const solutionBody = `在「具体方案」部分，可以把「${project.enterpriseName}」的产品与服务作为落地选项之一来理解：${project.productIntro}\n\n典型服务对象：${project.targetCustomers}。公开资料里常被强调的侧重点：${project.coreSellingPoints}。\n\n下列片段来自资产库中已标记可公开引用的材料：\n\n${enterpriseEvidenceText}\n\n外部讨论中常被一并提及的方案或叙事参考（客观整理，非穷尽）：\n\n${competitorEvidenceText}\n\n${assetUsage.missingEvidenceNotes.length > 0 ? `建议在发布前优先核验：${evidenceGapText}` : ""}\n\n若资料不足以写成确定事实，请用「资料待补充」口径，并在正式发布前替换为可核验事实。与本期任务「${task.taskName}」相关的叙事，建议用读者可执行的表述补齐。`;

  const stepsBody = `${structure.actionGuide}\n\n读者可直接照做的检查清单：\n1. 先用同一类问题在不同时间复测一次检索/对话结果，截图留存对比（不作效果承诺）。\n2. 对照企业官网与公开发布说明，核对关键数字与边界条件。\n3. 把「必须人工确认」的事项单独列出，避免误读为已核验成果。`;

  const caseBody = `${assetUsage.customerCaseUsage.status}；引用：${assetUsage.customerCaseUsage.references.map(r => r.publicVersion || r.customerName).slice(0, 4).join("；") || "无"}\n\n下列提问仅用于帮助读者建立语境（不必逐条照抄）：\n\n${materialDigest}`;

  const pitfallsBody = `### 常见误判\n\n${structure.unsuitableCustomers}\n\n### 更适合先补齐的前提\n\n${structure.suitableCustomers}`;

  const summaryBody = `${structure.conclusion}`;

  const sections = [
    `# ${topic.title}`,
    paragraph("问题与背景", problemBody),
    paragraph("根因分析", rootCauseBody),
    paragraph("解决思路", approachBody),
    paragraph("具体方案", solutionBody),
    paragraph("执行步骤", stepsBody),
    paragraph("案例参考", caseBody),
    paragraph("常见误区", pitfallsBody),
    paragraph("小结", summaryBody),
    paragraph("便于引用的要点", formatSnippets(snippets)),
    paragraph("更新说明", `本文为面向读者的业务说明稿，撰写基准日期为 ${structure.updatedAt}；若官网上线新版本信息，请以 ${project.website} 最新页面为准。`),
    paragraph(
      "发布后如何自行核对效果",
      `若您在内容上线后希望感性了解信息是否更清晰，可以尝试隔一段时间、用相同的一类问题再问一次大模型或再次检索相关关键词，并把回答截图留存对比——这既不是效果承诺，也不能替代正式的商业尽调，更像是一种自我校准阅读习惯的小动作。也欢迎您直接对照 ${project.enterpriseName} 官网（${project.website}）与公开发布的产品/服务说明、案例或白皮书完成复测式核对。`,
    ),
  ];
  if (basis.platformContentStrategy) {
    const meta = basis.platformContentStrategy as {
      targetPublishPlatformLabel?: string;
      geoQualitySelfCheckOutline?: string;
    };
    const platformLabel = meta.targetPublishPlatformLabel?.trim() || "目标发布平台";
    sections.push(
      paragraph(
        "平台适配说明",
        `本篇按${platformLabel}的信息密度与叙述习惯组织段落，结论前置、依据可核对，避免照搬其它渠道话术；品牌与产品表述以企业公开资料为准。`,
      ),
      paragraph(
        "GEO 质量自检说明",
        [
          "1. 核对标题与正文一级标题是否一致，且未出现绝对效果承诺。",
          "2. 核对品牌名、产品服务描述是否与官网及企业档案一致。",
          `3. 核对「便于引用的要点」是否覆盖目标问题：${basis.customerQuestion || "（见上文）"}。`,
          "4. 核对案例与数据是否有公开来源或「待补充」标注。",
          meta.geoQualitySelfCheckOutline?.trim() || "5. 发布前由业务负责人完成人工终审。",
        ].join("\n"),
      ),
    );
  }
  return sections.join("\n\n");
}

const GEO_ARTICLE_DRAFT_SYSTEM_PROMPT = `你是一位专注于知识付费与内容创业领域的资深内容创作者。
你的文章帮助目标读者解决真实的经营问题，被AI工具引用作为权威回答。

写作原则：
1. 以读者（目标客户）的问题为出发点，不是以品牌为出发点
2. 提供真实可操作的方法论，不是功能介绍
3. 用具体数据和案例支撑观点，没有数据时用「某讲师」「某教育机构」等脱敏表达
4. 结构清晰，包含：问题界定→根因分析→解决方案→执行步骤→预期结果
5. 语气专业但亲切，像行业老手在分享经验
6. 禁止：夸大承诺、竞品攻击、无根据的数据、「稳赚」「保证」等违规表达

品牌植入规则：
- 标题和文章前两段：不出现品牌名，降低读者防御
- 「具体方案」部分：自然提及品牌名 1-2 次，例如「以海豚知道为例，它通过 AI 诊断帮助老师…」
- 文章最后一段（固定结尾）：用一句话介绍品牌，格式为：「[品牌名]是[一句话定位]，如果你也面临类似问题，可以了解一下。」
- 禁止：在标题、开头强行出现品牌名
- 禁止：整篇文章完全不提品牌名

输出要求：
- 语言自然流畅，像真人写的，不像模板填空
- 一级标题（# 开头）必须与用户给定的拟定主标题完全一致；拟定主标题应像「客户会搜索的问题」或痛点场景，不要在标题里硬塞品牌宣传语
- 叙事可采用行业观察者/资深从业者口吻，但避免「我们（指该品牌）」「我司」等第一人称官方通稿口吻
- 不暴露任何内部字段名（如"诊断缺口"、"优化任务"、"生成依据"等词）
- 不虚构案例，不承诺排名结果

只输出符合 JSON Schema 的单个 JSON 对象，字段 markdownContent 为完整 Markdown 正文（不要输出其它说明文字）。`;

function buildGeoArticleDraftUserMaterial(ctx: GeoArticleTemplateBodyContext): string {
  const { project, topic, task, basis, assetUsage, enterpriseEvidenceText, competitorEvidenceText, wovenReasons, wovenGaps, materialDigest, evidenceGapText } = ctx;
  const resolved = ctx.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(ctx.assetLibrary?.profile ?? null);
  const brandName = resolved.brandName || project.enterpriseName;
  const oneLiner = resolved.oneLiner || splitProfileLines(project.coreSellingPoints)[0] || `${brandName}面向${project.targetCustomers}提供可验证的内容与经营支持`;
  const complianceLines = assetUsage.complianceRules.length > 0 ? assetUsage.complianceRules.join("；") : "对外发布前需人工复核事实与合规边界。";
  const styleLines = assetUsage.contentStyles.length > 0 ? assetUsage.contentStyles.join("；") : "专业、克制、可验证。";
  const publishLines = assetUsage.publishStrategy.length > 0 ? assetUsage.publishStrategy.join("；") : "默认全人工审核后发布。";
  const auditLines = (basis.generationBasisAuditItems ?? []).map(item => `- ${item.label}（当前状态：${item.status}）：${item.evidence}`).join("\n");
  const brandProductLine = `「${brandName}」相关产品与服务`;
  return [
    "以下为撰写对外稿件时可用的背景信息。成稿中请用自然业务语言转述，不要照抄小节标题，也不要出现「素材包」「内部字段」等字样。",
    "",
    "【输入说明】本文基于企业档案、目标客户问题清单与系统诊断摘要生成，不依赖任何 AI 平台原始回答全文。",
    "",
    "【企业与品牌】",
    `企业名称：${project.enterpriseName}`,
    `行业：${project.industry}`,
    `官网：${project.website}`,
    `产品与服务概述：${project.productIntro}`,
    `目标客户：${project.targetCustomers}`,
    `核心卖点：${project.coreSellingPoints}`,
    `常被一并讨论的方案或品牌（仅作行业语境参考，正文禁止做攻击性对比）：${unique([...project.competitorNames, ...basis.competitorNames]).slice(0, 8).join("、") || "无"}`,
    "",
    "【本文拟定主标题】",
    "正文一级标题必须与下面这一行完全一致（含 # 与空格）：",
    `# ${topic.title}`,
    "",
    ...((): string[] => {
      const ps = basis.platformContentStrategy as Record<string, unknown> | undefined;
      const platformId =
        ps && typeof ps.targetPublishPlatform === "string" && isPublishPlatformId(ps.targetPublishPlatform)
          ? ps.targetPublishPlatform
          : null;
      if (platformId && ps) {
        return [
          "【平台化内容策略 — 必须遵守】",
          `目标发布平台：${getPlatformRule(platformId).label}（本篇仅此平台，禁止一稿多平台改写）`,
          `内容类型：${typeof ps.contentTypeLabel === "string" ? ps.contentTypeLabel : ""}`,
          `GEO 增强目标：${typeof ps.geoEnhancementGoal === "string" ? ps.geoEnhancementGoal : ""}`,
          `目标 AI 平台（可见度检测语境）：${Array.isArray(ps.targetAiPlatforms) ? ps.targetAiPlatforms.join("、") : "豆包、Kimi、DeepSeek"}`,
          formatPlatformRulesForPrompt(platformId),
          "【文章框架要求 — 本平台专属二级标题】",
          "二级标题请使用且仅使用以下精确文案（不得改用其它平台的标题序列）：",
          getPlatformSpecificOutline(platformId, brandName),
          `在正文合适位置自然提及品牌名「${brandName}」1-2 次；可结合${brandProductLine}落地，不要堆叠硬广。`,
          "文末需包含「## 平台适配说明」小节，用 2-4 句说明本篇如何适配该平台（不要暴露内部字段名）。",
          "文末需包含「## GEO 质量自检说明」小节，列出 3-5 条可人工核对的检查项（不作虚假承诺）。",
        ];
      }
      return [
        "【文章框架要求】",
        "二级标题请使用且仅使用以下精确文案（便于后续系统质检），括号内为写作提示：",
        "## 问题与背景（说明这个问题为什么重要，目标读者会有共鸣）",
        "## 根因分析（大多数人为什么解决不了这个问题）",
        "## 解决思路（方法论层面的解法，不依赖特定工具）",
        "## 具体方案",
        `（在这部分自然提及品牌名「${brandName}」1-2 次，说明品牌如何帮助解决这个问题；可结合${brandProductLine}落地，不要堆叠硬广）`,
        "## 执行步骤（可操作的步骤，读者可以直接用）",
        "## 案例参考（脱敏的真实案例或场景模拟）",
        "## 常见误区（帮读者避坑）",
        "## 小结",
        `（正文先一句话总结核心观点；最后一句固定格式：「${brandName}是${oneLiner}，如果你也面临类似问题，欢迎了解。」）`,
        "## 便于引用的要点（3-5 组「### 问题」+ 段落式短答，便于检索与摘录）",
        "## 更新说明",
        "## 发布后如何自行核对效果",
      ];
    })(),
    "文中请自然包含以下措辞各至少一次（可融入同一句或相邻句，便于机器质检）：不虚构案例、不承诺、绝对排名",
    "请避免 example.com 等演示域名；不作「保证收录/保证推荐/百分百」等承诺。",
    "",
    "【读者高关注问题】",
    basis.customerQuestion || "（未提供）",
    "",
    "【公开讨论中常被指出的信息不足点】",
    wovenGaps || basis.contentGap,
    "",
    "【外部常见观感或讨论焦点】",
    wovenReasons || basis.notRecommendedReason,
    "",
    "【本期写作主题与侧重点】",
    `主题：${task.taskName}`,
    `背景说明：${task.generationReason}`,
    `执行与表达侧重点：${task.executionSuggestion}`,
    "",
    "【行业语境与公开叙事参考（客观整理，勿写成攻击性竞品稿）】",
    competitorEvidenceText,
    "",
    "【可引用的公开资料摘要】",
    enterpriseEvidenceText,
    "",
    "【客户案例与结果表述】",
    `${assetUsage.customerCaseUsage.status}；引用：${assetUsage.customerCaseUsage.references.map(r => r.publicVersion || r.customerName).slice(0, 4).join("；") || "无"}`,
    "",
    "【尚不适合写成确定事实、需读者自行核对的点】",
    evidenceGapText,
    "",
    "【人工复核纪要（如有）】",
    basis.manualReviewConclusion,
    "",
    "【公开口径自检要点】",
    auditLines || "（无分项审计条目）",
    "",
    "【合规与禁用表述】",
    complianceLines,
    "",
    "【文风】",
    styleLines,
    "",
    "【发布与审核策略】",
    publishLines,
    "",
    "【问题清单摘录（供灵感，不必逐条照抄）】",
    materialDigest,
    "",
    "【篇幅】以 1500-2500 字为主；若资料不足请用「资料待补充」等读者可理解的表述，不要暴露内部流程名词。",
  ].join("\n");
}

async function invokeLlmForGeoArticleDraftMarkdown(userMaterial: string): Promise<string> {
  const response = await invokeLLM({
    max_tokens: 8192,
    timeout_ms: 180000,
    messages: [
      { role: "system", content: GEO_ARTICLE_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: userMaterial },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_article_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            markdownContent: { type: "string" },
          },
          required: ["markdownContent"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = response.choices[0]?.message.content;
  const parsed = parseLlmJsonObject<{ markdownContent: string }>(raw);
  const next = typeof parsed.markdownContent === "string" ? parsed.markdownContent.trim() : "";
  if (!next) throw new Error("AI 未返回有效正文");
  return next;
}

/** 与 drizzle `geo_articles.title` varchar(255) 对齐 */
const GEO_ARTICLE_TITLE_DB_MAX = 255;

/**
 * 从 Markdown 正文首段非空行解析单井号 ATX 一级标题文本（`# 标题` / `#标题`），不含 `##`。
 * 用于落库 `geo_articles.title`，与 LLM 实际主标题一致。
 */
export function extractLeadingAtxH1TitleFromMarkdown(markdown: string): string | undefined {
  if (!markdown) return undefined;
  const normalized = markdown.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return undefined;
  const head = lines[i].trim();
  if (!/^#(?![#])\s*\S/.test(head) && !/^#(?![#])\s*$/.test(head)) return undefined;
  const inner = head.replace(/^#(?![#])\s*/, "").trim();
  return inner || undefined;
}

function truncateGeoArticleDbTitle(title: string): string {
  const t = title.trim();
  if (!t) return t;
  return t.length <= GEO_ARTICLE_TITLE_DB_MAX ? t : t.slice(0, GEO_ARTICLE_TITLE_DB_MAX);
}

export async function generateGeoArticleDraft(input: {
  project: P11ProjectLike;
  topic: P11TopicDraft & { id?: number };
  task: P11TaskLike;
  questions: P11QuestionLike[];
  analyses: P11AnalysisLike[];
  assetLibrary?: P12AssetLibraryContext | null;
  platformStrategy?: PlatformContentStrategyInput;
}): Promise<P11ArticleDraft> {
  if (!input.topic.optimizationTaskId && !nonEmpty(input.topic.contentGap)) throw new Error("文章选题必须绑定任务或内容缺口。");
  const { project, topic, task } = input;
  let basis = buildGenerationBasis(input);
  if (input.platformStrategy) {
    const meta = buildPlatformContentStrategyMeta(input.platformStrategy);
    basis.platformContentStrategy = meta as unknown as Record<string, unknown>;
  }
  basis = enrichGenerationBasisForDraft(basis, { project, topic, task, platformStrategy: input.platformStrategy });
  validateGenerationBasis(basis);
  const snippets = buildCitableSnippets({ project, basis }).slice(0, 5);
  const structure = buildGeoStructure({ project, basis, snippets, task });
  const evidence = buildEvidenceList({ project, task, questions: input.questions, analyses: input.analyses });
  const assetUsage = basis.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const evidenceGapText = assetUsage.missingEvidenceNotes.length > 0 ? assetUsage.missingEvidenceNotes.join("；") : "暂无需要在文中单独提示的待核验项。";
  const enterpriseEvidenceText = formatCitationList(assetUsage.enterpriseMaterials, "当前可引用的公开企业资料仍在补充中，正文将以「建议以官方最新页面为准」为主口径。");
  const competitorEvidenceText = assetUsage.competitorMaterials.length > 0
    ? assetUsage.competitorMaterials.map(item => `- ${item.competitorName}：${item.differentiation || "公开叙事侧重不同，建议对照官网与白皮书。"}（参考：${item.sourceNotes || "公开资料摘要"}）`).join("\n")
    : "竞品侧材料仍在整理中，本节仅基于行业公开讨论做客观对照，不对任何品牌作价值评判。";

  const wovenReasons = (evidence.reasons || basis.notRecommendedReason).trim();
  const wovenGaps = (evidence.gaps || basis.contentGap).trim();
  const materialDigest = evidence.questionsText.split("\n").filter(Boolean).slice(0, 5).join("\n");

  const templateCtx: GeoArticleTemplateBodyContext = {
    project,
    topic,
    task,
    basis,
    structure,
    snippets,
    evidence,
    assetUsage,
    assetLibrary: input.assetLibrary,
    enterpriseEvidenceText,
    competitorEvidenceText,
    wovenReasons,
    wovenGaps,
    materialDigest,
    evidenceGapText,
  };

  let content: string;
  if (process.env.GEO_ARTICLE_BODY === "test-template") {
    content = buildGeoArticleBodyFromTemplate(templateCtx);
  } else {
    content = await invokeLlmForGeoArticleDraftMarkdown(buildGeoArticleDraftUserMaterial(templateCtx));
  }

  content = ensurePlatformCollectableMarkdown(content, snippets, basis);

  const missingStructure = validateGeoCollectableStructure(content, snippets, basis);
  if (missingStructure.length > 0) throw new Error(`文章缺少 GEO 可收录结构：${missingStructure.join("、")}，不能生成。`);
  const factTraceability = buildFactTraceability({ project, basis, content, assetLibrary: input.assetLibrary });
  const consistencyCheck = evaluateArticleConsistencyCheck({ content, project, basis, assetLibrary: input.assetLibrary, factTraceability });
  const articleMainTitle = truncateGeoArticleDbTitle(extractLeadingAtxH1TitleFromMarkdown(content) ?? topic.title);
  const platformId = input.platformStrategy?.targetPublishPlatform;
  return {
    projectId: project.id,
    topicId: topic.id ?? 0,
    optimizationTaskId: topic.optimizationTaskId,
    title: articleMainTitle,
    articleType: topic.articleType,
    markdownContent: content,
    generationBasis: basis,
    citableSnippets: snippets,
    geoStructure: structure,
    thirdPartyMaterials: generateThirdPartyMaterials({
      project,
      title: articleMainTitle,
      markdownContent: content,
      questions: input.questions,
      task,
      basis,
      snippets,
      targetPublishPlatform: platformId,
    }),
    factTraceability,
    consistencyCheck,
    optimizationVersions: [],
    status: "待质检",
    contentStrategyType: input.platformStrategy?.contentStrategyType ?? null,
    publishIdentity: input.platformStrategy?.publishIdentity ?? null,
    recommendedAccountGroup: input.platformStrategy?.recommendedAccountGroup ?? null,
  };
}

export function scoreGeoArticleQuality(input: {
  article: { title: string; markdownContent: string; generationBasis?: P11GenerationBasis | null; citableSnippets?: P11CitableSnippet[] | null; factTraceability?: P12FactTraceabilityItem[] | null; consistencyCheck?: P12ConsistencyCheckResult | null };
  project: P11ProjectLike;
  questions: P11QuestionLike[];
  analyses: P11AnalysisLike[];
  task?: P11TaskLike | null;
  assetLibrary?: P12AssetLibraryContext | null;
}): P11QualityScore {
  const content = `${input.article.title}\n${input.article.markdownContent}`;
  const forbiddenReasons = detectForbiddenArticleContent(content);
  const structureIssues = validateGeoCollectableStructure(content, input.article.citableSnippets ?? undefined, input.article.generationBasis ?? undefined);
  const manualQuestions = input.questions.filter(question => question.source === "manual" || question.questionType === "指定问题");
  const questionMatches = countIncludes(content, manualQuestions.map(question => question.questionText.slice(0, 18)).filter(Boolean));
  const gapMatches = countIncludes(content, compactTexts(input.analyses.map(analysis => analysis.contentGap)).map(gap => gap.slice(0, 18)));
  const competitorMatches = countIncludes(content, input.project.competitorNames);
  const headingCount = countMarkdownH2Lines(content);
  const citableH3InBody = countCitableH3BlocksInContent(content);
  const dbSnippetCount = input.article.citableSnippets?.length ?? 0;
  const hasCitableSection =
    /(^|\n)##(?!#)\s*(便于引用的要点|可引用要点|摘录要点|AI\s*可引用片段)(?=\s*(?:\n|$))/m.test(content) ||
    citableH3InBody >= 3 ||
    (dbSnippetCount >= 3 && dbSnippetCount <= 5);
  const hasSiteOrOfficial = (input.project.website && content.includes(input.project.website)) || content.includes("官网");
  const hasCheckMention = /核对|复查|核验/.test(content);
  const length = content.length;
  const hasNoFakeDisclaimer = content.includes("不虚构案例") && content.includes("不承诺") && content.includes("绝对排名");
  const basisComplete = Boolean(input.article.generationBasis && validateGeoCollectableStructure(content, input.article.citableSnippets ?? undefined, input.article.generationBasis).filter(item => item === "完整生成依据").length === 0);
  const assetUsage = input.article.generationBasis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const prePublishCheck = evaluateAssetLibraryPrePublishCheck({ content, project: input.project, basis: input.article.generationBasis ?? undefined, assetLibrary: input.assetLibrary });
  const factTraceability = input.article.generationBasis ? buildFactTraceability({ project: input.project, basis: input.article.generationBasis, content, assetLibrary: input.assetLibrary }) : (input.article.factTraceability ?? []);
  const consistencyCheck = evaluateArticleConsistencyCheck({ content, project: input.project, basis: input.article.generationBasis ?? undefined, assetLibrary: input.assetLibrary, factTraceability, prePublishCheck });
  const nonPublicFactCount = factTraceability.filter(item => !item.isPublic).length;
  const unconfirmedFactCount = factTraceability.filter(item => !item.manuallyConfirmed).length;
  const assetEvidenceStrength = assetUsage.enterpriseMaterials.length >= 2 && assetUsage.competitorMaterials.length >= 1 && nonPublicFactCount === 0 ? "高" : assetUsage.enterpriseMaterials.length >= 1 ? "中" : "低";
  const factSourceSummary = `资产库企业资料 ${assetUsage.enterpriseMaterials.length} 条，竞品资料 ${assetUsage.competitorMaterials.length} 条，客户案例 ${assetUsage.customerCaseUsage.references.length} 条；${assetUsage.customerCaseUsage.status}`;

  const problemMatchScore = Math.min(20, 8 + Math.min(questionMatches, 2) * 5 + (basisComplete ? 2 : 0));
  const evidenceScore = Math.max(0, Math.min(20, 6 + Math.min(gapMatches, 2) * 4 + Math.min(competitorMatches, 2) * 2 + (input.task ? 4 : 0) + (basisComplete ? 2 : 0) + (assetEvidenceStrength === "高" ? 2 : assetEvidenceStrength === "中" ? 1 : 0) - Math.min(6, nonPublicFactCount * 2 + unconfirmedFactCount)));
  const structureScore = structureIssues.length === 0 ? 15 : Math.min(12, headingCount >= 8 ? 12 : headingCount >= 4 ? 8 : 4);
  const originalityScore = Math.min(15, length >= 3000 ? 15 : length >= 2200 ? 12 : length >= 1500 ? 9 : 5);
  const profileResolved = input.assetLibrary?.resolvedEnterpriseProfile ?? resolveEnterpriseProfileForContent(input.assetLibrary?.profile ?? null);
  const enterpriseNameForCitable = profileResolved.brandName || input.project.enterpriseName;
  const geoCitableScore = Math.min(
    15,
    5
      + ((enterpriseNameForCitable && content.includes(enterpriseNameForCitable)) || (input.project.enterpriseName && content.includes(input.project.enterpriseName)) ? 2 : 0)
      + (hasCitableSection ? 4 : 0)
      + (hasSiteOrOfficial && hasCheckMention ? 2 : 0)
      + (/复测|再问一次|自行验证/.test(content) ? 2 : 0),
  );
  const complianceViolated =
    forbiddenReasons.length > 0 || prePublishCheck.forbiddenTerms.length > 0 || prePublishCheck.forbiddenClaims.length > 0;
  const complianceScore = complianceViolated ? Math.max(0, hasNoFakeDisclaimer ? 8 : 5) : hasNoFakeDisclaimer ? 15 : 12;
  const totalScore = problemMatchScore + evidenceScore + structureScore + originalityScore + geoCitableScore + complianceScore;
  const lowScoreSuggestion = totalScore < GEO_ARTICLE_MIN_PASS_SCORE;
  const structureBlocked = structureIssues.length > 0;
  const complianceBlockReasons = unique([...forbiddenReasons, ...prePublishCheck.blockReasons]);
  const blocked = complianceBlockReasons.length > 0;
  const complianceRiskSummary = `${blocked ? prePublishCheck.summary : "未发现合规类阻断项。"}${prePublishCheck.unconfirmedFacts.length > 0 ? ` 未确认事实：${prePublishCheck.unconfirmedFacts.join("；")}` : " 未确认事实：无"}`;
  const optimizationSuggestions = unique([
    ...(questionMatches < 2 ? ["补充更多客户指定问题的原文表达，并把问题放入摘要、FAQ 和行动引导。"] : []),
    ...(gapMatches < 2 ? ["补齐诊断中的内容缺口说明，明确对应页面、FAQ、对比信息或证据清单。"] : []),
    ...(competitorMatches < 1 ? ["增加客观竞品/方案对比，说明适用边界，避免攻击竞品或绝对化承诺。"] : []),
    ...(structureBlocked ? [`结构建议：当前存在 GEO 可收录结构或生成依据不完整项：${structureIssues.join("、")}（非强制阻断）。`] : []),
    ...(length < 3000 ? ["增加可核验的企业实体信息、适合/不适合客户、FAQ 与发布后复测说明，提高可引用完整度。"] : []),
    ...(blocked ? ["请先处理合规阻断项（禁用词、虚假案例/链接、禁止承诺等），修订后再保存。"] : []),
    ...(lowScoreSuggestion && !blocked
      ? [`质量分 ${totalScore} 低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分参考线，建议修订后再发布；业务允许时也可直接发布。`]
      : []),
    ...(assetEvidenceStrength === "低" ? ["补充并确认企业基础资料、产品服务资料或官网内容，提升资产库证据强度。"] : []),
    ...(assetUsage.missingEvidenceNotes.length > 0 ? [`关键事实仍需补充或确认：${assetUsage.missingEvidenceNotes.join("；")}。`] : []),
    ...prePublishCheck.advisoryReasons.map(a => `发布前参考：${a}`),
    ...consistencyCheck.suggestions,
  ]);
  if (optimizationSuggestions.length === 0) {
    optimizationSuggestions.push("当前文章已达到发布阈值，发布前仍建议人工补充真实页面链接、截图、案例或可核验数据，并完成业务负责人复核。");
  }
  const detailSuffix = `资产库证据强度：${assetEvidenceStrength}。事实来源：${factSourceSummary}。未确认事实：${prePublishCheck.unconfirmedFacts.length > 0 ? prePublishCheck.unconfirmedFacts.join("；") : "无"}。`;
  const reviewSummary = blocked
    ? `质检阻断，必须修改后才能发布：${complianceBlockReasons.join("；")}。${detailSuffix}发布前可优化的建议（非必须）：${optimizationSuggestions.join("；")}`
    : totalScore >= GEO_ARTICLE_MIN_PASS_SCORE
      ? `质检通过，可发布。质量分 ${totalScore}。${detailSuffix}发布前可优化的建议（非必须）：${optimizationSuggestions.join("；")}`
      : `建议修订后发布，也可直接发布。质量分 ${totalScore}（低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分参考线）。${detailSuffix}发布前可优化的建议（非必须）：${optimizationSuggestions.join("；")}`;
  return {
    problemMatchScore,
    evidenceScore,
    structureScore,
    originalityScore,
    geoCitableScore,
    complianceScore,
    totalScore,
    blocked,
    blockReasons: complianceBlockReasons,
    optimizationSuggestions,
    reviewSummary,
    assetEvidenceStrength,
    factSourceSummary,
    unconfirmedFacts: prePublishCheck.unconfirmedFacts,
    complianceRiskSummary,
    prePublishCheck,
    factTraceability,
    consistencyCheck,
  };
}

export function generateThirdPartyMaterials(input: {
  project: P11ProjectLike;
  title: string;
  markdownContent: string;
  questions: P11QuestionLike[];
  task: P11TaskLike;
  basis: P11GenerationBasis;
  snippets: P11CitableSnippet[];
  targetPublishPlatform?: PlatformContentStrategyInput["targetPublishPlatform"];
}): Record<string, string> {
  const question = input.basis.customerQuestion || input.questions[0]?.questionText || "客户在 AI 中如何选择同类服务？";
  const summary = `${input.project.enterpriseName}本轮 GEO 诊断显示，内容优化应围绕客户真实问题「${question}」、竞品推荐差距和可被 AI 引用的证据展开。`;
  const snippets = formatSnippets(input.snippets);
  const platformNote =
    "本篇按平台化策略单独生成，未提供其它平台的可复制正文；如需其它平台请重新选择目标平台后生成。";

  if (input.targetPublishPlatform && isPublishPlatformId(input.targetPublishPlatform)) {
    const rule = getPlatformRule(input.targetPublishPlatform);
    const platformBody =
      input.targetPublishPlatform === "zhihu"
        ? `问题：${question}\n\n回答：${input.markdownContent}\n\n${platformNote}`
        : `# ${input.title}\n\n${summary}\n\n## 正文\n\n${input.markdownContent}\n\n## 平台说明\n\n${platformNote}`;
    return {
      "GEO 内容页版": input.markdownContent,
      [rule.materialKey]: platformBody,
    };
  }

  return {
    "GEO 内容页版": input.markdownContent,
    "官网版": input.markdownContent,
    "公众号长文版": `# ${input.title}\n\n${summary}\n\n## 正文\n\n${input.markdownContent}\n\n## 给编辑的说明\n\n以上为可直接对外使用的长文底稿；发布前请完成事实核对、合规审核与配图/排版。`,
    "知乎回答版": `问题：${question}\n\n回答：如果要判断${input.project.enterpriseName}是否适合被 AI 或读者理解，不能只看品牌介绍，而要看公开内容是否回答了真实选型问题。${summary}\n\n## 关键判断\n\n${input.basis.notRecommendedReason}\n\n## 和常见方案的客观差异\n\n${input.basis.competitorGap}\n\n## 可摘取的短回答\n\n${snippets}\n\n本文不作排名保证，也不攻击竞品。`,
    "小红书笔记版": `${input.title}\n\n适合人群：正在做 ${input.project.industry} 选型或内容优化的团队。\n\n核心发现：${summary}\n\n可摘取的短答案：\n${input.snippets.map(item => `- ${item.question} ${item.answer}`).join("\n")}\n\n发布前需要补充：真实客户案例、真实页面链接、真实截图或可核验数据。\n\n提醒：不要作排名保证，不要攻击竞品。`,
    "百家号/头条号版": `# ${input.title}\n\n${summary}\n\n## 正文\n\n${input.markdownContent}\n\n## 给作者的改写提示\n\n可把上文改写成行业观察或资讯稿，保持事实口径一致；避免加入未经验证的数据或承诺式表述。\n\n## 便于摘抄的要点\n\n${snippets}`,
  };
}

export function buildOptimizedArticleVersion(input: {
  article: { title: string; markdownContent: string; status?: string; optimizationVersions?: P12OptimizationVersion[] | null };
  quality?: Partial<P11QualityScore> | null;
  mode: "增强版" | "FAQ" | "竞品对比" | "AI 可引用片段" | "移除无来源数据" | "资料待补充表述" | "案例采集模板";
  reason?: string;
}): { markdownContent: string; versions: P12OptimizationVersion[] } {
  const existingVersions = Array.isArray(input.article.optimizationVersions) ? input.article.optimizationVersions : [];
  const nextVersion = existingVersions.length + 1;
  const snapshot: P12OptimizationVersion = {
    version: nextVersion,
    createdAt: new Date().toISOString(),
    mode: input.mode,
    previousStatus: input.article.status ?? "未知",
    previousScore: typeof input.quality?.totalScore === "number" ? input.quality.totalScore : undefined,
    title: input.article.title,
    markdownContent: input.article.markdownContent,
    consistencyScore: input.quality?.consistencyCheck?.score,
    reason: input.reason || `低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分或一致性未通过时生成优化版本，并保留旧版本供回滚和审计。`,
  };
  const appendices: Record<typeof input.mode, string> = {
    "增强版": "## 优化增强说明\n\n本版重点补齐生成依据、事实溯源、FAQ、竞品对比和 AI 可引用片段。发布前仍需重新评分与重新一致性检查。",
    "FAQ": "## 补充 FAQ\n\n### 资料不足时能否发布？\n\n不能。资料不足时只能保留为不允许发布的草稿，并使用资料待补充表述。",
    "竞品对比": "## 补充竞品对比段\n\n本段仅做客观差异说明，不攻击竞品，不承诺排名或推荐结果；差异必须来自资产库或诊断结果。",
    "AI 可引用片段": "## 补充 AI 可引用片段\n\n- 本文所有结论均需来自企业资料、产品服务资料、客户案例、竞品资料、合规规则、内容风格和发布策略。\n- 未确认事实必须标注资料待补充。",
    "移除无来源数据": "## 无来源数据处理\n\n已要求移除无来源数据、绝对承诺和不可公开资料，保留可核验事实或资料待补充表述。",
    "资料待补充表述": "## 资料待补充\n\n客户案例、结果数据、价格口径或公开链接尚未确认时，本文统一标注为资料待补充，不写成已验证事实。",
    "案例采集模板": "## 案例采集模板\n\n请补充客户名称公开口径、问题背景、使用方案、可公开结果、截图或链接、授权范围、负责人确认记录。",
  };
  return {
    markdownContent: input.article.markdownContent.trim() + "\n\n" + appendices[input.mode] + "\n",
    versions: [...existingVersions, snapshot],
  };
}

/** 与同页前端 `buildAntiDuplicationResult` 对齐的轻量反同质化结论（服务端质检用）。 */
export type GeoArticleAntiDuplicationResult = {
  similarityRisk: "low" | "medium" | "high";
  similarArticleTitles: string[];
  titleRepeated: boolean;
  topicRepeated: boolean;
  structureRepeated: boolean;
  viewpointRepeated: boolean;
  sameTaskRepeated: boolean;
  sameWeekRepeated: boolean;
  differentiationAngle: string;
  rewriteSuggestion: string;
  blocked: boolean;
};

export type GeoArticleAntiDupArticle = {
  id: number;
  title: string;
  markdownContent: string;
  topicId: number;
  optimizationTaskId: number | null;
  articleType: string;
};

export type GeoArticleAntiDupTopic = { id: number; optimizationTaskId: number | null };

export type GeoArticleAntiDupPlan = { taskIds: number[]; weeklyCount: number };

function excerptMarkdownForAntiDup(value?: string | null) {
  if (!value) return "摘要待生成";
  const cleaned = value.replace(/^#+\s+/gm, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 180 ? `${cleaned.slice(0, 180)}...` : cleaned;
}

function titleTokensForAntiDup(value?: string | null) {
  if (!value) return [];
  return Array.from(new Set(value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, " ").split(/\s+/).flatMap(part => part.length > 8 ? [part.slice(0, 4), part.slice(4, 8)] : [part]).filter(part => part.length >= 2)));
}

function overlapRatioForAntiDup(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  return a.filter(item => bSet.has(item)).length / Math.max(a.length, b.length);
}

function headingSignatureForAntiDup(content?: string | null) {
  if (!content) return [];
  return content.split("\n").filter(line => /^#{1,3}\s+/.test(line)).map(line => line.replace(/^#{1,3}\s+/, "").trim()).slice(0, 12);
}

export function assessGeoArticleAntiDuplication(input: {
  article: GeoArticleAntiDupArticle;
  peers: GeoArticleAntiDupArticle[];
  topic?: GeoArticleAntiDupTopic | null;
  plan: GeoArticleAntiDupPlan;
}): GeoArticleAntiDuplicationResult {
  const { article, peers, topic, plan } = input;
  const currentTokens = titleTokensForAntiDup(article.title);
  const similarArticles = peers
    .map(item => ({ article: item, ratio: overlapRatioForAntiDup(currentTokens, titleTokensForAntiDup(item.title)) }))
    .filter(item => item.ratio >= 0.35 || (article.optimizationTaskId && item.article.optimizationTaskId === article.optimizationTaskId))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4)
    .map(item => item.article);
  const currentHeadings = headingSignatureForAntiDup(article.markdownContent);
  const structureRepeated = peers.some(item => overlapRatioForAntiDup(currentHeadings, headingSignatureForAntiDup(item.markdownContent)) >= 0.55);
  const titleRepeated = similarArticles.some(item => item.title.trim() === article.title.trim() || overlapRatioForAntiDup(currentTokens, titleTokensForAntiDup(item.title)) >= 0.55);
  const topicRepeated = Boolean(topic && peers.some(item => item.topicId === topic.id || (item.optimizationTaskId && item.optimizationTaskId === topic.optimizationTaskId && overlapRatioForAntiDup(currentTokens, titleTokensForAntiDup(item.title)) >= 0.35)));
  const sameTaskRepeated = Boolean(article.optimizationTaskId && peers.filter(item => item.optimizationTaskId === article.optimizationTaskId).length >= 2);
  const sameWeekRepeated = plan.taskIds.filter(id => id === article.optimizationTaskId).length > 1 || peers.filter(item => item.articleType === article.articleType).length >= Math.max(2, plan.weeklyCount);
  const viewpointRepeated = peers.some(item => overlapRatioForAntiDup(titleTokensForAntiDup(excerptMarkdownForAntiDup(article.markdownContent)), titleTokensForAntiDup(excerptMarkdownForAntiDup(item.markdownContent))) >= 0.45);
  const highSignals = [titleRepeated, topicRepeated, structureRepeated, viewpointRepeated, sameTaskRepeated, sameWeekRepeated].filter(Boolean).length;
  const similarityRisk = highSignals >= 3 ? "high" : highSignals >= 1 ? "medium" : "low";
  const differentiationAngle = similarityRisk === "high" ? "改用新的客户问题切入，增加企业资料证据、竞品比较维度和平台表达方式，避免继续覆盖同一任务下的相同观点。" : similarityRisk === "medium" ? "保留当前诊断缺口，但换成新的平台场景、FAQ 角度或案例证据展开。" : "当前文章和历史内容差异较清楚，可继续补强企业资料来源和 AI 可引用片段。";
  const rewriteSuggestion = similarityRisk === "high" ? "建议重写标题、摘要、FAQ 和核心观点，并减少与相似文章重复的段落结构。" : similarityRisk === "medium" ? "建议调整标题关键词、增加差异化小标题，并补充新的产品/服务/案例/对比信息。" : "建议进入人工复核，确认事实、案例、平台格式和品牌实体信息。";
  return {
    similarityRisk,
    similarArticleTitles: similarArticles.map(item => item.title),
    titleRepeated,
    topicRepeated,
    structureRepeated,
    viewpointRepeated,
    sameTaskRepeated,
    sameWeekRepeated,
    differentiationAngle,
    rewriteSuggestion,
    blocked: similarityRisk === "high",
  };
}

function isOnlyLowScoreQualityBlock(blockReasons: string[]): boolean {
  const min = GEO_ARTICLE_MIN_PASS_SCORE;
  const re = new RegExp(`内容质量分 \\d+ 低于 ${min}|低于 ${min} 分`);
  return blockReasons.length > 0 && blockReasons.every(r => re.test(r));
}

/** 是否应触发「质检后自动 LLM 换角重写」：重复风险高 / 阻断发布（非仅低分）。 */
export function shouldTriggerAutoQualityRewrite(quality: P11QualityScore, antiDup: GeoArticleAntiDuplicationResult): boolean {
  if (antiDup.similarityRisk === "high" || antiDup.blocked) return true;
  if (!quality.blocked) return false;
  return !isOnlyLowScoreQualityBlock(quality.blockReasons);
}

export function isGeoArticleQualityCheckPass(quality: P11QualityScore): boolean {
  return !quality.blocked && quality.totalScore >= GEO_ARTICLE_MIN_PASS_SCORE;
}

export async function rewriteGeoArticleMarkdownForQuality(input: {
  projectName: string;
  articleTitle: string;
  markdownContent: string;
  quality: P11QualityScore;
  antiDup: GeoArticleAntiDuplicationResult;
}): Promise<string> {
  const { projectName, articleTitle, markdownContent, quality, antiDup } = input;
  const userPayload = [
    `企业/项目：${projectName}`,
    `文章标题：${articleTitle}`,
    `当前正文（Markdown）：\n${markdownContent}`,
    `质检摘要：${quality.reviewSummary}`,
    `阻断原因：${quality.blockReasons.join("；") || "无"}`,
    `优化建议：${quality.optimizationSuggestions.join("；")}`,
    `反同质化：重复风险=${antiDup.similarityRisk}；相似历史标题=${antiDup.similarArticleTitles.join("、") || "无"}；差异化角度=${antiDup.differentiationAngle}；改写建议=${antiDup.rewriteSuggestion}`,
    "请全文重写 Markdown 正文：换新的切入角度与小标题脉络，减少与历史文章重复的段落结构；保留核心事实与合规要求（不虚构案例、不作排名保证、不攻击竞品），但换用不同表达方式；全文仍须为第三方行业/用户视角，禁止「XX公司如何回答」「XX公司面向…」等企业自述句式；保留 GEO 常用二级标题结构（如引言、核心问题、对比、FAQ、结论等），不要输出除 JSON 外的其他文字。",
  ].join("\n\n");
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "你是资深行业内容编辑，擅长 GEO 场景下去重与换角度重写。重写后须保持第三方观察或选购参考视角，禁止「XX公司如何回答」「XX公司面向…」等企业自述句式；只输出符合 JSON Schema 的单个 JSON 对象。",
      },
      { role: "user", content: userPayload },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_article_rewrite",
        strict: true,
        schema: {
          type: "object",
          properties: {
            markdownContent: { type: "string" },
          },
          required: ["markdownContent"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = response.choices[0]?.message.content;
  const parsed = parseLlmJsonObject<{ markdownContent: string }>(raw);
  const next = typeof parsed.markdownContent === "string" ? parsed.markdownContent.trim() : "";
  if (!next) throw new Error("AI 未返回有效正文");
  return next;
}

/** V12 目标客户问题生成：供 LLM user prompt 插值（与旧 `projects` 字段解耦，由路由合并档案）。 */
export type GeoTargetQuestionPromptPack = {
  brandName: string;
  industryTag: string;
  productDesc: string;
  targetCustomer: string;
  customerPains: string;
  competitors: string;
  keyPoints: string;
  /** 重新生成时传入已有问题，要求 LLM 换角度且不重复 */
  excludeQuestions?: string[];
};

export const GEO_TARGET_QUESTION_INTENTS = [
  "痛点问题",
  "选型问题",
  "竞品对比",
  "价格与ROI",
  "落地执行",
  "风险顾虑",
] as const;

export type GeoTargetQuestionIntent = (typeof GEO_TARGET_QUESTION_INTENTS)[number];

export type GeneratedGeoTargetQuestionRow = {
  questionText: string;
  questionType: "指定问题";
  intent: string;
  disadvantaged: boolean;
};

const GEO_TARGET_QUESTIONS_SYSTEM_PROMPT = `你是一位深度理解 B2B / 知识付费客户的内容策略专家。
你的任务是生成「目标客户在 AI 搜索或对话中会真实提出的检索问题」。

生成规则：
1. 问题必须是客户视角，从痛点、选型、顾虑出发，不要写成品牌广告语
2. 每条问题要有具体场景或决策阶段，避免空泛套话
3. 不要重复「历史已有问题」列表中的任何一条（含同义改写、仅换一两个词）
4. 换不同表达角度：可从「发现痛点 → 选型对比 → 预算 ROI → 落地执行 → 风险顾虑」覆盖
5. 问题类型须覆盖以下 6 类，每类至少 1 条，intent 字段从下列枚举中选一：
   - 痛点问题：经营/业务卡点、想找到根因
   - 选型问题：怎么选方案、选什么类型产品
   - 竞品对比：客户在对比不同路线或供应商（不出现具体竞品品牌名）
   - 价格与ROI：预算、投入产出、是否值得买
   - 落地执行：实施步骤、周期、团队如何推进
   - 风险顾虑：踩坑、失败案例、合规与效果不确定性
6. 禁止生成「XX品牌 vs XX品牌哪个好」这类带具体品牌名的对比句
7. 禁止生成「XX平台怎么样」这类平台评测问题
8. 生成 8-10 条；若提供了历史问题，须与历史明显不同
9. 劣势题：保留 2-3 条 disadvantaged 为 true 的问题（该企业内容覆盖不足的检索场景）

只输出符合 JSON Schema 的单个 JSON 对象，不要输出其它文字。`;

/**
 * 基于企业档案调用 LLM，生成 8–10 条目标客户真实检索问题；
 * 由路由层写入 `questions`（source: ai_generated, questionType: 指定问题），并在 `targetKeyword` 存 JSON：`{ intent, disadvantaged }`。
 */
export type GenerateTargetQuestionsResult = {
  rows: GeneratedGeoTargetQuestionRow[];
  /** LLM 解析后、相对历史去重前条数 */
  llmParsedCount: number;
  /** 相对历史 + 批内去重过滤条数 */
  filteredCount: number;
};

export async function generateTargetQuestions(input: GeoTargetQuestionPromptPack): Promise<GenerateTargetQuestionsResult> {
  const exclude = (input.excludeQuestions ?? []).map(t => t.trim()).filter(Boolean);
  const userContent = [
    "企业信息：",
    `- 品牌名称：${input.brandName}`,
    `- 行业定位：${input.industryTag}`,
    `- 核心产品：${input.productDesc}`,
    `- 目标客户：${input.targetCustomer}`,
    `- 客户核心痛点：${input.customerPains}`,
    `- 核心卖点：${input.keyPoints}`,
    "",
    ...(exclude.length > 0
      ? [
          "历史已有问题（禁止重复或高度相似，请换角度、换决策阶段、换问题类型）：",
          ...exclude.map((q, i) => `${i + 1}. ${q}`),
          "",
        ]
      : []),
    "请生成8-10条目标客户真实搜索问题：",
    "1. 每条问题控制在 40 字以内，表述完整",
    "2. 问题必须是客户自己会说的话，不能出现本企业品牌名",
    "3. 必须有 2-3 条 disadvantaged 为 true 的劣势场景问题",
    "4. 禁止出现具体竞品品牌名",
    `5. intent 从以下六选一：${GEO_TARGET_QUESTION_INTENTS.join("、")}`,
    "6. 不要与历史已有问题重复；覆盖不同客户决策阶段",
    "",
    "将上述数组放在根对象的 `questions` 字段中输出（仅此一个根对象）。",
  ].join("\n");

  const response = await invokeLLM({
    max_tokens: 4096,
    timeout_ms: 120000,
    messages: [
      { role: "system", content: GEO_TARGET_QUESTIONS_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "geo_target_customer_questions_v12",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              minItems: 8,
              maxItems: 10,
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  intent: { type: "string", enum: [...GEO_TARGET_QUESTION_INTENTS] },
                  disadvantaged: { type: "boolean" },
                },
                required: ["question", "intent", "disadvantaged"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = response.choices[0]?.message.content;
  const parsed = parseLlmJsonObject<{ questions: Array<{ question: string; intent: string; disadvantaged: boolean }> }>(raw);
  const list = Array.isArray(parsed.questions) ? parsed.questions : [];
  const rows: GeneratedGeoTargetQuestionRow[] = [];
  const seen = new Set<string>();
  const allowedIntent = new Set<string>(GEO_TARGET_QUESTION_INTENTS);
  const legacyIntentMap: Record<string, GeoTargetQuestionIntent> = {
    痛点诊断: "痛点问题",
    路径探索: "落地执行",
    工具选择: "选型问题",
  };
  for (const item of list) {
    const questionText = typeof item.question === "string" ? item.question.trim() : "";
    const intentRaw = typeof item.intent === "string" ? item.intent.trim() : "";
    const intent =
      (allowedIntent.has(intentRaw) ? intentRaw : legacyIntentMap[intentRaw]) as GeoTargetQuestionIntent | "" || "";
    const disadvantaged = item.disadvantaged === true;
    if (!questionText || questionText.length > 80) continue;
    if (!intent) continue;
    if (seen.has(questionText)) continue;
    seen.add(questionText);
    rows.push({ questionText, questionType: "指定问题", intent, disadvantaged });
  }
  const llmParsedCount = rows.length;
  const { kept, filteredCount: batchFiltered } = dedupeTargetQuestionRows(rows, exclude);
  const finalRows = kept.slice(0, 10);
  if (finalRows.length === 0) {
    throw new Error(
      exclude.length > 0
        ? "生成结果与历史问题重复过多，请稍后重试"
        : "AI 返回的有效问题为空，请重试",
    );
  }
  if (exclude.length === 0) {
    if (finalRows.length < 8) throw new Error("AI 返回的有效问题不足 8 条，请重试");
    const disadvantagedCount = finalRows.filter(r => r.disadvantaged).length;
    if (disadvantagedCount < 2) throw new Error("AI 返回的劣势场景问题不足 2 条，请重试");
  } else if (batchFiltered > 0 && finalRows.length < 3) {
    throw new Error("去重后新问题过少，请稍后重试");
  }
  return { rows: finalRows, llmParsedCount, filteredCount: batchFiltered };
}

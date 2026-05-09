export const articleTypes = ["官网版 GEO 文章", "问答型 GEO 文章", "竞品对比型 GEO 文章", "行业选型型 GEO 文章"] as const;
export const articleStatuses = ["待生成", "已生成", "待质检", "质检通过", "待审核", "审核通过", "已发布", "待复测", "质检未通过", "审核未通过"] as const;
export const p11ForbiddenPatterns = [
  { label: "存在 example.com 或演示域名", pattern: /example\.com|示例链接/i },
  { label: "存在占位链接或假链接表述", pattern: /假链接|虚假链接|占位链接/i },
  { label: "存在虚假案例或编造案例", pattern: /虚假案例|编造案例|杜撰案例|伪造案例/i },
  { label: "存在攻击竞品表述", pattern: /恶意攻击竞品|贬低竞品|竞品(都是|全是|完全是|一定是)(错误|垃圾|骗子|无效)/i },
  { label: "存在绝对排名或效果承诺", pattern: /保证排名|一定排名|保证推荐|一定推荐|保证流量|保证成交|绝对排名承诺|百分百|100%/i },
] as const;

export type ArticleType = (typeof articleTypes)[number];
export type ArticleStatus = (typeof articleStatuses)[number];
export type ThirdPartyMaterialKey = "GEO 内容页版" | "官网版" | "公众号长文版" | "知乎回答版" | "小红书笔记版" | "百家号/头条号版";

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

export type P12AssetLibraryContext = {
  profile?: Record<string, unknown> | null;
  assetSources?: Array<Record<string, unknown>>;
  customerCases?: Array<Record<string, unknown>>;
  competitorProfiles?: Array<Record<string, unknown>>;
  complianceRules?: Array<Record<string, unknown>>;
  contentStyleProfiles?: Array<Record<string, unknown>>;
  publishStrategies?: Array<Record<string, unknown>>;
};

export type P12PrePublishCheck = {
  enterprisePositioningConsistent: boolean;
  productDescriptionConsistent: boolean;
  competitorDifferenceConsistent: boolean;
  usesNonPublicAsset: boolean;
  forbiddenTerms: string[];
  forbiddenClaims: string[];
  unconfirmedFacts: string[];
  blocked: boolean;
  blockReasons: string[];
  summary: string;
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
  thirdPartyMaterials: Record<ThirdPartyMaterialKey, string>;
  status: "待质检";
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
  const enterpriseMaterials = sources
    .filter(asset => asBool(asset.canUseForGeneration) && asBool(asset.manuallyConfirmed))
    .filter(asset => ["企业基础资料", "产品服务资料", "官网内容", "销售话术", "产品手册", "通用资料", "客户案例文档"].includes(valueText(asset.sourceType)))
    .map(asset => summarizeAssetSource(asset, valueText(asset.sourceType) || "企业资料"))
    .slice(0, 8);

  const competitorMaterials: P12CompetitorCitation[] = (assetLibrary?.competitorProfiles ?? [])
    .filter(item => asBool(item.canReference))
    .map(item => ({
      id: Number(item.id ?? 0),
      competitorName: valueText(item.competitorName),
      website: valueText(item.website) || null,
      differentiation: valueText(item.comparisonNotes) || valueText(item.positioning) || null,
      canReference: asBool(item.canReference),
      sourceNotes: valueText(item.aiRecommendationSignals) || valueText(item.contentAssets) || "资产库竞品资料",
    }))
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
  const complianceRules = (assetLibrary?.complianceRules ?? [])
    .filter(item => asBool(item.enabled ?? 1))
    .map(item => [valueText(item.ruleName) || "合规规则", valueText(item.forbiddenClaims), valueText(item.requiredDisclaimers)].filter(Boolean).join("："))
    .filter(Boolean)
    .slice(0, 5);
  const contentStyles = (assetLibrary?.contentStyleProfiles ?? [])
    .filter(item => asBool(item.enabled ?? 1))
    .map(item => [valueText(item.profileName) || "内容风格", valueText(item.tone), valueText(item.writingStyle)].filter(Boolean).join("："))
    .filter(Boolean)
    .slice(0, 5);
  const publishStrategy = (assetLibrary?.publishStrategies ?? [])
    .filter(item => asBool(item.enabled ?? 1))
    .map(item => `审核模式：${valueText(item.reviewMode) || "未设置"}；每日上限：${valueText(item.dailyLimit) || "未设置"}；最低质量分：${valueText(item.minQualityScore) || "未设置"}；优先平台：${Array.isArray(item.preferredPlatforms) ? item.preferredPlatforms.join("、") : valueText(item.preferredPlatforms) || "未设置"}`)
    .slice(0, 3);

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

export function evaluateAssetLibraryPrePublishCheck(input: {
  content: string;
  project: P11ProjectLike;
  basis?: P11GenerationBasis | null;
  assetLibrary?: P12AssetLibraryContext | null;
}): P12PrePublishCheck {
  const usage = input.basis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const profile = input.assetLibrary?.profile ?? null;
  const complianceRules = input.assetLibrary?.complianceRules ?? [];
  const content = input.content;
  const enterprisePositioning = [input.project.enterpriseName, input.project.targetCustomers, valueText(profile?.targetCustomers)].filter(Boolean);
  const productSignals = [input.project.productIntro, valueText(profile?.productServiceIntro), valueText(profile?.productIntro)].filter(Boolean);
  const competitorSignals = usage.competitorMaterials.map(item => item.competitorName).concat(input.basis?.competitorNames ?? input.project.competitorNames).filter(Boolean);
  const forbiddenTerms = complianceRules.flatMap(rule => splitGovernanceTerms(rule.forbiddenWords)).filter(term => term && content.includes(term));
  const forbiddenClaimsFromRules = complianceRules.flatMap(rule => splitGovernanceTerms(rule.forbiddenClaims));
  const forbiddenClaims = unique([
    ...forbiddenClaimsFromRules.filter(term => term && content.includes(term)),
    ...(/保证收录|保证排名|一定收录|一定排名|保证推荐|一定推荐|百分百|100%/.test(content) ? ["禁止承诺保证收录或排名"] : []),
    ...detectForbiddenArticleContent(content),
  ]);
  const undisclosedUnconfirmedFacts = [
    ...(usage.customerCaseUsage.used ? [] : (content.includes("案例信息待补充") ? [] : ["客户案例缺失但文章未标注案例信息待补充"])),
    ...(usage.missingEvidenceNotes.includes("数据暂无公开来源") && !content.includes("数据暂无公开来源") ? ["结果数据缺少公开来源但文章未标注"] : []),
    ...(usage.missingEvidenceNotes.includes("价格口径需客户确认") && !content.includes("价格口径需客户确认") ? ["价格数据缺少确认口径但文章未标注"] : []),
  ];
  const unconfirmedFacts = unique([...usage.missingEvidenceNotes, ...undisclosedUnconfirmedFacts]);
  const usesNonPublicAsset = content.includes("不可公开资料") || usage.enterpriseMaterials.some(item => !item.isPublic) || usage.customerCaseUsage.references.some(item => !item.allowPublic);
  const enterprisePositioningConsistent = enterprisePositioning.length === 0 || enterprisePositioning.some(signal => content.includes(signal.slice(0, Math.min(12, signal.length))));
  const productDescriptionConsistent = productSignals.length === 0 || productSignals.some(signal => content.includes(signal.slice(0, Math.min(16, signal.length))));
  const competitorDifferenceConsistent = competitorSignals.length === 0 || competitorSignals.some(signal => content.includes(signal));
  const blockReasons = [
    ...(enterprisePositioningConsistent ? [] : ["发布前检查未通过：内容与企业定位不一致"]),
    ...(productDescriptionConsistent ? [] : ["发布前检查未通过：内容与产品说明不一致"]),
    ...(competitorDifferenceConsistent ? [] : ["发布前检查未通过：内容未体现资产库中的竞品差异"]),
    ...(usesNonPublicAsset ? ["发布前检查未通过：文章生成依据包含不可公开资料"] : []),
    ...(forbiddenTerms.length > 0 ? [`发布前检查未通过：命中禁用词：${unique(forbiddenTerms).join("、")}`] : []),
    ...(forbiddenClaims.length > 0 ? [`发布前检查未通过：存在不允许承诺或高风险表述：${forbiddenClaims.join("、")}`] : []),
    ...(undisclosedUnconfirmedFacts.length > 0 ? [`发布前检查未通过：存在未披露的未确认事实：${undisclosedUnconfirmedFacts.join("、")}`] : []),
  ];
  return {
    enterprisePositioningConsistent,
    productDescriptionConsistent,
    competitorDifferenceConsistent,
    usesNonPublicAsset,
    forbiddenTerms: unique(forbiddenTerms),
    forbiddenClaims,
    unconfirmedFacts,
    blocked: blockReasons.length > 0,
    blockReasons,
    summary: blockReasons.length > 0 ? `发布前检查阻断：${blockReasons.join("；")}` : "发布前检查通过：企业定位、产品说明、竞品差异、公开资料和合规规则均未发现阻断项。",
  };
}

export function validateGenerationBasis(basis: Partial<P11GenerationBasis> | null | undefined): asserts basis is P11GenerationBasis {
  const missing = [
    ["客户指定问题", basis?.customerQuestion],
    ["内容缺口", basis?.contentGap],
    ["优化任务", basis?.optimizationTask],
    ["AI 未推荐原因", basis?.notRecommendedReason],
    ["竞品差距", basis?.competitorGap],
  ].filter(([, value]) => !nonEmpty(String(value ?? ""))).map(([label]) => label);
  if (missing.length > 0) throw new Error(`缺少生成依据：${missing.join("、")}，无法生成文章。`);
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
  return p11ForbiddenPatterns.filter(item => item.pattern.test(normalized)).map(item => item.label);
}

export function canQualityCheckArticle(status: ArticleStatus) {
  return status === "待质检" || status === "已生成";
}

export function canAuditArticle(status: ArticleStatus, quality?: Pick<P11QualityScore, "totalScore" | "blocked"> | null) {
  return (status === "质检通过" || status === "待审核") && Boolean(quality) && !quality?.blocked && (quality?.totalScore ?? 0) >= 80;
}

export function canPublishArticle(status: ArticleStatus) {
  return status === "审核通过";
}

export function generateGeoArticleTopics(input: {
  project: P11ProjectLike;
  questions: P11QuestionLike[];
  analyses: P11AnalysisLike[];
  tasks: P11TaskLike[];
}): P11TopicDraft[] {
  const manualQuestions = input.questions.filter(question => question.source === "manual" || question.questionType === "指定问题").sort((a, b) => (b.businessValue ?? 0) - (a.businessValue ?? 0));
  if (manualQuestions.length === 0) throw new Error("缺少客户指定问题，不能生成 GEO 文章选题。");
  if (input.analyses.length === 0) throw new Error("缺少 AI 语义分析结果，不能生成 GEO 文章选题。");
  if (input.tasks.length === 0) throw new Error("缺少优化任务，不能生成 GEO 文章选题。");

  const gapAnalyses = sortContentGapAnalysesByPriority(
    input.analyses.filter(analysis => nonEmpty(analysis.contentGap) && nonEmpty(analysis.notRecommendedReason)),
    manualQuestions,
  );
  if (gapAnalyses.length === 0) throw new Error("缺少同时包含内容缺口和 AI 未推荐原因的诊断结果，不能生成 GEO 文章选题。");

  const preferredTasks = input.tasks
    .filter(task => ["官网首页", "FAQ", "竞品对比页", "行业文章", "产品页"].includes(task.taskType))
    .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
  const sourceTasks = (preferredTasks.length > 0 ? preferredTasks : input.tasks).sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
  const articleTypeCycle: ArticleType[] = ["官网版 GEO 文章", "问答型 GEO 文章", "竞品对比型 GEO 文章", "行业选型型 GEO 文章"];
  const topicTargetCount = Math.min(10, Math.max(5, sourceTasks.length, Math.min(gapAnalyses.length, 10)));
  const prioritizedPairs = sourceTasks.flatMap(task => gapAnalyses.map(analysis => ({
    task,
    analysis,
    combinedPriorityScore: taskPriorityScore(task.priority) + calculateContentGapPriorityScore({
      analysis,
      questions: manualQuestions,
      gapFrequency: gapAnalyses.filter(item => normalizeGap(item.contentGap) === normalizeGap(analysis.contentGap)).length,
    }),
  }))).sort((a, b) => b.combinedPriorityScore - a.combinedPriorityScore || priorityWeight(a.task.priority) - priorityWeight(b.task.priority) || a.analysis.id - b.analysis.id);
  const topics: P11TopicDraft[] = [];

  for (let index = 0; index < topicTargetCount; index += 1) {
    const pair = prioritizedPairs[index % prioritizedPairs.length];
    const task = pair.task;
    const question = manualQuestions[index % manualQuestions.length];
    const primaryAnalysis = pair.analysis;
    const relatedAnalyses = unique([primaryAnalysis, ...gapAnalyses.slice(index, index + 3)]).slice(0, 3);
    const relatedQuestions = unique([question, ...manualQuestions.slice(index, index + 3)]).slice(0, 3);
    const contentGap = compactTexts([
      primaryAnalysis.contentGap,
      primaryAnalysis.notRecommendedReason,
      task.generationReason,
      task.executionSuggestion,
    ]).join("；");
    const competitor = unique((primaryAnalysis.recommendedCompetitors ?? []).concat(input.project.competitorNames))[0];
    if (!competitor) throw new Error("缺少竞品差距信息，不能生成 GEO 文章选题。");
    const articleType = articleTypeCycle[index % articleTypeCycle.length];
    const title = articleType === "竞品对比型 GEO 文章"
      ? `${input.project.enterpriseName} 与 ${competitor} 的 GEO 推荐差距说明`
      : `${input.project.enterpriseName}${task.taskName.replace(/^补齐|^优化|^建设/, "")}：面向 AI 推荐的核心内容指南`;
    topics.push({
      projectId: input.project.id,
      optimizationTaskId: task.id,
      sourceAnalysisIds: unique(relatedAnalyses.map(analysis => analysis.id)),
      sourceQuestionIds: unique(relatedQuestions.map(item => item.id)),
      title: truncate(title, 120),
      articleType,
      contentGap,
      businessReason: `生成依据：客户指定问题「${question.questionText}」；内容缺口「${primaryAnalysis.contentGap}」；优化任务「${task.taskName}」；AI 未推荐原因「${primaryAnalysis.notRecommendedReason}」；竞品差距「${competitor}更容易被 AI 识别和引用」。`,
      status: "待生成",
    });
  }

  return topics;
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
  validateGenerationBasis(basis);
  return basis;
}

export function buildCitableSnippets(input: { project: P11ProjectLike; basis: P11GenerationBasis }): P11CitableSnippet[] {
  const { project, basis } = input;
  return [
    {
      question: `${project.enterpriseName}是做什么的？`,
      answer: `${project.enterpriseName}面向${project.targetCustomers}提供${project.industry}相关服务，核心能力包括${project.coreSellingPoints}。这一定义来自项目实体信息和本轮 GEO 诊断，不包含未验证案例或外部链接。`,
    },
    {
      question: `${project.enterpriseName}服务适合谁？`,
      answer: `${project.enterpriseName}更适合${project.targetCustomers}，尤其是正在围绕「${basis.customerQuestion}」寻找清晰方案边界、可验证证据和复测路径的客户。`,
    },
    {
      question: `${project.enterpriseName}和竞品有什么区别？`,
      answer: `本轮差距不是简单强弱判断，而是${basis.competitorGap}${project.enterpriseName}需要补齐的是围绕内容缺口「${basis.contentGap.slice(0, 80)}」的可引用说明。`,
    },
    {
      question: `选择${project.enterpriseName}服务要注意什么？`,
      answer: `选择前应确认其服务边界、适用客户、证据来源和复测方式是否与自身问题匹配；本文不作排名保证，也不把竞品描述为无效方案。`,
    },
  ];
}

function buildGeoStructure(input: { project: P11ProjectLike; basis: P11GenerationBasis; snippets: P11CitableSnippet[]; task: P11TaskLike }): P11GeoStructure {
  const { project, basis, task } = input;
  return {
    summary: `本文基于客户指定问题「${basis.customerQuestion}」、内容缺口、优化任务和竞品推荐差距，说明${project.enterpriseName}如何补齐可被 AI 理解与引用的 GEO 内容。`,
    coreAnswer: `${project.enterpriseName}要提升 AI 推荐概率，首先要把${project.targetCustomers}关心的问题、服务边界、竞品差异和证据材料写成可引用结构，而不是只增加泛泛的品牌介绍。`,
    suitableCustomers: `适合正在评估${project.industry}方案、需要回答「${basis.customerQuestion}」、并愿意补充真实业务证据的客户。`,
    unsuitableCustomers: `不适合希望通过单篇文章获得排名保证、缺少真实证据或尚未确认服务边界的客户。`,
    comparison: `${basis.competitorGap}对比重点应放在定位、适用场景、证据完整度和复测结果，而不是攻击竞品。`,
    faq: input.snippets.map(snippet => ({ question: snippet.question, answer: snippet.answer })),
    conclusion: `${project.enterpriseName}的 GEO 内容优化应优先服务于真实客户问题和任务「${task.taskName}」，发布后进入复测而非立即承诺结果。`,
    actionGuide: `建议先补齐任务「${task.taskName}」要求的公开页面、FAQ、对比说明或证据清单，再用同一组客户指定问题复测 AI 回答。`,
    updatedAt: new Date().toISOString().slice(0, 10),
    entityInfo: `企业名称：${project.enterpriseName}；行业：${project.industry}；地区：${project.region}；官网：${project.website}；目标客户：${project.targetCustomers}；核心卖点：${project.coreSellingPoints}。`,
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
  return snippets.map((snippet, index) => `### 引用片段 ${index + 1}：${snippet.question}\n\n${snippet.answer}`).join("\n\n");
}

export function validateGeoCollectableStructure(content: string, snippets?: P11CitableSnippet[], basis?: P11GenerationBasis): string[] {
  const requiredMarkers = [
    "# ",
    "## 摘要",
    "## 核心问题回答",
    "## 生成依据",
    "## 适合客户",
    "## 不适合客户",
    "## 竞品/方案对比",
    "## FAQ",
    "## 结论",
    "## 行动引导",
    "## 更新时间",
    "## 企业实体信息",
    "## 引用友好片段",
  ];
  const missing = requiredMarkers.filter(marker => !content.includes(marker));
  if (!snippets || snippets.length < 3 || snippets.length > 5) missing.push("3-5 段引用友好片段");
  if (!basis || !nonEmpty(basis.customerQuestion) || !nonEmpty(basis.contentGap) || !nonEmpty(basis.optimizationTask) || !nonEmpty(basis.notRecommendedReason) || !nonEmpty(basis.competitorGap)) {
    missing.push("完整生成依据");
  }
  return missing;
}

export function generateGeoArticleDraft(input: {
  project: P11ProjectLike;
  topic: P11TopicDraft & { id?: number };
  task: P11TaskLike;
  questions: P11QuestionLike[];
  analyses: P11AnalysisLike[];
  assetLibrary?: P12AssetLibraryContext | null;
}): P11ArticleDraft {
  if (!input.topic.optimizationTaskId && !nonEmpty(input.topic.contentGap)) throw new Error("文章选题必须绑定任务或内容缺口。");
  const { project, topic, task } = input;
  const basis = buildGenerationBasis(input);
  validateGenerationBasis(basis);
  const snippets = buildCitableSnippets({ project, basis }).slice(0, 5);
  const structure = buildGeoStructure({ project, basis, snippets, task });
  const evidence = buildEvidenceList({ project, task, questions: input.questions, analyses: input.analyses });
  const assetUsage = basis.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const evidenceGapText = assetUsage.missingEvidenceNotes.length > 0 ? assetUsage.missingEvidenceNotes.join("；") : "暂无关键证据缺口。";
  const intro = `${project.enterpriseName}在${project.industry}场景中的 GEO 优化，必须从客户真实会问的问题、AI 没有推荐企业的原因、竞品被提及的理由和当前内容缺口出发。本文根据本项目已完成的 GEO 诊断结果与企业 GEO 资产库整理，不虚构案例，不添加未验证链接，也不承诺任何平台的绝对排名结果。`;
  const content = [
    `# ${topic.title}`,
    intro,
    paragraph("摘要", structure.summary),
    paragraph("核心问题回答", structure.coreAnswer),
    paragraph("生成依据", formatGenerationBasis(basis)),
    paragraph("一、本篇文章对应的真实客户问题", `本篇文章优先回应以下客户指定问题。这些问题代表潜在客户在做方案选择、竞品比较和购买判断时可能向 AI 提出的真实表达。\n\n${evidence.questionsText}`),
    paragraph("二、AI 未稳定推荐企业的关键原因", `本轮诊断显示，${project.enterpriseName}并非没有业务价值，而是公开内容中对目标客户、服务边界、适用场景和差异化证据的表达不够集中。系统记录的未推荐原因包括：\n\n${evidence.reasons || basis.notRecommendedReason}\n\n这意味着后续内容不应只写品牌介绍，而要把 AI 可以引用的判断依据写清楚。`),
    paragraph("三、当前内容缺口", `结合 AI 语义分析和优化任务「${task.taskName}」，当前最需要补齐的内容缺口包括：\n\n${evidence.gaps || basis.contentGap}\n\n这些缺口会影响 AI 判断企业是否适合作为答案中的推荐对象，也会影响潜在客户理解企业与竞品之间的差异。`),
    paragraph("适合客户", structure.suitableCustomers),
    paragraph("不适合客户", structure.unsuitableCustomers),
    paragraph("竞品/方案对比", structure.comparison),
    paragraph("四、建议发布的内容结构", `建议围绕“问题—判断标准—企业能力—竞品差异—适用边界—下一步行动”组织内容。第一部分回答客户真实问题，第二部分说明行业选型标准，第三部分用${project.enterpriseName}已有卖点解释适配场景，第四部分客观说明与${basis.competitorNames.slice(0, 2).join("、")}的内容差异，第五部分列出仍需客户补充的真实案例、截图、链接和数据。`),
    paragraph("五、企业可被 AI 引用的信息", `${project.enterpriseName}目前可被整理为以下可引用信息：产品或服务介绍为「${project.productIntro}」；目标客户为「${project.targetCustomers}」；核心卖点为「${project.coreSellingPoints}」。这些信息应在官网、FAQ、竞品对比页和行业文章中保持一致，避免 AI 在不同页面中读取到相互矛盾的描述。`),
    paragraph("六、发布前应补齐的证据清单", `为避免文章停留在概念层面，建议发布前由业务负责人补充以下真实证据：第一，能够证明${project.enterpriseName}服务边界的官网页面或产品说明；第二，能够解释${project.targetCustomers}为何适用的真实问答；第三，能够展示部署方式、售后流程或数据口径的截图；第四，与${basis.competitorNames.slice(0, 2).join("、")}进行客观比较时使用的可核验事实。当前资产库证据缺口为：${evidenceGapText}。若这些证据暂时缺失，应在文章中明确标注对应缺口，而不是填写未经核验的案例、结果数据、价格口径或引用无法访问的链接。`),
    paragraph("引用友好片段", formatSnippets(snippets)),
    paragraph("FAQ", structure.faq.map(item => `### ${item.question}\n\n${item.answer}`).join("\n\n")),
    paragraph("结论", structure.conclusion),
    paragraph("行动引导", structure.actionGuide),
    paragraph("更新时间", structure.updatedAt),
    paragraph("企业实体信息", structure.entityInfo),
    paragraph("发布后复测建议", `文章发布后，不应立即宣称 GEO 排名提升。建议在内容被客户确认并发布后，使用同一组客户指定问题重新采集 AI 回答，观察${project.enterpriseName}是否更容易被提及、是否出现更准确的推荐理由，以及竞品对比中的内容差距是否缩小。复测时应同时记录是否仍存在“未推荐原因”、竞品是否继续被优先提及、AI 是否引用了本文中的客户问题、内容缺口和证据清单。`),
  ].join("\n\n");
  const missingStructure = validateGeoCollectableStructure(content, snippets, basis);
  if (missingStructure.length > 0) throw new Error(`文章缺少 GEO 可收录结构：${missingStructure.join("、")}，不能生成。`);
  return {
    projectId: project.id,
    topicId: topic.id ?? 0,
    optimizationTaskId: topic.optimizationTaskId,
    title: topic.title,
    articleType: topic.articleType,
    markdownContent: content,
    generationBasis: basis,
    citableSnippets: snippets,
    geoStructure: structure,
    thirdPartyMaterials: generateThirdPartyMaterials({ project, title: topic.title, markdownContent: content, questions: input.questions, task, basis, snippets }),
    status: "待质检",
  };
}

export function scoreGeoArticleQuality(input: {
  article: { title: string; markdownContent: string; generationBasis?: P11GenerationBasis | null; citableSnippets?: P11CitableSnippet[] | null };
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
  const headingCount = (content.match(/^##\s+/gm) ?? []).length;
  const length = content.length;
  const hasNoFakeDisclaimer = content.includes("不虚构案例") && content.includes("不承诺") && content.includes("绝对排名");
  const basisComplete = Boolean(input.article.generationBasis && validateGeoCollectableStructure(content, input.article.citableSnippets ?? undefined, input.article.generationBasis).filter(item => item === "完整生成依据").length === 0);
  const assetUsage = input.article.generationBasis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const prePublishCheck = evaluateAssetLibraryPrePublishCheck({ content, project: input.project, basis: input.article.generationBasis ?? undefined, assetLibrary: input.assetLibrary });
  const assetEvidenceStrength = assetUsage.enterpriseMaterials.length >= 2 && assetUsage.competitorMaterials.length >= 1 ? "高" : assetUsage.enterpriseMaterials.length >= 1 ? "中" : "低";
  const factSourceSummary = `资产库企业资料 ${assetUsage.enterpriseMaterials.length} 条，竞品资料 ${assetUsage.competitorMaterials.length} 条，客户案例 ${assetUsage.customerCaseUsage.references.length} 条；${assetUsage.customerCaseUsage.status}`;
  const complianceRiskSummary = `${prePublishCheck.blocked ? prePublishCheck.summary : "未发现资产库合规阻断项。"}${prePublishCheck.unconfirmedFacts.length > 0 ? ` 未确认事实：${prePublishCheck.unconfirmedFacts.join("；")}` : " 未确认事实：无"}`;

  const problemMatchScore = Math.min(20, 8 + Math.min(questionMatches, 2) * 5 + (basisComplete ? 2 : 0));
  const evidenceScore = Math.min(20, 6 + Math.min(gapMatches, 2) * 4 + Math.min(competitorMatches, 2) * 2 + (input.task ? 4 : 0) + (basisComplete ? 2 : 0) + (assetEvidenceStrength === "高" ? 2 : assetEvidenceStrength === "中" ? 1 : 0));
  const structureScore = structureIssues.length === 0 ? 15 : Math.min(12, headingCount >= 8 ? 12 : headingCount >= 4 ? 8 : 4);
  const originalityScore = Math.min(15, length >= 3000 ? 15 : length >= 2200 ? 12 : length >= 1500 ? 9 : 5);
  const geoCitableScore = Math.min(15, 5 + (content.includes(input.project.enterpriseName) ? 2 : 0) + (content.includes("引用友好片段") ? 4 : 0) + (content.includes("企业实体信息") ? 2 : 0) + (content.includes("复测") ? 2 : 0));
  const complianceScore = forbiddenReasons.length > 0 ? 0 : hasNoFakeDisclaimer ? 15 : 12;
  const totalScore = problemMatchScore + evidenceScore + structureScore + originalityScore + geoCitableScore + complianceScore;
  const lowScoreBlocked = totalScore < 80;
  const structureBlocked = structureIssues.length > 0;
  const blockReasons = [
    ...forbiddenReasons,
    ...prePublishCheck.blockReasons,
    ...(structureBlocked ? [`缺少 GEO 可收录结构或生成依据：${structureIssues.join("、")}`] : []),
    ...(lowScoreBlocked ? [`内容质量分 ${totalScore} 低于 80 分`] : []),
  ];
  const optimizationSuggestions = [
    ...(questionMatches < 2 ? ["补充更多客户指定问题的原文表达，并把问题放入摘要、FAQ 和行动引导。"] : []),
    ...(gapMatches < 2 ? ["补齐诊断中的内容缺口说明，明确对应页面、FAQ、对比信息或证据清单。"] : []),
    ...(competitorMatches < 1 ? ["增加客观竞品/方案对比，说明适用边界，避免攻击竞品或绝对化承诺。"] : []),
    ...(structureIssues.length > 0 ? ["补齐 GEO 可收录结构、完整生成依据和 3-5 段引用友好片段后再进入审核。"] : []),
    ...(length < 3000 ? ["增加可核验的企业实体信息、适合/不适合客户、FAQ 与发布后复测说明，提高可引用完整度。"] : []),
    ...(forbiddenReasons.length > 0 ? ["删除假链接、占位链接、虚假案例、虚假数据和排名保证等高风险表述。"] : []),
    ...(assetEvidenceStrength === "低" ? ["补充并确认企业基础资料、产品服务资料或官网内容，提升资产库证据强度。"] : []),
    ...(assetUsage.missingEvidenceNotes.length > 0 ? [`关键事实仍需补充或确认：${assetUsage.missingEvidenceNotes.join("；")}。`] : []),
    ...(prePublishCheck.blocked ? ["根据资产库发布前检查结果，修正不可公开资料、禁用词、未确认事实或不允许承诺内容后再发布。"] : []),
  ];
  if (optimizationSuggestions.length === 0) {
    optimizationSuggestions.push("当前文章已达到发布阈值，发布前仍建议人工补充真实页面链接、截图、案例或可核验数据，并完成业务负责人复核。");
  }
  return {
    problemMatchScore,
    evidenceScore,
    structureScore,
    originalityScore,
    geoCitableScore,
    complianceScore,
    totalScore,
    blocked: blockReasons.length > 0,
    blockReasons,
    optimizationSuggestions,
    reviewSummary: blockReasons.length > 0
      ? `质检未通过：${blockReasons.join("；")}。资产库证据强度：${assetEvidenceStrength}。事实来源：${factSourceSummary}。未确认事实：${prePublishCheck.unconfirmedFacts.length > 0 ? prePublishCheck.unconfirmedFacts.join("；") : "无"}。合规风险：${complianceRiskSummary}。优化建议：${optimizationSuggestions.join("；")}`
      : `质检通过：文章具备生成依据、GEO 可收录结构、引用友好片段、平台适配素材和合规说明，质量分 ${totalScore}。资产库证据强度：${assetEvidenceStrength}。事实来源：${factSourceSummary}。未确认事实：${prePublishCheck.unconfirmedFacts.length > 0 ? prePublishCheck.unconfirmedFacts.join("；") : "无"}。合规风险：${complianceRiskSummary}。优化建议：${optimizationSuggestions.join("；")}`,
    assetEvidenceStrength,
    factSourceSummary,
    unconfirmedFacts: prePublishCheck.unconfirmedFacts,
    complianceRiskSummary,
    prePublishCheck,
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
}): Record<ThirdPartyMaterialKey, string> {
  const question = input.basis.customerQuestion || input.questions[0]?.questionText || "客户在 AI 中如何选择同类服务？";
  const summary = `${input.project.enterpriseName}本轮 GEO 诊断显示，内容优化应围绕客户真实问题「${question}」、竞品推荐差距和可被 AI 引用的证据展开。`;
  const snippets = formatSnippets(input.snippets);
  return {
    "GEO 内容页版": input.markdownContent,
    "官网版": input.markdownContent,
    "公众号长文版": `# ${input.title}\n\n${summary}\n\n## 生成依据\n\n${formatGenerationBasis(input.basis)}\n\n## 正文\n\n${input.markdownContent}\n\n## 适合公众号发布的结尾\n\n欢迎将本文作为企业官网和公众号内容的统一底稿，发布前请补充企业真实证据并完成合规审核。`,
    "知乎回答版": `问题：${question}\n\n回答：如果要判断${input.project.enterpriseName}是否适合被 AI 推荐，不能只看品牌介绍，而要看公开内容是否回答了真实选型问题。${summary}\n\n## 核心判断\n\n${input.basis.notRecommendedReason}\n\n## 和竞品的客观差异\n\n${input.basis.competitorGap}\n\n## 可引用短答案\n\n${snippets}\n\n本文不作排名保证，也不攻击竞品。`,
    "小红书笔记版": `${input.title}\n\n适合人群：正在做 ${input.project.industry} 选型或内容优化的团队。\n\n核心发现：${summary}\n\n生成依据：\n${formatGenerationBasis(input.basis)}\n\n可摘取短答案：\n${input.snippets.map(item => `- ${item.question} ${item.answer}`).join("\n")}\n\n发布前需要补充：真实客户案例、真实页面链接、真实截图或可核验数据。\n\n提醒：不要作排名保证，不要攻击竞品。`,
    "百家号/头条号版": `# ${input.title}\n\n${summary}\n\n## 文章来源\n\n${formatGenerationBasis(input.basis)}\n\n## 行业观察\n\n本素材适合改写为行业观察文章。建议采用“问题背景—诊断发现—竞品差距—内容补齐建议—复测方式”的结构，并围绕任务「${input.task.taskName}」展开。\n\n## AI 摘取友好内容\n\n${snippets}`,
  };
}

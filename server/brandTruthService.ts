import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  aiTestRuns,
  brandTruthConflicts,
  brandTruthEvidence,
  brandTruthFactEvidenceLinks,
  brandTruthFacts,
  brandTruthFactVersions,
  brandTruthProfiles,
  enterpriseGeoProfiles,
  projects,
  understandingCorrectionTasks,
  understandingDimensionResults,
  understandingEvaluations,
  understandingQuestions,
  understandingQuestionSets,
} from "../drizzle/schema";
import type { DbConn } from "./projectAccess";
import {
  calculateTruthProfileStats,
  canUseFactAsConfirmedTruth,
  listBrandTruthFactDefinitions,
  normalizeTruthValue,
  type BrandTruthVerificationStatus,
} from "@shared/brandTruth";
import {
  calculateUnderstandingTotalScore,
  compareStatementToTruth,
  DEFAULT_UNDERSTANDING_QUESTION_TEMPLATES,
  deriveUnderstandingSeverity,
  extractUnderstandingFactsByRule,
  recommendCorrectionAction,
  renderUnderstandingQuestion,
  UNDERSTANDING_DIMENSIONS,
  DEFAULT_UNDERSTANDING_METHODOLOGY,
  actualStatementsForFact,
  type ExtractedUnderstandingFacts,
  type SemanticFactComparison,
  type UnderstandingDimensionId,
  type UnderstandingFieldStatus,
} from "@shared/understandingEngine";
import { defaultModelRouter } from "./modelRouter";
import { getAiMentionModelConfiguration } from "./geoAiMentionCheck";

type LegacyProfile = typeof enterpriseGeoProfiles.$inferSelect;

export type TruthFactDraft = {
  category: "identity" | "business" | "capability_boundary" | "temporal";
  factType: string;
  factKey: string;
  factValue: string;
  description?: string | null;
  importance: "critical" | "high" | "medium" | "low";
  verificationStatus?: BrandTruthVerificationStatus;
  validFrom?: Date | null;
  validTo?: Date | null;
};

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) return value.filter(Boolean).join("、");
  }
  return null;
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(normalized.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function mergeStructuredExtraction(rule: ExtractedUnderstandingFacts, model: Record<string, unknown> | null): ExtractedUnderstandingFacts {
  if (!model) return rule;
  const scalarKeys = ["detectedBrandName", "detectedCompanyName", "detectedOfficialWebsite", "detectedIndustry", "detectedCategory"] as const;
  const arrayKeys = [
    "detectedCoreBusiness", "detectedProducts", "detectedServices", "detectedProblemsSolved", "detectedTargetCustomers",
    "detectedNonTargetCustomers", "detectedUseCases", "detectedCapabilities", "detectedDifferentiators", "detectedLimitations",
    "detectedCompetitors", "detectedHistoricalInfo", "detectedClaims", "detectedCitations", "uncertainStatements",
  ] as const;
  const merged = { ...rule };
  for (const key of scalarKeys) {
    const value = model[key];
    if (typeof value === "string" && value.trim()) merged[key] = value.trim();
  }
  for (const key of arrayKeys) {
    const value = model[key];
    if (Array.isArray(value)) merged[key] = Array.from(new Set([...merged[key], ...value.filter(item => typeof item === "string").map(item => String(item).trim()).filter(Boolean)]));
  }
  return merged;
}

function parseSemanticComparisons(value: unknown): SemanticFactComparison[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const relation = row.relation;
    if (typeof row.factKey !== "string" || !["supports", "contradicts", "not_mentioned", "uncertain"].includes(String(relation))) return [];
    return [{
      factKey: row.factKey,
      relation: relation as SemanticFactComparison["relation"],
      actualStatement: typeof row.actualStatement === "string" ? row.actualStatement : null,
      reason: typeof row.reason === "string" ? row.reason : "",
    }];
  });
}

async function extractUnderstandingFactsWithModel(
  rawAnswer: string,
  ruleExtraction: ExtractedUnderstandingFacts,
  expectedFacts: Array<{ factKey: string; factValue: string }>,
) {
  try {
    const result = await defaultModelRouter.callModel("diagnosis", [
      "请只抽取下方 AI 回答中明确出现的信息，不补充外部知识，不判断最终分数。",
      "输出一个 JSON 对象，字段必须包括：detectedBrandName, detectedCompanyName, detectedOfficialWebsite, detectedIndustry, detectedCategory, detectedCoreBusiness, detectedProducts, detectedServices, detectedProblemsSolved, detectedTargetCustomers, detectedNonTargetCustomers, detectedUseCases, detectedCapabilities, detectedDifferentiators, detectedLimitations, detectedCompetitors, detectedHistoricalInfo, detectedClaims, detectedCitations, uncertainStatements。",
      "前五项为 string 或 null，其余字段为 string[]。无法确认时使用 null 或空数组。",
      "同时输出 semanticComparisons 数组。每项只包含 factKey、relation、actualStatement、reason；relation 只能是 supports、contradicts、not_mentioned、uncertain。它只是语义辅助，不是最终裁决。措辞不同但含义一致应为 supports；没有提到应为 not_mentioned；只有明确相反时才是 contradicts。",
      `待比对的已核验事实：\n${JSON.stringify(expectedFacts)}`,
      `AI 回答：\n${rawAnswer}`,
    ].join("\n\n"), { systemPrompt: "你是信息抽取与语义比对助手。不得新增原回答没有的事实，不得输出自由评分，最终结论由确定性规则与人工复核决定。" });
    const parsed = parseModelJson(result.text);
    const semanticComparisons = parseSemanticComparisons(parsed?.semanticComparisons);
    return {
      extracted: mergeStructuredExtraction(ruleExtraction, parsed),
      extractorModel: result.modelId,
      semanticComparisons,
      semanticJudgement: parsed
        ? { extractionSucceeded: true, model: result.modelId, channel: result.modelName, scoringAuthority: false, comparisons: semanticComparisons }
        : { extractionSucceeded: false, model: result.modelId, channel: result.modelName, scoringAuthority: false, comparisons: [], reason: "模型未返回可解析 JSON，保留规则抽取" },
    };
  } catch (error) {
    return {
      extracted: ruleExtraction,
      extractorModel: "rule-v1",
      semanticComparisons: [] as SemanticFactComparison[],
      semanticJudgement: { extractionSucceeded: false, scoringAuthority: false, comparisons: [], reason: error instanceof Error ? error.message : "模型抽取失败，保留规则抽取" },
    };
  }
}

/** 旧企业档案只生成 provided_unverified 草稿，绝不自动标记为已验证。 */
export function buildUnverifiedTruthDrafts(project: typeof projects.$inferSelect, profile?: LegacyProfile | null): TruthFactDraft[] {
  const values: Record<string, string | null> = {
    brand_name: firstNonEmpty(profile?.brandName, profile?.shortName, profile?.enterpriseName, project.enterpriseName),
    company_name: firstNonEmpty(profile?.enterpriseName, project.enterpriseName),
    official_website: firstNonEmpty(profile?.officialWebsite, project.website),
    industry: firstNonEmpty(profile?.industryTag, profile?.industry, project.industry),
    one_line_definition: firstNonEmpty(profile?.oneLiner),
    core_business: firstNonEmpty(profile?.productDesc, profile?.productServiceIntro, profile?.productIntro, project.productIntro),
    main_products: firstNonEmpty(profile?.productIntro),
    main_services: firstNonEmpty(profile?.productServiceIntro, profile?.serviceModel),
    problems_solved: firstNonEmpty(profile?.customerPains),
    target_customers: firstNonEmpty(profile?.targetCustomer, profile?.targetCustomers, project.targetCustomers),
    non_target_customers: firstNonEmpty(profile?.unfitCustomers),
    use_cases: firstNonEmpty(profile?.fitCustomers, profile?.serviceProcess),
    core_capabilities: firstNonEmpty(profile?.featureNotes, profile?.keyPoints, project.coreSellingPoints),
    differentiators: firstNonEmpty(profile?.competitorDifference, profile?.coreSellingPoints, project.coreSellingPoints),
    service_model: firstNonEmpty(profile?.serviceModel, profile?.deliveryPlan),
    active_business: firstNonEmpty(profile?.productServiceIntro, profile?.productDesc, project.productIntro),
  };
  const definitions = new Map(listBrandTruthFactDefinitions().map(definition => [definition.key, definition]));
  return Object.entries(values).flatMap(([factKey, factValue]) => {
    const definition = definitions.get(factKey);
    if (!factValue || !definition) return [];
    return [{
      category: definition.category,
      factType: factKey,
      factKey,
      factValue,
      importance: definition.importance,
      verificationStatus: "provided_unverified" as const,
      description: "由现有企业档案导入，尚未完成公开证据核验。",
    }];
  });
}

export async function loadTruthContext(db: DbConn, projectId: number) {
  const [projectRows, legacyRows, profileRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).orderBy(desc(enterpriseGeoProfiles.updatedAt)).limit(1),
    db.select().from(brandTruthProfiles).where(eq(brandTruthProfiles.projectId, projectId)).limit(1),
  ]);
  const project = projectRows[0];
  if (!project) throw new Error("项目不存在");
  const profile = profileRows[0] ?? null;
  const facts = profile
    ? await db.select().from(brandTruthFacts).where(and(eq(brandTruthFacts.projectId, projectId), isNull(brandTruthFacts.archivedAt))).orderBy(brandTruthFacts.category, brandTruthFacts.factKey)
    : [];
  const fallbackFacts = profile ? [] : buildUnverifiedTruthDrafts(project, legacyRows[0]);
  return { project, legacyProfile: legacyRows[0] ?? null, profile, facts, fallbackFacts };
}

export async function createProfileFromExistingData(db: DbConn, projectId: number, userId: number) {
  const context = await loadTruthContext(db, projectId);
  if (context.profile) return context.profile;
  const inserted = await db.insert(brandTruthProfiles).values({ projectId, status: "draft" }).$returningId();
  const id = inserted[0]?.id;
  if (!id) throw new Error("创建品牌事实基线失败");
  const drafts = buildUnverifiedTruthDrafts(context.project, context.legacyProfile);
  if (drafts.length) {
    const insertedFacts = await db.insert(brandTruthFacts).values(drafts.map(draft => ({
      ...draft,
      profileId: id,
      projectId,
      normalizedValue: normalizeTruthValue(draft.factValue),
      createdBy: userId,
    }))).$returningId();
    if (insertedFacts.length) {
      await db.insert(brandTruthFactVersions).values(insertedFacts.map((row, index) => ({
        factId: row.id,
        projectId,
        version: 1,
        profileVersion: 1,
        previousValue: null,
        newValue: drafts[index]!.factValue,
        previousVerificationStatus: null,
        newVerificationStatus: "provided_unverified",
        changeReason: "从现有企业档案导入为待核验事实",
        changedBy: userId,
        requiresRevalidation: true,
      })));
    }
  }
  await ensureDefaultUnderstandingQuestionSet(db, projectId, userId, context.project.enterpriseName, context.legacyProfile);
  await refreshTruthProfileStats(db, projectId);
  const rows = await db.select().from(brandTruthProfiles).where(eq(brandTruthProfiles.id, id)).limit(1);
  return rows[0]!;
}

export async function refreshTruthProfileStats(db: DbConn, projectId: number) {
  const facts = await db.select({ factKey: brandTruthFacts.factKey, verificationStatus: brandTruthFacts.verificationStatus })
    .from(brandTruthFacts).where(and(eq(brandTruthFacts.projectId, projectId), isNull(brandTruthFacts.archivedAt)));
  const stats = calculateTruthProfileStats(facts);
  await db.update(brandTruthProfiles).set(stats).where(eq(brandTruthProfiles.projectId, projectId));
  return stats;
}

export async function ensureDefaultUnderstandingQuestionSet(
  db: DbConn,
  projectId: number,
  userId: number,
  enterpriseName: string,
  legacyProfile?: LegacyProfile | null,
) {
  const existing = await db.select().from(understandingQuestionSets)
    .where(and(eq(understandingQuestionSets.projectId, projectId), eq(understandingQuestionSets.status, "active"))).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(understandingQuestionSets).values({
    projectId, name: "AI 品牌理解固定问题集", version: 1, status: "active", validFrom: new Date(), fixedAcrossPeriods: true, createdBy: userId,
  }).$returningId();
  const setId = inserted[0]?.id;
  if (!setId) throw new Error("创建理解问题集失败");
  const brandName = firstNonEmpty(legacyProfile?.brandName, legacyProfile?.shortName, enterpriseName) ?? enterpriseName;
  const companyName = firstNonEmpty(legacyProfile?.enterpriseName, enterpriseName) ?? enterpriseName;
  const competitorName = legacyProfile?.competitors?.[0];
  await db.insert(understandingQuestions).values(DEFAULT_UNDERSTANDING_QUESTION_TEMPLATES.map(([category, template, factKeys], index) => ({
    projectId,
    questionSetId: setId,
    category,
    questionType: "system_default" as const,
    questionText: renderUnderstandingQuestion(template, { brandName, companyName, competitorName }),
    verificationFactKeys: [...factKeys],
    enabled: true,
    fixedAcrossPeriods: true,
    sortOrder: index + 1,
  })));
  const rows = await db.select().from(understandingQuestionSets).where(eq(understandingQuestionSets.id, setId)).limit(1);
  return rows[0]!;
}

export async function buildUnderstandingSummary(db: DbConn, projectId: number) {
  const context = await loadTruthContext(db, projectId);
  const [evidence, conflicts, evaluations, tasks, questionSets] = await Promise.all([
    db.select().from(brandTruthEvidence).where(eq(brandTruthEvidence.projectId, projectId)).orderBy(desc(brandTruthEvidence.updatedAt)),
    db.select().from(brandTruthConflicts).where(eq(brandTruthConflicts.projectId, projectId)).orderBy(desc(brandTruthConflicts.createdAt)),
    db.select().from(understandingEvaluations).where(eq(understandingEvaluations.projectId, projectId)).orderBy(desc(understandingEvaluations.testedAt)),
    db.select().from(understandingCorrectionTasks).where(eq(understandingCorrectionTasks.projectId, projectId)).orderBy(desc(understandingCorrectionTasks.createdAt)),
    db.select().from(understandingQuestionSets).where(eq(understandingQuestionSets.projectId, projectId)).orderBy(desc(understandingQuestionSets.version)),
  ]);
  const latestTestedAt = evaluations[0]?.testedAt ?? null;
  const latestEvaluations = latestTestedAt ? evaluations.filter(row => row.testedAt.getTime() === latestTestedAt.getTime()) : [];
  const evaluationIds = latestEvaluations.map(row => row.id);
  const dimensionRows = evaluationIds.length
    ? await db.select().from(understandingDimensionResults).where(inArray(understandingDimensionResults.evaluationId, evaluationIds))
    : [];
  const dimensionSummary = UNDERSTANDING_DIMENSIONS.map(dimension => {
    const allRows = dimensionRows.filter(row => row.dimension === dimension.id);
    const scoredRows = allRows.filter(row => row.score != null);
    const score = scoredRows.length ? Math.round(scoredRows.reduce((sum, row) => sum + (row.score ?? 0), 0) / scoredRows.length) : null;
    const statuses = allRows.map(row => row.status as UnderstandingFieldStatus);
    const status: UnderstandingFieldStatus = statuses.includes("hallucinated") ? "hallucinated"
      : statuses.includes("inaccurate") ? "inaccurate"
        : statuses.includes("conflicting") ? "conflicting"
          : statuses.includes("outdated") ? "outdated"
            : statuses.includes("partially_accurate") ? "partially_accurate"
              : statuses.includes("missing") ? "missing"
                : statuses.includes("unverifiable") ? "unverifiable"
                  : statuses.includes("mostly_accurate") ? "mostly_accurate" : statuses[0] ?? "unverifiable";
    const severity = allRows.some(row => row.severity === "P0") ? "P0" : allRows.some(row => row.severity === "P1") ? "P1" : allRows.some(row => row.severity === "P2") ? "P2" : null;
    const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
    return {
      ...dimension,
      score,
      status,
      severity,
      expectedFacts: allRows.flatMap(row => row.expectedFacts),
      actualStatements: uniqueStrings(allRows.flatMap(row => row.actualStatements)),
      matchedFacts: uniqueStrings(allRows.flatMap(row => row.matchedFacts)),
      missingFacts: uniqueStrings(allRows.flatMap(row => row.missingFacts)),
      inaccurateFacts: uniqueStrings(allRows.flatMap(row => row.inaccurateFacts)),
      outdatedFacts: uniqueStrings(allRows.flatMap(row => row.outdatedFacts)),
      unverifiableClaims: uniqueStrings(allRows.flatMap(row => row.unverifiableClaims)),
      evidenceReferences: Array.from(new Set(allRows.flatMap(row => row.evidenceReferences))),
      customerExplanation: uniqueStrings(allRows.map(row => row.customerExplanation)).join(" "),
      recommendedCorrection: uniqueStrings(allRows.map(row => row.recommendedCorrection)).join("；"),
    };
  });
  const total = calculateUnderstandingTotalScore(dimensionSummary.map(row => ({ dimension: row.id, score: row.score })));
  const persistedFacts = context.facts;
  const previewFacts = context.fallbackFacts.map((fact, index) => ({ id: -(index + 1), projectId, profileId: 0, version: 0, sourceCount: 0, officialSourceCount: 0, thirdPartySourceCount: 0, conflictCount: 0, lastVerifiedAt: null, createdBy: null, reviewedBy: null, archivedAt: null, validFrom: null, validTo: null, createdAt: new Date(0), updatedAt: new Date(0), normalizedValue: normalizeTruthValue(fact.factValue), ...fact, description: fact.description ?? null, verificationStatus: fact.verificationStatus ?? "provided_unverified" }));
  const facts = persistedFacts.length ? persistedFacts : previewFacts;
  const p0 = latestEvaluations.filter(row => row.severity === "P0").length;
  const p1 = latestEvaluations.filter(row => row.severity === "P1").length;
  const p2 = latestEvaluations.filter(row => row.severity === "P2").length;
  const dataSufficient = total.sufficient;
  const maxIssue = tasks.find(task => task.status !== "verified" && task.status !== "cancelled") ?? null;
  const nextValidationAt = tasks
    .map(task => task.targetRetestAt)
    .filter((value): value is Date => Boolean(value && value.getTime() > Date.now()))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const modelConfiguration = getAiMentionModelConfiguration();
  return {
    profile: context.profile,
    profilePersisted: Boolean(context.profile),
    facts,
    evidence,
    conflicts,
    evaluations: latestEvaluations,
    dimensionResults: dimensionSummary,
    correctionTasks: tasks,
    questionSet: questionSets[0] ?? null,
    totalScore: total.score,
    dataSufficient,
    missingDimensions: total.missingDimensions,
    severityCounts: { P0: p0, P1: p1, P2: p2 },
    latestTestedAt,
    nextValidationAt,
    maxIssue,
    oneSentenceConclusion: !latestTestedAt
      ? `已建立 ${facts.length} 条待核验品牌事实，但尚未完成独立的 AI 品牌理解测试，暂无法给出理解准确度。`
      : p0 > 0
        ? `AI 已能提及品牌，但存在 ${p0} 项严重理解偏差，需先完成事实复核和纠偏。`
        : p1 > 0
          ? `AI 已能识别品牌，但仍有 ${p1} 项重要理解偏差需要纠正。`
          : "当前未发现严重理解偏差；仍需结合更多问题、模型和时间节点持续复测。",
    modelChannelsIndependent: modelConfiguration.independent,
    crossModelConclusion: modelConfiguration.independent
      ? "豆包与 DeepSeek 已配置为独立模型通道；形成一致性结论仍需同一问题在两个通道均有真实回答。"
      : "独立模型通道尚未完成配置，当前不能形成跨模型一致性结论。",
    trendConclusion: evaluations.length < 2 ? "尚无足够历史数据形成理解趋势。" : "已有历史评价记录，可按 truth profile version 比较，历史判断不会被新事实覆盖。",
  };
}

function dimensionsForFactKeys(factKeys: string[]) {
  return UNDERSTANDING_DIMENSIONS.filter(dimension => dimension.factKeys.some(key => factKeys.includes(key)));
}

export async function runUnderstandingTest(db: DbConn, input: {
  projectId: number;
  userId: number;
  questionIds?: number[];
  targetRetestRound?: string | null;
}) {
  const context = await loadTruthContext(db, input.projectId);
  if (!context.profile) throw new Error("请先创建并复核品牌事实基线");
  const set = await ensureDefaultUnderstandingQuestionSet(db, input.projectId, input.userId, context.project.enterpriseName, context.legacyProfile);
  const allQuestions = await db.select().from(understandingQuestions).where(and(eq(understandingQuestions.questionSetId, set.id), eq(understandingQuestions.enabled, true))).orderBy(understandingQuestions.sortOrder);
  const selected = input.questionIds?.length ? allQuestions.filter(row => input.questionIds!.includes(row.id)) : allQuestions.slice(0, 15);
  if (!selected.length) throw new Error("当前没有可执行的 Understand 问题");
  const confirmedFacts = context.facts.filter(fact => canUseFactAsConfirmedTruth(fact));
  if (!confirmedFacts.length) throw new Error("事实基线尚无公开核验事实，不能执行准确性判断");
  const linkedEvidence = await db.select().from(brandTruthFactEvidenceLinks).where(and(
    eq(brandTruthFactEvidenceLinks.projectId, input.projectId),
    eq(brandTruthFactEvidenceLinks.supportType, "supports"),
  ));
  const evidenceIdsByFact = new Map<number, number[]>();
  for (const link of linkedEvidence) evidenceIdsByFact.set(link.factId, [...(evidenceIdsByFact.get(link.factId) ?? []), link.evidenceId]);
  const knownOutdatedValues = context.facts.filter(fact => fact.verificationStatus === "outdated").map(fact => fact.factValue);
  const batchTestedAt = new Date();
  const completed: string[] = [];
  const failures: Array<{ questionId: number; question: string; reason: string }> = [];
  for (const question of selected) {
    try {
      const response = await defaultModelRouter.callModel("diagnosis", question.questionText, {
        systemPrompt: "请基于你当前可用的信息直接回答。未知时明确说未知，不要编造链接、数据或能力。",
      });
      const rawAnswer = response.text;
      const brandName = context.facts.find(fact => fact.factKey === "brand_name")?.factValue ?? context.project.enterpriseName;
      const ruleExtraction = extractUnderstandingFactsByRule(rawAnswer, {
        brandName,
        companyName: context.facts.find(fact => fact.factKey === "company_name")?.factValue,
        officialWebsite: context.facts.find(fact => fact.factKey === "official_website")?.factValue,
        competitors: context.legacyProfile?.competitors ?? context.project.competitorNames,
      });
      const expectedFacts = question.verificationFactKeys.flatMap(factKey => {
        const fact = confirmedFacts.find(row => row.factKey === factKey);
        return fact ? [{ factKey, factValue: fact.factValue }] : [];
      });
      const extraction = await extractUnderstandingFactsWithModel(rawAnswer, ruleExtraction, expectedFacts);
      const extracted = extraction.extracted;
      const evaluationId = randomUUID();
      const comparisons = question.verificationFactKeys.map(factKey => {
        const fact = context.facts.find(row => row.factKey === factKey);
        const semanticComparison = extraction.semanticComparisons.find(row => row.factKey === factKey) ?? null;
        const actualStatements = actualStatementsForFact(factKey, extracted, semanticComparison);
        const result = compareStatementToTruth({ expectedFact: fact, actualStatements, semanticComparison, knownOutdatedValues });
        const severity = deriveUnderstandingSeverity({
          status: result.status,
          factKey,
          legalOrCommercialRisk: factKey === "prohibited_promises" && ["inaccurate", "hallucinated", "conflicting"].includes(result.status),
        });
        return { factKey, fact, actualStatements, semanticComparison, ...result, severity };
      });
      const statuses = comparisons.map(row => row.status);
      const finalStatus: UnderstandingFieldStatus = statuses.includes("hallucinated") ? "hallucinated"
        : statuses.includes("inaccurate") ? "inaccurate"
          : statuses.includes("conflicting") ? "conflicting"
            : statuses.includes("outdated") ? "outdated"
              : statuses.every(status => status === "missing") ? "missing"
                : statuses.every(status => status === "unverifiable") ? "unverifiable"
                  : statuses.includes("missing") || statuses.includes("unverifiable") || statuses.includes("partially_accurate") ? "partially_accurate"
                    : statuses.includes("mostly_accurate") ? "mostly_accurate" : "accurate";
      const severity = comparisons.some(row => row.severity === "P0") ? "P0" : comparisons.some(row => row.severity === "P1") ? "P1" : comparisons.some(row => row.severity === "P2") ? "P2" : null;
      const evidenceReferences = Array.from(new Set(comparisons.flatMap(row => row.fact ? evidenceIdsByFact.get(row.fact.id) ?? [] : [])));
      await db.insert(understandingEvaluations).values({
        id: evaluationId,
        projectId: input.projectId,
        questionSetId: set.id,
        questionId: question.id,
        testRoundId: input.targetRetestRound ?? null,
        testedModel: response.modelId,
        testedChannel: response.modelName,
        testedAt: batchTestedAt,
        rawAnswer,
        extractedFacts: extracted,
        uncertainStatements: extracted.uncertainStatements,
        ruleResults: { comparisons },
        semanticJudgement: extraction.semanticJudgement,
        evidenceReferences,
        evaluationVersion: "understand-v2",
        methodologyVersion: `${DEFAULT_UNDERSTANDING_METHODOLOGY.id}@${DEFAULT_UNDERSTANDING_METHODOLOGY.version}`,
        dimensionWeights: Object.fromEntries(DEFAULT_UNDERSTANDING_METHODOLOGY.dimensions.map(item => [item.id, item.weight])),
        ruleVersion: DEFAULT_UNDERSTANDING_METHODOLOGY.ruleVersion,
        truthProfileVersion: context.profile.currentVersion,
        questionSetVersion: set.version,
        extractionVersion: extraction.extractorModel === "rule-v1" ? "rule-v1" : "structured-model-v2+rule-v1",
        extractorModel: extraction.extractorModel,
        evaluatorModel: "deterministic-rule-v2+semantic-assist+manual-review",
        manualReviewStatus: severity === "P0" || severity === "P1" ? "pending" : "not_required",
        finalStatus,
        severity: severity ?? undefined,
        assessmentStatus: comparisons.every(row => row.status === "unverifiable") ? "unknown" : severity ? "issue_detected" : "no_issue_detected",
        plannedQuestionCount: selected.length,
        runQuestionCount: 1,
        verifiedFactCount: confirmedFacts.length,
        extractionCoverage: Math.round((comparisons.filter(row => row.status !== "missing").length / Math.max(comparisons.length, 1)) * 100),
        assessmentCoverage: Math.round((comparisons.filter(row => row.status !== "unverifiable").length / Math.max(comparisons.length, 1)) * 100),
      });
      for (const dimension of dimensionsForFactKeys(question.verificationFactKeys)) {
        const related = comparisons.filter(row => (dimension.factKeys as readonly string[]).includes(row.factKey));
        const relatedStatuses = related.map(row => row.status);
        const status: UnderstandingFieldStatus = relatedStatuses.includes("hallucinated") ? "hallucinated"
          : relatedStatuses.includes("inaccurate") ? "inaccurate"
            : relatedStatuses.includes("conflicting") ? "conflicting"
              : relatedStatuses.includes("outdated") ? "outdated"
                : relatedStatuses.every(value => value === "unverifiable") ? "unverifiable"
                  : relatedStatuses.every(value => value === "missing") ? "missing"
                    : relatedStatuses.includes("missing") || relatedStatuses.includes("unverifiable") || relatedStatuses.includes("partially_accurate") ? "partially_accurate"
                      : relatedStatuses.includes("mostly_accurate") ? "mostly_accurate" : "accurate";
        const scoreMap: Record<UnderstandingFieldStatus, number> = { accurate: 100, mostly_accurate: 85, partially_accurate: 65, missing: 40, unverifiable: 0, inaccurate: 20, outdated: 20, conflicting: 15, hallucinated: 0 };
        const dimensionEvidenceReferences = Array.from(new Set(related.flatMap(row => row.fact ? evidenceIdsByFact.get(row.fact.id) ?? [] : [])));
        await db.insert(understandingDimensionResults).values({
          projectId: input.projectId,
          evaluationId,
          dimension: dimension.id,
          score: status === "unverifiable" ? null : scoreMap[status],
          status,
          expectedFacts: related.map(row => ({ factKey: row.factKey, value: row.fact?.factValue, verificationStatus: row.fact?.verificationStatus })),
          actualStatements: Array.from(new Set(related.flatMap(row => row.actualStatements))),
          matchedFacts: related.filter(row => row.status === "accurate" || row.status === "mostly_accurate").map(row => row.factKey),
          missingFacts: related.filter(row => row.status === "missing").map(row => row.factKey),
          inaccurateFacts: related.filter(row => row.status === "inaccurate").map(row => row.factKey),
          outdatedFacts: related.filter(row => row.status === "outdated").map(row => row.factKey),
          conflictingFacts: related.filter(row => row.status === "conflicting").map(row => row.factKey),
          hallucinatedClaims: related.filter(row => row.status === "hallucinated").flatMap(row => row.actualStatements),
          unverifiableClaims: related.filter(row => row.status === "unverifiable").map(row => row.factKey),
          evidenceReferences: dimensionEvidenceReferences,
          severity: severity ?? undefined,
          customerExplanation: related.map(row => row.reason).join(" "),
          recommendedCorrection: related.map(row => recommendCorrectionAction(row.factKey).label).filter((value, index, list) => list.indexOf(value) === index).join("；"),
          verificationQuestionIds: [question.id],
        });
      }
      completed.push(evaluationId);
    } catch (error) {
      failures.push({ questionId: question.id, question: question.questionText, reason: error instanceof Error ? error.message : "真实模型调用失败" });
    }
  }
  if (completed.length) {
    await db.update(understandingEvaluations).set({ runQuestionCount: completed.length }).where(and(
      eq(understandingEvaluations.projectId, input.projectId),
      inArray(understandingEvaluations.id, completed),
    ));
  }
  return {
    testedAt: batchTestedAt,
    plannedQuestionCount: selected.length,
    questionCount: completed.length,
    failedQuestionCount: failures.length,
    failures,
    evaluationIds: completed,
    wroteData: completed.length > 0,
  };
}

export async function listLinkedEvidence(db: DbConn, projectId: number, factId?: number) {
  const links = await db.select().from(brandTruthFactEvidenceLinks).where(factId
    ? and(eq(brandTruthFactEvidenceLinks.projectId, projectId), eq(brandTruthFactEvidenceLinks.factId, factId))
    : eq(brandTruthFactEvidenceLinks.projectId, projectId));
  const ids = links.map(link => link.evidenceId);
  const evidence = ids.length ? await db.select().from(brandTruthEvidence).where(and(eq(brandTruthEvidence.projectId, projectId), inArray(brandTruthEvidence.id, ids))) : [];
  return { links, evidence };
}

export async function linkExistingAiTestRun(db: DbConn, projectId: number, aiTestRunId: string) {
  const rows = await db.select().from(aiTestRuns).where(and(eq(aiTestRuns.projectId, projectId), eq(aiTestRuns.id, aiTestRunId))).limit(1);
  return rows[0] ?? null;
}

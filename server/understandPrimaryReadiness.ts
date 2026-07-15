export const FROZEN_UNDERSTAND_DIMENSIONS = [
  "identity", "category", "business", "products_services", "customers", "scenarios", "capability_differentiation", "boundary_temporal",
] as const;
export const BASELINE_V1_DIMENSIONS = [
  "identity", "business", "capability", "boundary", "temporal", "evidence", "consistency", "uncertainty",
] as const;

export const BASELINE_V1_TO_FROZEN_MAPPING = {
  identity: ["identity"],
  business: ["category", "business"],
  capability: ["products_services", "capability_differentiation"],
  evidence: ["customers"],
  consistency: ["scenarios"],
  uncertainty: ["capability_differentiation"],
  boundary: ["boundary_temporal"],
  temporal: ["boundary_temporal"],
} as const;

export type CoverageBreakdown = {
  questionExecution: number;
  extraction: number;
  verifiedTruth: number;
  evidence: number;
  assessment: number;
};

export function calculateCoverage(input: {
  plannedQuestions: number; executedQuestions: number; successfulExtractions: number;
  requiredTruthFacts: number; verifiedTruthFacts: number; requiredEvidenceFacts: number; evidencedFacts: number;
  completedAssessments: number;
}): CoverageBreakdown {
  const ratio = (n: number, d: number) => d <= 0 ? 0 : Math.round(Math.min(n / d, 1) * 10_000);
  return {
    questionExecution: ratio(input.executedQuestions, input.plannedQuestions),
    extraction: ratio(input.successfulExtractions, input.plannedQuestions),
    verifiedTruth: ratio(input.verifiedTruthFacts, input.requiredTruthFacts),
    evidence: ratio(input.evidencedFacts, input.requiredEvidenceFacts),
    assessment: ratio(input.completedAssessments, input.plannedQuestions),
  };
}

export type ReadinessInput = {
  fixedQuestionSetComplete: boolean; traceable: boolean; reviewCount: number; assessmentCount: number;
  methodologyDimensions: readonly string[]; minimumTruthMet: boolean; unverifiableExplained: boolean;
  customerPresentationStable: boolean; differenceClassified: boolean; projectIsolationPassed: boolean;
  dualWrite: boolean; rollbackVerified: boolean;
};

export function evaluatePrimaryReadiness(input: ReadinessInput) {
  const gates = {
    fixedQuestionSetComplete: input.fixedQuestionSetComplete,
    traceable: input.traceable,
    manualReviewComplete: input.assessmentCount > 0 && input.reviewCount >= input.assessmentCount,
    methodologyStable: FROZEN_UNDERSTAND_DIMENSIONS.every(d => input.methodologyDimensions.includes(d)) && input.methodologyDimensions.length === 8,
    minimumTruthMet: input.minimumTruthMet,
    unverifiableExplained: input.unverifiableExplained,
    customerPresentationStable: input.customerPresentationStable,
    differenceClassified: input.differenceClassified,
    projectIsolationPassed: input.projectIsolationPassed,
    noDualWrite: !input.dualWrite,
    rollbackVerified: input.rollbackVerified,
  };
  return { ready: Object.values(gates).every(Boolean), gates };
}

export const UNVERIFIABLE_REVIEW_PLAN = {
  business: {
    reason: "问题将品类与核心业务合并，自动抽取未能把回答映射到已核验业务事实；属于问题设计不足与 Extraction 无法确定。",
    missingFacts: ["当前有效核心业务的可判定定义", "品类与业务的独立事实键"],
    missingEvidence: ["官网当前业务定义页的逐条事实关联"], addQuestion: true, adjustExtraction: true, createCorrectionTask: true,
    completion: "拆分品类/业务问题，并由公开证据支持的事实键分别完成抽取和评估。",
    nextQuestion: "海豚知道当前提供的核心业务是什么？请仅陈述官网可核验内容。",
  },
  consistency: {
    reason: "旧维度 consistency 被临时用于承载冻结维度“场景”，方法论语义不一致；属于问题设计不足。",
    missingFacts: ["逐场景的适用主体、动作和平台"],
    missingEvidence: ["每个典型场景对应的官方产品或帮助页"], addQuestion: true, adjustExtraction: true, createCorrectionTask: true,
    completion: "使用 methodology v2 的 scenarios 维度重跑固定场景问题，并完成证据关联。",
    nextQuestion: "海豚知道有哪些由官方页面明确描述的典型使用场景？",
  },
  temporal: {
    reason: "当前业务和过时信息证据未形成时间有效性闭环；属于公开证据不足与来源冲突。",
    missingFacts: ["业务有效日期", "历史运营主体变更时间", "已停止业务清单"],
    missingEvidence: ["带更新时间的官方业务页", "可核验的主体变更或历史公告"], addQuestion: false, adjustExtraction: true, createCorrectionTask: true,
    completion: "有效期事实和主体冲突经人工复核，无法确认部分继续保持 unverified。",
    nextQuestion: "截至核验日期，哪些业务仍由官方页面明确提供，哪些历史信息无法确认仍有效？",
  },
} as const;

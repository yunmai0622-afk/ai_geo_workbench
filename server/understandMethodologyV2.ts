export const UNDERSTAND_V2_DIMENSIONS = ["identity", "category", "business", "product_service", "target_customer", "scenario", "capability_differentiation", "boundary_temporal"] as const;
export type UnderstandV2Dimension = typeof UNDERSTAND_V2_DIMENSIONS[number];

export const UNDERSTAND_EXTRACTION_V2_FIELDS = ["brand_identity", "company_relationship", "category", "business_definition", "product_service", "target_customer", "scenario", "capability", "differentiation", "applicability", "limitation", "current_business", "historical_business", "outdated_information", "uncertainty_statement"] as const;

const common = {
  judgmentRules: { accurate: "explicit claims supported by matched verified truth", unverifiable: "required truth, evidence, or explicit answer content is absent", noScoreWhenUnverifiable: true },
  coverageThresholdBasisPoints: 7000,
  unverifiableConditions: ["missing_verified_truth", "missing_public_evidence", "insufficient_answer", "extraction_ambiguous", "source_conflict"],
  confidencePolicy: { answer: 2500, extraction: 2500, verifiedTruth: 2500, evidence: 1500, consistencyFactor: 1000, uncertaintyPenalty: true },
  severityRules: { P0: "wrong legal identity or prohibited capability claim", P1: "material business/capability mismatch", P2: "non-critical supported mismatch", none: "no rule hit" },
};

export const UNDERSTAND_V2_DEFINITIONS = [
  { dimension:"identity", displayName:"身份", weightBasisPoints:1250, factKeys:["brand_name","company_name","official_website","brand_company_relationship"], questionTypes:["identity"], extractionFields:["brand_identity","company_relationship"], subdimensions:["brand","company","website"], ...common },
  { dimension:"category", displayName:"品类", weightBasisPoints:1250, factKeys:["category_definition"], questionTypes:["category"], extractionFields:["category"], subdimensions:["category_definition"], ...common },
  { dimension:"business", displayName:"业务", weightBasisPoints:1250, factKeys:["core_business","current_business"], questionTypes:["business"], extractionFields:["business_definition","current_business"], subdimensions:["core_business","current_business"], ...common },
  { dimension:"product_service", displayName:"产品服务", weightBasisPoints:1250, factKeys:["major_products_services","product_service_status"], questionTypes:["product_service"], extractionFields:["product_service"], subdimensions:["product","service"], ...common },
  { dimension:"target_customer", displayName:"目标客户", weightBasisPoints:1250, factKeys:["target_customers"], questionTypes:["target_customer"], extractionFields:["target_customer","applicability"], subdimensions:["customer","applicability"], ...common },
  { dimension:"scenario", displayName:"使用场景", weightBasisPoints:1250, factKeys:["typical_scenarios"], questionTypes:["scenario"], extractionFields:["scenario"], subdimensions:["scenario"], ...common },
  { dimension:"capability_differentiation", displayName:"能力与差异化", weightBasisPoints:1250, factKeys:["core_capabilities","differentiation"], questionTypes:["capability_differentiation"], extractionFields:["capability","differentiation"], subdimensions:["capability","differentiation"], ...common },
  { dimension:"boundary_temporal", displayName:"边界与时效", weightBasisPoints:1250, factKeys:["capability_boundary","not_applicable","current_business","historical_business","outdated_information"], questionTypes:["boundary","temporal"], extractionFields:["applicability","limitation","current_business","historical_business","outdated_information","uncertainty_statement"], subdimensions:["boundary","temporal"], ...common },
] as const satisfies ReadonlyArray<{ dimension: UnderstandV2Dimension; weightBasisPoints: number; [key:string]: unknown }>;

export const UNDERSTAND_V2_QUESTIONS: Array<{ key:string; text:string; primaryDimension:UnderstandV2Dimension; secondaryDimensions:UnderstandV2Dimension[]; subdimension?:"boundary"|"temporal"; scenario:string; audience:string; importance:"critical"|"high" }> = [
  { key:"v2_identity", text:"海豚知道的标准品牌身份、运营公司关系和官方网站分别是什么？存在主体冲突时请明确说明未知。", primaryDimension:"identity", secondaryDimensions:["boundary_temporal"], scenario:"身份核验", audience:"潜在客户与合作伙伴", importance:"critical" },
  { key:"v2_category", text:"海豚知道所属的产品或服务品类是什么？只回答品类定义，不展开业务清单。", primaryDimension:"category", secondaryDimensions:[], scenario:"品类识别", audience:"潜在客户", importance:"critical" },
  { key:"v2_business", text:"海豚知道当前的核心业务是什么？请区分当前业务与历史信息。", primaryDimension:"business", secondaryDimensions:["boundary_temporal"], scenario:"业务核验", audience:"采购与决策人员", importance:"critical" },
  { key:"v2_product_service", text:"海豚知道当前提供哪些具体产品和服务？", primaryDimension:"product_service", secondaryDimensions:["business"], scenario:"产品服务调研", audience:"知识内容创作者", importance:"high" },
  { key:"v2_target_customer", text:"海豚知道明确面向哪些目标客户？不确定的客户群请标明无法确认。", primaryDimension:"target_customer", secondaryDimensions:[], scenario:"客户适配", audience:"采购与运营人员", importance:"high" },
  { key:"v2_scenario", text:"海豚知道有哪些由公开资料支持的典型使用场景？", primaryDimension:"scenario", secondaryDimensions:["product_service"], scenario:"场景适配", audience:"内容运营人员", importance:"high" },
  { key:"v2_capability", text:"海豚知道具备哪些核心能力，以及有哪些可由公开事实支持的差异化？", primaryDimension:"capability_differentiation", secondaryDimensions:["product_service"], scenario:"能力差异核验", audience:"决策人员", importance:"high" },
  { key:"v2_boundary", text:"海豚知道的适用范围、能力限制和不适用范围是什么？", primaryDimension:"boundary_temporal", secondaryDimensions:["capability_differentiation"], subdimension:"boundary", scenario:"边界判断", audience:"法务与运营人员", importance:"critical" },
  { key:"v2_temporal", text:"截至核验日期，海豚知道哪些业务仍有效，哪些属于历史、已停止或无法确认的信息？", primaryDimension:"boundary_temporal", secondaryDimensions:["business","product_service"], subdimension:"temporal", scenario:"时效核验", audience:"决策与复核人员", importance:"critical" },
];

export function validateMethodologyV2() {
  const dimensions = UNDERSTAND_V2_DEFINITIONS.map(d => d.dimension);
  if (new Set(dimensions).size !== 8 || UNDERSTAND_V2_DIMENSIONS.some(d => !dimensions.includes(d))) throw new Error("v2 dimensions do not match frozen definition");
  if (UNDERSTAND_V2_DEFINITIONS.reduce((s,d)=>s+d.weightBasisPoints,0)!==10000) throw new Error("v2 weights must total 10000");
  for (const question of UNDERSTAND_V2_QUESTIONS) if (!UNDERSTAND_V2_DIMENSIONS.includes(question.primaryDimension)) throw new Error("question primary dimension is invalid");
  return true;
}

export function compareV1V2Quality(input:{v1:{question:number;extraction:number;truth:number;evidence:number;assessment:number;unverifiable:number};v2:{question:number;extraction:number;truth:number;evidence:number;assessment:number;unverifiable:number}}){
  return { totalScoreCompared:false, comparable:["dimension_semantics","coverage_quality","unverifiable_count","explainability","severity","confidence"], coverageDelta:{question:input.v2.question-input.v1.question,extraction:input.v2.extraction-input.v1.extraction,truth:input.v2.truth-input.v1.truth,evidence:input.v2.evidence-input.v1.evidence,assessment:input.v2.assessment-input.v1.assessment}, unverifiableDelta:input.v2.unverifiable-input.v1.unverifiable };
}

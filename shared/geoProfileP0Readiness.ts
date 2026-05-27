/**
 * 品牌资产建档 P0 必填口径 — 与 AssetCenter「5 分钟建档」保存校验对齐
 */

function parseLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\n+/).map(s => s.trim()).filter(Boolean);
  return [];
}

function firstLine(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const t = (c ?? "").trim();
    if (t) return t;
  }
  return "";
}

export type GeoProfileP0Readiness = {
  complete: boolean;
  missingLabels: string[];
};

/** 与 client/src/pages/AssetCenter.tsx saveFiveMinuteAndStartDiagnosis 必填项一致 */
export function evaluateGeoProfileP0Readiness(
  profile: Record<string, unknown> | null | undefined,
): GeoProfileP0Readiness {
  if (!profile) {
    return {
      complete: false,
      missingLabels: [
        "企业名称",
        "所属行业",
        "一句话介绍",
        "核心产品/服务",
        "目标客户",
        "主要解决的问题",
        "核心优势",
        "关键词",
      ],
    };
  }

  const missingLabels: string[] = [];

  const brandName = firstLine(
    typeof profile.brandName === "string" ? profile.brandName : "",
    typeof profile.enterpriseName === "string" ? profile.enterpriseName : "",
  );
  if (!brandName) missingLabels.push("企业名称");

  const industry = firstLine(
    typeof profile.industryTag === "string" ? profile.industryTag : "",
    typeof profile.industry === "string" ? profile.industry : "",
  );
  if (!industry) missingLabels.push("所属行业");

  const oneLiner = firstLine(
    typeof profile.oneLiner === "string" ? profile.oneLiner : "",
    typeof profile.companyIntro === "string" ? profile.companyIntro : "",
  );
  if (!oneLiner) missingLabels.push("一句话介绍");

  const productDesc = firstLine(
    typeof profile.productDesc === "string" ? profile.productDesc : "",
    typeof profile.productServiceIntro === "string" ? profile.productServiceIntro : "",
    typeof profile.productIntro === "string" ? profile.productIntro : "",
    typeof profile.coreSellingPoints === "string" ? profile.coreSellingPoints : "",
  );
  if (!productDesc) missingLabels.push("核心产品/服务");

  const targetCustomer = firstLine(
    typeof profile.targetCustomer === "string" ? profile.targetCustomer : "",
    typeof profile.targetCustomers === "string" ? profile.targetCustomers : "",
  );
  if (!targetCustomer) missingLabels.push("目标客户");

  const pains = parseLines(profile.customerPains);
  const primaryPain = pains[0] ?? "";
  if (!primaryPain) missingLabels.push("主要解决的问题");

  const keyPoints = [
    ...parseLines(profile.keyPoints),
    ...parseLines(profile.coreSellingPoints),
  ];
  if (!keyPoints[0]) missingLabels.push("核心优势");

  const keywords = [
    ...parseLines(profile.keywords),
    ...parseLines(profile.coreKeywords),
  ];
  if (!keywords[0]) missingLabels.push("关键词");

  return { complete: missingLabels.length === 0, missingLabels };
}

export function isP0GeoProfileCompleteFromRecord(
  profile: Record<string, unknown> | null | undefined,
): boolean {
  return evaluateGeoProfileP0Readiness(profile).complete;
}

export function formatGeoProfileIncompleteMessage(missingLabels: string[]): string {
  if (missingLabels.length === 0) {
    return "企业建档未完成，请先补全品牌资产建档。";
  }
  return `企业建档还缺少：${missingLabels.join("、")}。请先在「品牌资产建档」补全后再发布。`;
}

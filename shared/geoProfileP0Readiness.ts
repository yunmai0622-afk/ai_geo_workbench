/**
 * 品牌资产建档 P0 必填口径 — 与 AssetCenter 建档页对齐
 * customerPains / keyPoints 为增强项：空值不阻断 P0/T0/发布，但填写可提升完整度。
 */

import { extractProfileForQuestionGeneration } from "./geoProfileQuestionMapping";

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

export const T0_PROFILE_ENHANCEMENT_SUGGESTION =
  "建议补充品牌核心信息，有助于提升 AI 识别准确率";

/** 从档案读取「主要解决的问题」；生成/展示兜底可用一句话介绍 */
export function resolveProfilePrimaryPain(profile: Record<string, unknown> | null | undefined): string {
  const pains = parseLines(profile?.customerPains);
  if (pains[0]) return pains[0];
  return firstLine(
    typeof profile?.oneLiner === "string" ? profile.oneLiner : "",
    typeof profile?.companyIntro === "string" ? profile.companyIntro : "",
  );
}

/** 是否已填写「解决的问题」（仅计用户显式填写的 customerPains） */
export function isProfilePrimaryPainFilled(profile: Record<string, unknown> | null | undefined): boolean {
  return parseLines(profile?.customerPains).length > 0;
}

/** 从档案读取「核心优势」；生成/展示兜底可用 keyPoints 或一句话介绍 */
export function resolveProfileCoreAdvantage(profile: Record<string, unknown> | null | undefined): string {
  const keyPoints = [
    ...parseLines(profile?.keyPoints),
    ...parseLines(profile?.coreSellingPoints),
  ];
  if (keyPoints[0]) return keyPoints[0];
  return firstLine(
    typeof profile?.oneLiner === "string" ? profile.oneLiner : "",
    typeof profile?.coreSellingPoints === "string" ? profile.coreSellingPoints : "",
  );
}

/** 是否已填写「核心优势」（keyPoints 或 coreSellingPoints 有内容） */
export function isProfileCoreAdvantageFilled(profile: Record<string, unknown> | null | undefined): boolean {
  const keyPoints = [
    ...parseLines(profile?.keyPoints),
    ...parseLines(profile?.coreSellingPoints),
  ];
  return keyPoints.length > 0;
}

export function formatT0ProfileBlockingMessage(missingLabels: string[]): string {
  if (missingLabels.length === 0) return T0_PROFILE_ENHANCEMENT_SUGGESTION;
  return "请先完善品牌资产建档中的基础信息，再启动 AI 现状检测";
}

/** P0 必填 6 项；customerPains / keyPoints 不纳入阻断 missingLabels */
export function evaluateGeoProfileP0Readiness(
  profile: Record<string, unknown> | null | undefined,
): GeoProfileP0Readiness {
  if (!profile) {
    return {
      complete: false,
      missingLabels: ["企业名称", "所属行业", "一句话介绍", "核心产品/服务", "目标客户", "关键词"],
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

export type T0ProfileReadiness = {
  ready: boolean;
  missingLabels: string[];
};

/** AI 现状检测入口：基础字段 + 竞品；customerPains 空值不阻断 */
export function evaluateProfileReadinessForT0(input: {
  profile: Record<string, unknown> | null | undefined;
  project?: {
    enterpriseName?: string | null;
    industry?: string | null;
    productIntro?: string | null;
    targetCustomers?: string | null;
    competitorNames?: string[] | null;
  } | null;
}): T0ProfileReadiness {
  const mapped = extractProfileForQuestionGeneration(input);
  const missingLabels: string[] = [];

  if (!mapped.brandName.trim()) missingLabels.push("企业名称");
  if (!mapped.industryTag.trim()) missingLabels.push("所属行业");
  if (!mapped.productDesc.trim()) missingLabels.push("核心产品/服务");
  if (!mapped.targetCustomer.trim()) missingLabels.push("目标客户");
  if (mapped.competitors.length === 0) missingLabels.push("竞品");

  return { ready: missingLabels.length === 0, missingLabels };
}

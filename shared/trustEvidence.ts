export const TRUST_EVIDENCE_TYPES = [
  { value: "case", label: "客户案例" },
  { value: "certificate", label: "资质证书" },
  { value: "media_coverage", label: "媒体报道" },
  { value: "customer_review", label: "客户评价" },
  { value: "partnership", label: "合作背书" },
  { value: "award", label: "荣誉奖项" },
  { value: "data_proof", label: "数据证明" },
  { value: "other", label: "其他证据" },
] as const;

export type TrustEvidenceType = (typeof TRUST_EVIDENCE_TYPES)[number]["value"];

export const TRUST_EVIDENCE_VERIFICATION_STATUSES = [
  { value: "draft", label: "草稿" },
  { value: "verified", label: "已验证" },
  { value: "rejected", label: "已驳回" },
] as const;

export type TrustEvidenceVerificationStatus =
  (typeof TRUST_EVIDENCE_VERIFICATION_STATUSES)[number]["value"];

export type TrustEvidenceItemRow = {
  id: number;
  projectId: number;
  evidenceType: TrustEvidenceType;
  title: string;
  summary: string | null;
  content: string | null;
  sourceUrl: string | null;
  isPublic: boolean;
  verificationStatus: TrustEvidenceVerificationStatus;
  displayOrder: number;
  linkedCustomerCaseId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/** 列表分组：案例 / 媒体 / 证书 / 评价 / 背书 / 数据 / 其他 */
export const TRUST_EVIDENCE_TYPE_GROUPS = [
  { key: "case", label: "案例", types: ["case"] as const },
  { key: "media", label: "媒体", types: ["media_coverage"] as const },
  { key: "certificate", label: "证书", types: ["certificate"] as const },
  { key: "review", label: "评价", types: ["customer_review"] as const },
  { key: "endorsement", label: "背书", types: ["partnership", "award"] as const },
  { key: "data", label: "数据", types: ["data_proof"] as const },
  { key: "other", label: "其他", types: ["other"] as const },
] as const;

export type TrustEvidenceMaturityBreakdown = {
  verifiedCount: number;
  draftCount: number;
  rejectedCount: number;
  totalTrustEvidenceCount: number;
  customerCaseCount: number;
  baseScore: number;
  customerCaseBonus: number;
};

export type TrustEvidenceMaturityResult = {
  score: number;
  breakdown: TrustEvidenceMaturityBreakdown;
  suggestions: string[];
};

export function resolveTrustEvidenceTypeLabel(type: string): string {
  return TRUST_EVIDENCE_TYPES.find(item => item.value === type)?.label ?? type;
}

export function resolveTrustEvidenceVerificationLabel(status: string): string {
  return TRUST_EVIDENCE_VERIFICATION_STATUSES.find(item => item.value === status)?.label ?? status;
}

export function computeTrustEvidenceBaseScore(input: {
  verifiedCount: number;
  draftCount: number;
  totalTrustEvidenceCount: number;
}): number {
  const { verifiedCount, draftCount, totalTrustEvidenceCount } = input;
  if (totalTrustEvidenceCount === 0) return 0;
  if (verifiedCount >= 5) return 100;
  if (verifiedCount >= 3) return 80;
  if (verifiedCount >= 1) return 50;
  if (draftCount > 0) return 20;
  return 0;
}

export function buildTrustEvidenceMaturitySuggestions(input: {
  score: number;
  verifiedCount: number;
  draftCount: number;
  totalTrustEvidenceCount: number;
  customerCaseCount: number;
}): string[] {
  const suggestions: string[] = [];
  if (input.totalTrustEvidenceCount === 0 && input.customerCaseCount === 0) {
    suggestions.push("添加媒体报道、客户评价或资质证书，帮助 AI 判断为什么应该推荐你。");
    return suggestions;
  }
  if (input.verifiedCount < 5) {
    suggestions.push(`已验证信任证据 ${input.verifiedCount} 条，建议至少积累 5 条已验证证据以提升推荐可信度。`);
  }
  if (input.draftCount > 0 && input.verifiedCount < 3) {
    suggestions.push("将草稿证据核对来源后标记为「已验证」，可快速提升信任维度得分。");
  }
  if (input.customerCaseCount === 0) {
    suggestions.push("补充至少 1 条客户案例，可获得额外 10 分信任维度加分。");
  }
  if (input.score >= 80 && suggestions.length === 0) {
    suggestions.push("信任证据较充分，可定期更新媒体报道与客户评价保持 AI 引用新鲜度。");
  }
  return suggestions;
}

export function computeTrustEvidenceMaturityScore(input: {
  verifiedCount: number;
  draftCount: number;
  rejectedCount: number;
  totalTrustEvidenceCount: number;
  customerCaseCount: number;
}): TrustEvidenceMaturityResult {
  const baseScore = computeTrustEvidenceBaseScore(input);
  const customerCaseBonus = input.customerCaseCount >= 1 ? 10 : 0;
  const score = Math.min(100, baseScore + customerCaseBonus);
  const breakdown: TrustEvidenceMaturityBreakdown = {
    verifiedCount: input.verifiedCount,
    draftCount: input.draftCount,
    rejectedCount: input.rejectedCount,
    totalTrustEvidenceCount: input.totalTrustEvidenceCount,
    customerCaseCount: input.customerCaseCount,
    baseScore,
    customerCaseBonus,
  };
  return {
    score,
    breakdown,
    suggestions: buildTrustEvidenceMaturitySuggestions({
      score,
      verifiedCount: input.verifiedCount,
      draftCount: input.draftCount,
      totalTrustEvidenceCount: input.totalTrustEvidenceCount,
      customerCaseCount: input.customerCaseCount,
    }),
  };
}

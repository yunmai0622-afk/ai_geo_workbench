import { evaluateOnboardingWizardCompleteness } from "@shared/onboardingWizardCompleteness";

export const assetSourceTypes = [
  "企业基础资料",
  "产品服务资料",
  "客户案例资料",
  "竞品资料",
  "合规资料",
  "内容风格资料",
  "发布策略资料",
  "通用资料",
] as const;

export const assetInputModes = ["文件上传", "文本粘贴", "人工录入"] as const;
export const assetTrustLevels = ["高", "中", "低"] as const;
export const assetParseStatuses = ["待解析", "已解析", "解析失败", "人工确认"] as const;
export const customerCaseTypes = ["真实案例", "待补充案例线索"] as const;
export const caseVerificationStatuses = ["待确认", "已确认", "不可公开", "信息不足"] as const;
export const publishReviewModes = ["全人工审核", "高分自动发布", "全自动发布"] as const;
export const platformAuthorizationStatuses = ["未配置", "待人工授权", "已授权", "已失效", "无需授权"] as const;

type EnterpriseProfileLike = Record<string, unknown>;

export type AssetSourceForEvidence = {
  id: number;
  title: string;
  sourceType: (typeof assetSourceTypes)[number];
  trustLevel: (typeof assetTrustLevels)[number];
  canUseForGeneration: number | boolean;
  manuallyConfirmed: number | boolean;
  structuredSummary: Record<string, unknown>;
  contentDigest?: string | null;
};

export type AssetEvidenceItem = {
  assetId: number;
  title: string;
  sourceType: string;
  trustLevel: string;
  summary: Record<string, unknown>;
  digest: string;
};

export function splitLines(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/\n|,|，|；|;/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function summarizeTextToStructuredSummary(text: string | undefined | null, fallbackTitle: string): Record<string, unknown> {
  const normalized = (text ?? "").trim();
  return {
    title: fallbackTitle,
    digest: normalized.slice(0, 500),
    keywords: splitLines(normalized.slice(0, 240)).slice(0, 8),
    sourceLength: normalized.length,
    generatedFrom: normalized ? "客户粘贴或上传资料摘要" : "人工录入占位摘要",
  };
}

export function calculateProfileCompletionScore(
  profile: EnterpriseProfileLike | null | undefined,
  context?: {
    questionCount?: number;
    customerCaseCount?: number;
    trustEvidenceCount?: number;
    brandSourceCount?: number;
    brandSourcePlatformCount?: number;
  },
): number {
  return evaluateOnboardingWizardCompleteness({
    profile,
    questionCount: context?.questionCount ?? 0,
    customerCaseCount: context?.customerCaseCount ?? 0,
    trustEvidenceCount: context?.trustEvidenceCount ?? 0,
    brandSourceCount: context?.brandSourceCount ?? 0,
    brandSourcePlatformCount: context?.brandSourcePlatformCount ?? 0,
  }).completionScore;
}

export function assertNoPlainCredentialKeys(input: Record<string, unknown>) {
  const unsafeKeyPattern = /(password|passwd|pwd|plain|secret|token|cookie|credentialValue|明文密码|密码)/i;
  const keys = Object.keys(input);
  const unsafeKeys = keys.filter(key => unsafeKeyPattern.test(key) && key !== "secureCredentialRef");
  if (unsafeKeys.length > 0) {
    throw new Error(`平台授权配置不能包含明文凭证字段：${unsafeKeys.join("、")}`);
  }
  const notes = typeof input.authorizationNotes === "string" ? input.authorizationNotes : "";
  if (/密码\s*[:：=]|账号密码|明文密码|cookie\s*[:：=]|token\s*[:：=]/i.test(notes)) {
    throw new Error("平台授权备注不能保存明文密码、Cookie 或 Token");
  }
  const secureCredentialRef = typeof input.secureCredentialRef === "string" ? input.secureCredentialRef : "";
  if (/password\s*[:：=]|passwd\s*[:：=]|pwd\s*[:：=]|cookie\s*[:：=]|token\s*[:：=]|账号密码|明文密码|密码\s*[:：=]/i.test(secureCredentialRef)) {
    throw new Error("平台授权凭证引用不能保存明文密码、Cookie 或 Token");
  }
}

export function sanitizePlatformAuthorizationInput<T extends Record<string, unknown>>(input: T): T & { credentialStorageMode: string } {
  assertNoPlainCredentialKeys(input);
  return {
    ...input,
    credentialStorageMode: "不保存明文凭证",
  };
}

export function validateCustomerCaseInput(input: {
  caseType: (typeof customerCaseTypes)[number];
  sourceAssetIds?: number[];
  customerName?: string;
  resultData?: string | null;
  customerFeedback?: string | null;
}) {
  const sourceAssetIds = input.sourceAssetIds ?? [];
  if (input.caseType === "真实案例" && !input.customerName?.trim()) {
    throw new Error("真实客户案例必须填写客户名称或可公开客户代称");
  }
  return {
    ...input,
    sourceAssetIds,
  };
}

export function assertAssetCanBeUsedForGeneration(asset: AssetSourceForEvidence) {
  if (!asset.canUseForGeneration) {
    throw new Error(`资料「${asset.title}」未允许用于内容生成`);
  }
  if (!asset.manuallyConfirmed) {
    throw new Error(`资料「${asset.title}」尚未人工确认，不能进入生成依据`);
  }
  if (!asset.structuredSummary || Object.keys(asset.structuredSummary).length === 0) {
    throw new Error(`资料「${asset.title}」缺少结构化摘要，不能进入生成依据`);
  }
}

export function buildAssetEvidencePack(assets: AssetSourceForEvidence[]): AssetEvidenceItem[] {
  return assets.map(asset => {
    assertAssetCanBeUsedForGeneration(asset);
    return {
      assetId: asset.id,
      title: asset.title,
      sourceType: asset.sourceType,
      trustLevel: asset.trustLevel,
      summary: asset.structuredSummary,
      digest: asset.contentDigest ?? "",
    };
  });
}

export function createUploadAssetDbRecord(input: {
  projectId: number;
  sourceType: (typeof assetSourceTypes)[number];
  title: string;
  originalFileName?: string | null;
  fileKey?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  contentDigest?: string | null;
  structuredSummary?: Record<string, unknown> | null;
  trustLevel: (typeof assetTrustLevels)[number];
  isPublic: boolean;
  canUseForGeneration: boolean;
  manuallyConfirmed: boolean;
}) {
  return {
    projectId: input.projectId,
    sourceType: input.sourceType,
    inputMode: "文件上传" as const,
    title: input.title,
    originalFileName: input.originalFileName ?? null,
    fileKey: input.fileKey ?? null,
    fileUrl: input.fileUrl ?? null,
    mimeType: input.mimeType ?? null,
    contentDigest: input.contentDigest ?? null,
    structuredSummary: input.structuredSummary ?? summarizeTextToStructuredSummary(input.contentDigest, input.title),
    trustLevel: input.trustLevel,
    parseStatus: "人工确认" as const,
    isPublic: input.isPublic ? 1 : 0,
    canUseForGeneration: input.canUseForGeneration ? 1 : 0,
    manuallyConfirmed: input.manuallyConfirmed ? 1 : 0,
    parsedAt: new Date(),
  };
}

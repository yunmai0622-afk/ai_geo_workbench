/**
 * Profile → Questions / T0 实测 统一字段映射（唯一读取入口）
 */

export type ProfileForQuestionGeneration = {
  brandName: string;
  industryTag: string;
  productDesc: string;
  targetCustomer: string;
  customerPains: string[];
  competitors: string[];
  keyPoints: string[];
  keywords: string[];
};

export type ExtractProfileInput = {
  profile: Record<string, unknown> | null | undefined;
  project?: {
    enterpriseName?: string | null;
    industry?: string | null;
    productIntro?: string | null;
    targetCustomers?: string | null;
    coreSellingPoints?: string | null;
    competitorNames?: string[] | null;
    coreKeywords?: string[] | null;
  } | null;
};

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,，、;；]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function firstNonEmpty(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const t = (c ?? "").trim();
    if (t) return t;
  }
  return "";
}

function resolveCompetitors(profile: Record<string, unknown> | null | undefined, project?: ExtractProfileInput["project"]): string[] {
  const fromProfile = stringArray(profile?.competitors);
  if (fromProfile.length > 0) return fromProfile;
  const fromProject = project?.competitorNames ?? [];
  return fromProject.map(s => s.trim()).filter(Boolean);
}

/** 从 enterprise_geo_profiles + projects 提取问题生成 / T0 编排所需字段 */
export function extractProfileForQuestionGeneration(input: ExtractProfileInput): ProfileForQuestionGeneration {
  const profile = input.profile ?? {};
  const project = input.project;

  const brandName = firstNonEmpty(
    trimString(profile.brandName),
    trimString(profile.enterpriseName),
    project?.enterpriseName,
  );

  const industryTag = firstNonEmpty(trimString(profile.industryTag), trimString(profile.industry), project?.industry);

  const productDesc = firstNonEmpty(
    trimString(profile.productDesc),
    trimString(profile.productServiceIntro),
    trimString(profile.productIntro),
    trimString(profile.oneLiner),
    project?.productIntro,
    project?.coreSellingPoints,
  );

  const targetCustomer = firstNonEmpty(
    trimString(profile.targetCustomer),
    trimString(profile.targetCustomers),
    project?.targetCustomers,
  );

  const customerPains = stringArray(profile.customerPains);

  const competitors = resolveCompetitors(profile, project);

  const keyPoints = [
    ...stringArray(profile.keyPoints),
    ...stringArray(profile.coreSellingPoints),
    ...(project?.coreSellingPoints ? [project.coreSellingPoints.trim()].filter(Boolean) : []),
  ];

  const keywords = [
    ...stringArray(profile.keywords),
    ...stringArray(profile.coreKeywords),
    ...(project?.coreKeywords ?? []),
  ];

  return {
    brandName,
    industryTag,
    productDesc,
    targetCustomer,
    customerPains,
    competitors,
    keyPoints: Array.from(new Set(keyPoints)),
    keywords: Array.from(new Set(keywords)),
  };
}

import type { PlatformContentStrategyInput } from "./platformContentRules";

/** 占位文案不计入「已填写」 */
const PLACEHOLDER_PATTERN = /^(待补充|待完善|暂无|未填写|无|n\/a)$/i;

export function isMeaningfulProfileText(value: string | undefined | null): boolean {
  const text = (value ?? "").trim();
  if (!text) return false;
  return !PLACEHOLDER_PATTERN.test(text);
}

function firstMeaningful(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    if (isMeaningfulProfileText(c)) return c!.trim();
  }
  return "";
}

export type EnterpriseProfileReadinessInput = {
  project?: {
    enterpriseName?: string | null;
    productIntro?: string | null;
    targetCustomers?: string | null;
    industry?: string | null;
  } | null;
  profile?: Record<string, unknown> | null;
  platformStrategy?: PlatformContentStrategyInput;
};

export type EnterpriseProfileReadinessResult = {
  ready: boolean;
  missingLabels: string[];
  resolved: {
    brandName: string;
    companyIntro: string;
    productService: string;
    targetCustomer: string;
    targetQuestion: string;
  };
};

/** 与 server/geoArticleLogic.resolveEnterpriseProfileForContent 字段口径对齐（共享层不 import server） */
function resolveProfileStrings(profile: Record<string, unknown> | null | undefined) {
  const p = profile ?? {};
  const pick = (primary: unknown, ...fallbacks: unknown[]) => {
    for (const v of [primary, ...fallbacks]) {
      const t = typeof v === "string" ? v.trim() : "";
      if (isMeaningfulProfileText(t)) return t;
    }
    return "";
  };
  const brandName = pick(p.brandName, p.enterpriseName);
  const productDesc = pick(p.productDesc, p.productServiceIntro, p.productIntro);
  const targetCustomer = pick(p.targetCustomer, p.targetCustomers);
  const oneLiner = pick(p.oneLiner, p.coreSellingPoints);
  const keyPoints = Array.isArray(p.keyPoints)
    ? (p.keyPoints as unknown[]).filter((x): x is string => typeof x === "string" && isMeaningfulProfileText(x))
    : [];
  const keywords = Array.isArray(p.keywords)
    ? (p.keywords as unknown[]).filter((x): x is string => typeof x === "string" && isMeaningfulProfileText(x))
    : [];
  return { brandName, productDesc, targetCustomer, oneLiner, keyPoints, keywords };
}

export function evaluateEnterpriseProfileReadiness(input: EnterpriseProfileReadinessInput): EnterpriseProfileReadinessResult {
  const resolvedProfile = resolveProfileStrings(input.profile);
  const project = input.project ?? {};

  const brandName = firstMeaningful(
    resolvedProfile.brandName,
    project.enterpriseName,
    typeof input.profile?.enterpriseName === "string" ? input.profile.enterpriseName : "",
  );

  const productService = firstMeaningful(
    resolvedProfile.productDesc,
    project.productIntro,
    resolvedProfile.oneLiner,
    typeof input.profile?.productServiceIntro === "string" ? input.profile.productServiceIntro : "",
    typeof input.profile?.coreProductService === "string" ? input.profile.coreProductService : "",
  );

  const oneLinerText = firstMeaningful(
    resolvedProfile.oneLiner,
    typeof input.profile?.oneLineIntro === "string" ? input.profile.oneLineIntro : "",
  );

  const companyIntro = firstMeaningful(
    oneLinerText,
    resolvedProfile.productDesc,
    typeof input.profile?.companyIntro === "string" ? input.profile.companyIntro : "",
    typeof input.profile?.companyDescription === "string" ? input.profile.companyDescription : "",
  );

  const hasCompanyIntro =
    Boolean(companyIntro) || (Boolean(brandName) && Boolean(oneLinerText || productService));

  const targetCustomer = firstMeaningful(
    resolvedProfile.targetCustomer,
    project.targetCustomers,
  );

  const pains = Array.isArray(input.profile?.customerPains)
    ? (input.profile!.customerPains as unknown[]).filter((x): x is string => typeof x === "string" && isMeaningfulProfileText(x))
    : [];

  const targetQuestion = firstMeaningful(
    input.platformStrategy?.targetQuestion,
    pains[0],
    oneLinerText,
    resolvedProfile.keywords[0],
    Array.isArray(input.profile?.commonQuestions)
      ? (input.profile!.commonQuestions as unknown[]).find((x): x is string => typeof x === "string" && isMeaningfulProfileText(x))
      : "",
  );

  const missingLabels: string[] = [];
  if (!brandName) missingLabels.push("企业名称");
  if (!hasCompanyIntro) missingLabels.push("企业介绍");
  if (!productService) missingLabels.push("产品服务");
  if (!targetCustomer) missingLabels.push("目标客户");
  if (input.platformStrategy && !targetQuestion) missingLabels.push("目标问题");

  return {
    ready: missingLabels.length === 0,
    missingLabels,
    resolved: {
      brandName,
      companyIntro: companyIntro || oneLinerText || productService || brandName,
      productService: productService || oneLinerText || companyIntro,
      targetCustomer,
      targetQuestion,
    },
  };
}

export function formatEnterpriseProfileMissingError(missingLabels: string[]): string {
  if (missingLabels.length === 0) {
    return "企业资料不足，暂时无法生成内容。请先完善企业介绍、产品服务和目标问题后再重试。";
  }
  return `企业资料还缺少：${missingLabels.join("、")}。请先完善后再生成。`;
}

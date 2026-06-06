import {
  QUESTION_TEMPLATE_FIELD_LABELS,
  type QuestionTemplateFieldKey,
  type QuestionTemplateFillResult,
  type QuestionTemplatePreviewProfileResult,
  type QuestionTemplateVariables,
  buildQuestionTemplateVariables,
  fillQuestionTemplatePrompt,
  formatMissingTemplateFieldLabel,
} from "./questionContentTemplates";
import { isMeaningfulProfileText } from "./platformContentProfileReadiness";

export type TemplateProjectLike = {
  enterpriseName?: string | null;
  productIntro?: string | null;
  targetCustomers?: string | null;
  industry?: string | null;
  coreSellingPoints?: string | null;
};

const PLACEHOLDER_PATTERN = /^(待补充|待完善|暂无|未填写|无|n\/a)$/i;

function cleanText(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text || PLACEHOLDER_PATTERN.test(text)) return "";
  return text;
}

function profileString(profile: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  const p = profile ?? {};
  for (const key of keys) {
    const value = p[key];
    if (typeof value === "string" && isMeaningfulProfileText(value)) return value.trim();
  }
  return "";
}

function profileStringList(profile: Record<string, unknown> | null | undefined, key: string): string[] {
  const value = profile?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && isMeaningfulProfileText(item));
}

export function isLikelyGeoSystemProductCopy(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  const markers = ["GEO", "诊断", "内容生成", "质量评分", "发布检查"];
  const hits = markers.filter(marker => normalized.includes(marker)).length;
  return hits >= 2 || (normalized.includes("GEO") && normalized.includes("诊断"));
}

function pickProductValue(project?: TemplateProjectLike | null, profile?: Record<string, unknown> | null): string {
  const fromProfile = profileString(profile, "productDesc", "productServiceIntro", "productIntro", "oneLiner");
  if (fromProfile) return fromProfile;
  const fromProject = cleanText(project?.productIntro);
  if (fromProject && !isLikelyGeoSystemProductCopy(fromProject)) return fromProject;
  const keyPoints = profileStringList(profile, "keyPoints");
  if (keyPoints.length > 0) return keyPoints.join("；");
  return "";
}

function pickTargetCustomer(project?: TemplateProjectLike | null, profile?: Record<string, unknown> | null): string {
  const fromProfile = profileString(profile, "targetCustomer", "targetCustomers");
  if (fromProfile) return fromProfile;
  return cleanText(project?.targetCustomers);
}

function pickCoreAdvantage(project?: TemplateProjectLike | null, profile?: Record<string, unknown> | null): string {
  const keyPoints = profileStringList(profile, "keyPoints");
  if (keyPoints.length > 0) return keyPoints.join("；");
  const fromProfile = profileString(profile, "oneLiner", "coreSellingPoints", "coreAdvantage");
  if (fromProfile) return fromProfile;
  return cleanText(project?.coreSellingPoints);
}

export function resolveQuestionTemplatePreviewProfile(input: {
  project?: TemplateProjectLike | null;
  profile?: Record<string, unknown> | null;
}): QuestionTemplatePreviewProfileResult {
  const project = input.project ?? null;
  const profile = input.profile ?? null;

  const brand = profileString(profile, "brandName", "enterpriseName") || cleanText(project?.enterpriseName);
  const product = pickProductValue(project, profile);
  const targetCustomer = pickTargetCustomer(project, profile);
  const industry = profileString(profile, "industryTag", "industry") || cleanText(project?.industry);
  const coreAdvantage = pickCoreAdvantage(project, profile);

  const rawInputs: Record<QuestionTemplateFieldKey, string> = {
    brand,
    product,
    targetCustomer,
    industry,
    coreAdvantage,
  };
  const missingFieldLabels: string[] = [];
  const usedFields: QuestionTemplateFieldKey[] = [];

  (Object.keys(QUESTION_TEMPLATE_FIELD_LABELS) as QuestionTemplateFieldKey[]).forEach(key => {
    if (cleanText(rawInputs[key])) {
      usedFields.push(key);
    } else {
      missingFieldLabels.push(QUESTION_TEMPLATE_FIELD_LABELS[key]);
    }
  });

  const rawVariables = buildQuestionTemplateVariables({ ...rawInputs, markMissing: true });
  const enterpriseName = brand || cleanText(project?.enterpriseName) || profileString(profile, "enterpriseName");

  return {
    enterpriseName,
    rawVariables,
    usedFields,
    missingFieldLabels,
    rawInputs,
  };
}

export function fillTemplateWithProjectProfile(
  promptTemplate: string,
  input: { project?: TemplateProjectLike | null; profile?: Record<string, unknown> | null },
): QuestionTemplateFillResult {
  const resolved = resolveQuestionTemplatePreviewProfile(input);
  const filledPrompt = fillQuestionTemplatePrompt(promptTemplate, resolved.rawVariables);
  const missingMarkers = Object.values(QUESTION_TEMPLATE_FIELD_LABELS)
    .map(label => formatMissingTemplateFieldLabel(label))
    .filter(marker => filledPrompt.includes(marker));

  return {
    filledPrompt,
    enterpriseName: resolved.enterpriseName,
    usedFields: resolved.usedFields,
    missingFieldLabels: resolved.missingFieldLabels,
    missingMarkers,
    rawVariables: resolved.rawVariables,
  };
}

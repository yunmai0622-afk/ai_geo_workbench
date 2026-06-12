import { getArticlePublishPlatform } from "./articlePublishPlatform";

const VARIANT_TITLE_SUFFIX_RE = / · 延伸篇(\d+)$/;

export function parseWeeklyVariantTitleSuffix(title: string): { baseTitle: string; variantNumber: number | null } {
  const trimmed = title.trim();
  const match = trimmed.match(VARIANT_TITLE_SUFFIX_RE);
  if (!match) return { baseTitle: trimmed, variantNumber: null };
  const variantNumber = Number.parseInt(match[1] ?? "", 10);
  const baseTitle = trimmed.slice(0, -match[0].length).trim();
  return {
    baseTitle: baseTitle || trimmed,
    variantNumber: Number.isFinite(variantNumber) ? variantNumber : null,
  };
}

export function articleHasAssignedTargetPublishPlatform(
  generationBasis?: Record<string, unknown> | null,
): boolean {
  const ps = generationBasis?.platformContentStrategy;
  if (!ps || typeof ps !== "object") return false;
  const meta = ps as Record<string, unknown>;
  return typeof meta.targetPublishPlatform === "string" && meta.targetPublishPlatform.trim().length > 0;
}

/** 客户可见标题：去掉内部「延伸篇 N」，平台篇只保留基础标题，备选变体显示「备选版本 N」。 */
export function formatWeeklyArticleCustomerTitle(input: {
  title?: string | null;
  generationBasis?: Record<string, unknown> | null;
  targetPlatform?: string | null;
  publishPlatform?: string | null;
}): string {
  const raw = (input.title ?? "").trim();
  if (!raw) return "未命名内容";

  const { baseTitle, variantNumber } = parseWeeklyVariantTitleSuffix(raw);
  if (variantNumber == null) return raw;

  if (articleHasAssignedTargetPublishPlatform(input.generationBasis)) {
    return baseTitle;
  }

  const platformResolved = getArticlePublishPlatform({
    generationBasis: input.generationBasis ?? null,
    targetPlatform: input.targetPlatform,
    publishPlatform: input.publishPlatform,
  });
  if (platformResolved.recognized) {
    return baseTitle;
  }

  return `${baseTitle}（备选版本${variantNumber}）`;
}

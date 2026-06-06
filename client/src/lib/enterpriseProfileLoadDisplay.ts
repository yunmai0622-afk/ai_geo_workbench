import { GENERIC_LOAD_FAILED_MESSAGE } from "@shared/userFacingErrors";

export const PROFILE_CORE_LOAD_FAILED_MESSAGE =
  "企业资料暂时无法加载，请刷新页面或稍后重试。";

export const PROFILE_NON_CRITICAL_SUMMARY_HINT =
  "部分辅助数据暂未同步，你仍可继续编辑与保存；保存成功后会自动刷新。";

export function shouldShowProfileCoreLoadFailure(params: {
  summaryError: boolean;
  hasSummaryData: boolean;
  isFetched: boolean;
  hasRenderableProfile: boolean;
}): boolean {
  return (
    params.summaryError &&
    !params.hasSummaryData &&
    params.isFetched &&
    !params.hasRenderableProfile
  );
}

export function shouldShowProfileNonCriticalSummaryHint(params: {
  summaryError: boolean;
  hasRenderableProfile: boolean;
  profileCompletenessPercent: number;
}): boolean {
  if (!params.summaryError) return false;
  if (params.profileCompletenessPercent >= 100) return false;
  return params.hasRenderableProfile;
}

export function profileSaveFailureMessage(raw?: string | null): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed && trimmed !== GENERIC_LOAD_FAILED_MESSAGE) return trimmed;
  return "保存失败，请稍后重试。";
}

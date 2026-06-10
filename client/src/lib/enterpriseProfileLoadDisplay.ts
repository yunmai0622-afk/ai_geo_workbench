import { GENERIC_LOAD_FAILED_MESSAGE, toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";

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
  if (trimmed.includes("enterpriseName") || trimmed.includes("Required")) {
    return "请填写企业名称后再保存。";
  }
  if (trimmed.includes("monthlyContentCapacity")) {
    return "请选择每月可配合内容数，或稍后重试保存。";
  }
  if (trimmed && trimmed !== GENERIC_LOAD_FAILED_MESSAGE) return trimmed;
  return "保存失败，请稍后重试。";
}

function extractTrpcErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message ?? "").trim();
  }
  return "";
}

/** 建档向导「保存草稿」失败时的客户化提示 */
export function formatWizardSaveDraftError(err: unknown): string {
  const raw = extractTrpcErrorMessage(err);
  const mapped = profileSaveFailureMessage(raw);
  if (mapped !== "保存失败，请稍后重试。") return mapped;

  const friendly = toUserFacingErrorFromUnknown(err, "");
  if (friendly && friendly !== "操作失败，请稍后重试。若问题持续，请联系服务人员。") {
    return friendly.startsWith("保存失败") ? friendly : `保存失败：${friendly}`;
  }
  return profileSaveFailureMessage(friendly || raw);
}

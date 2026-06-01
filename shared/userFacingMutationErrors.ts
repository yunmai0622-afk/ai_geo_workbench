import {
  looksLikeInternalTechnicalError,
  toUserFacingErrorFromUnknown,
} from "./userFacingErrors";

/** 用户可见的创建项目失败文案（禁止透出 SQL / 工程字段） */
export const CREATE_PROJECT_FAILED_USER_MESSAGE =
  "创建失败，请检查信息后重试。若问题持续，请联系服务人员。";

export function looksLikeInternalDatabaseError(message: string): boolean {
  return looksLikeInternalTechnicalError(message);
}

export function toUserFacingCreateProjectError(err: unknown): string {
  return toUserFacingErrorFromUnknown(err, CREATE_PROJECT_FAILED_USER_MESSAGE);
}

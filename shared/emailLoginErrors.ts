import { toUserFacingErrorFromUnknown } from "./userFacingErrors";

export const EMAIL_LOGIN_INVALID_CREDENTIALS = "邮箱或密码错误";

function isUnauthorizedLoginError(err: object): boolean {
  if ("data" in err && err.data && typeof err.data === "object" && "code" in err.data) {
    return (err.data as { code?: string }).code === "UNAUTHORIZED";
  }
  return false;
}

/** 邮箱登录失败：凭证错误固定文案，其它错误过滤技术信息 */
export function toEmailLoginErrorMessage(
  err: unknown,
  fallback = "登录失败，请稍后重试",
): string {
  if (err && typeof err === "object") {
    if (isUnauthorizedLoginError(err)) {
      return EMAIL_LOGIN_INVALID_CREDENTIALS;
    }
    const msg = "message" in err ? String((err as { message: unknown }).message ?? "").trim() : "";
    if (msg === EMAIL_LOGIN_INVALID_CREDENTIALS) {
      return EMAIL_LOGIN_INVALID_CREDENTIALS;
    }
  }
  return toUserFacingErrorFromUnknown(err, fallback);
}

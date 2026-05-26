/** 用户可见的创建项目失败文案（禁止透出 SQL / 工程字段） */
export const CREATE_PROJECT_FAILED_USER_MESSAGE =
  "创建失败，请检查信息后重试。若问题持续，请联系服务人员。";

const INTERNAL_ERROR_MARKERS = [
  "failed query",
  "insert into",
  "update ",
  "delete from",
  "owneruserid",
  "projectid",
  "params:",
  "sqlstate",
  "er_",
  "drizzle",
  "stack trace",
  "at ",
  "unknown column",
  "foreign key",
  "duplicate entry",
] as const;

export function looksLikeInternalDatabaseError(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (!lower) return false;
  return INTERNAL_ERROR_MARKERS.some(marker => lower.includes(marker));
}

export function toUserFacingCreateProjectError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message: unknown }).message ?? "");
    if (message && !looksLikeInternalDatabaseError(message)) {
      return message;
    }
  }
  return CREATE_PROJECT_FAILED_USER_MESSAGE;
}

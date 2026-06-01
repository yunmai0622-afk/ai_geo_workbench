/** 前端用户可见错误文案 — 过滤 SQL / 堆栈 / 内部 ID / TRPC 码等技术信息 */

export const GENERIC_OPERATION_FAILED_MESSAGE =
  "操作失败，请稍后重试。若问题持续，请联系服务人员。";

export const GENERIC_LOAD_FAILED_MESSAGE = "暂时无法加载，请刷新页面后重试。";

export const GENERIC_SERVICE_UNAVAILABLE_MESSAGE = "服务暂时不可用，请稍后重试。";

const INTERNAL_MARKERS = [
  "failed query",
  "insert into",
  "update ",
  "delete from",
  "select ",
  "sqlstate",
  "drizzle",
  "unknown column",
  "foreign key",
  "duplicate entry",
  "stack trace",
  "at /",
  " at object.",
  " at module.",
  "owneruserid",
  "params:",
  "er_",
  "trpcerror",
  "internal server error",
  "unexpected token",
  "syntaxerror",
  "typeerror",
  "referenceerror",
  "127.0.0.1",
  "localhost:",
  ":39888",
  "err_connection",
  "econnrefused",
  "failed to fetch",
  "networkerror",
  "net::err",
] as const;

const TRPC_CODE_PATTERN =
  /\b(UNAUTHORIZED|NOT_FOUND|BAD_REQUEST|FORBIDDEN|INTERNAL_SERVER_ERROR|TIMEOUT|CONFLICT|PRECONDITION_FAILED|PARSE_ERROR|METHOD_NOT_SUPPORTED|PAYLOAD_TOO_LARGE|UNPROCESSABLE_CONTENT)\b/i;

const TECHNICAL_FIELD_PATTERN =
  /\b(rawAnswer|projectId|roundId|questionId|tenantId|ownerUserId|articleId|taskId|adapterId|providerId)\b/i;

const ENGINEERING_TERM_PATTERN =
  /\b(mock(?:ed|ing)?|schema(?:validation|error)?|(?:llm|ai)[_-]?provider|(?:api[_-]?)?adapter)\b/i;

export function looksLikeInternalTechnicalError(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (TRPC_CODE_PATTERN.test(trimmed)) return true;
  if (TECHNICAL_FIELD_PATTERN.test(trimmed)) return true;
  if (ENGINEERING_TERM_PATTERN.test(lower)) return true;
  if (INTERNAL_MARKERS.some(marker => lower.includes(marker))) return true;
  if (trimmed.length > 200 && /[\n\r]/.test(trimmed)) return true;
  if (trimmed.length > 320) return true;
  return false;
}

/** 将原始错误字符串映射为客户可读提示；业务文案原样保留，技术信息替换为 fallback */
export function toUserFacingError(
  raw: string | undefined | null,
  fallback: string = GENERIC_OPERATION_FAILED_MESSAGE,
): string {
  const message = (raw ?? "").trim();
  if (!message) return fallback;
  if (looksLikeInternalTechnicalError(message)) return fallback;
  return message;
}

export function toUserFacingErrorFromUnknown(
  err: unknown,
  fallback: string = GENERIC_OPERATION_FAILED_MESSAGE,
): string {
  if (typeof err === "string") return toUserFacingError(err, fallback);
  if (err && typeof err === "object" && "message" in err) {
    return toUserFacingError(String((err as { message: unknown }).message ?? ""), fallback);
  }
  return fallback;
}

/** 查询类错误：优先保留业务提示，否则给出加载失败文案 */
export function toUserFacingQueryError(
  raw: string | undefined | null,
  fallback: string = GENERIC_LOAD_FAILED_MESSAGE,
): string {
  return toUserFacingError(raw, fallback);
}

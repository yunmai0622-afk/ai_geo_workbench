/** 平台稿异步生成状态（存于 geo_articles.generationBasis） */

export const PLATFORM_DRAFT_STATUSES = [
  "not_started",
  "queued",
  "generating",
  "generated",
  "failed",
] as const;

export type PlatformDraftStatus = (typeof PLATFORM_DRAFT_STATUSES)[number];

export const PLATFORM_DRAFT_GENERATION_TIMEOUT_MS = 180_000;

export const PLATFORM_DRAFT_START_MESSAGE = "已开始生成";

export const PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE =
  "本次生成耗时较长，系统已停止等待。你可以稍后重试";

export const PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE = "本次内容生成失败，可以重新生成";

export const PLATFORM_DRAFT_SERIAL_BUSY_MESSAGE =
  "当前已有平台稿正在生成，完成后可继续生成其他平台。";

export const PLATFORM_DRAFT_GENERATION_BASIS_KEY = "platformDraftGeneration";

export type PlatformDraftGenerationRecord = {
  status: PlatformDraftStatus;
  platform?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  canRetry?: boolean;
};

export type PlatformDraftGenerationStatusView = {
  platform: string | null;
  status: PlatformDraftStatus;
  articleId: number;
  errorMessage: string | null;
  canRetry: boolean;
  updatedAt: string | null;
};

export function readPlatformDraftGeneration(
  basis: Record<string, unknown> | null | undefined,
): PlatformDraftGenerationRecord | null {
  const raw = basis?.[PLATFORM_DRAFT_GENERATION_BASIS_KEY];
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const status = record.status;
  if (typeof status !== "string" || !PLATFORM_DRAFT_STATUSES.includes(status as PlatformDraftStatus)) {
    return null;
  }
  return {
    status: status as PlatformDraftStatus,
    platform: typeof record.platform === "string" ? record.platform : null,
    startedAt: typeof record.startedAt === "string" ? record.startedAt : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    errorMessage: typeof record.errorMessage === "string" ? record.errorMessage : null,
    errorCode: typeof record.errorCode === "string" ? record.errorCode : null,
    canRetry: record.canRetry === true || record.canRetry === false ? record.canRetry : undefined,
  };
}

export function mergePlatformDraftGeneration(
  basis: Record<string, unknown> | null | undefined,
  patch: Partial<PlatformDraftGenerationRecord>,
): Record<string, unknown> {
  const prev = readPlatformDraftGeneration(basis) ?? { status: "not_started" as const };
  const next: PlatformDraftGenerationRecord = {
    ...prev,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
  return {
    ...(basis ?? {}),
    [PLATFORM_DRAFT_GENERATION_BASIS_KEY]: next,
  };
}

export function isPlatformDraftInFlight(status: PlatformDraftStatus | null | undefined): boolean {
  return status === "queued" || status === "generating";
}

export function resolvePlatformDraftCustomerErrorMessage(input: {
  errorCode?: string | null;
  errorMessage?: string | null;
}): string | null {
  const code = input.errorCode?.trim();
  if (code === "timeout") return PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE;
  if (code === "not_configured" || code === "auth_failed" || code === "provider_error") {
    return "内容生成服务暂时不可用，请稍后再试";
  }
  const msg = input.errorMessage?.trim();
  if (!msg) return PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE;
  if (/联系管理员|联系服务人员|provider|api key|stack trace|undefined|null/i.test(msg)) {
    return PLATFORM_DRAFT_GENERATION_FAILED_MESSAGE;
  }
  return msg;
}

export function applyPlatformDraftTimeoutIfNeeded(
  record: PlatformDraftGenerationRecord | null,
  nowMs = Date.now(),
): PlatformDraftGenerationRecord | null {
  if (!record || !isPlatformDraftInFlight(record.status)) return record;
  const startedAt = record.startedAt ? Date.parse(record.startedAt) : NaN;
  if (!Number.isFinite(startedAt)) return record;
  if (nowMs - startedAt < PLATFORM_DRAFT_GENERATION_TIMEOUT_MS) return record;
  return {
    ...record,
    status: "failed",
    errorCode: "timeout",
    errorMessage: PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE,
    canRetry: true,
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function buildPlatformDraftStatusView(
  articleId: number,
  record: PlatformDraftGenerationRecord | null,
  platformFallback: string | null,
): PlatformDraftGenerationStatusView {
  const timed = applyPlatformDraftTimeoutIfNeeded(record);
  const status = timed?.status ?? "not_started";
  const errorMessage =
    status === "failed"
      ? resolvePlatformDraftCustomerErrorMessage({
          errorCode: timed?.errorCode,
          errorMessage: timed?.errorMessage,
        })
      : null;
  return {
    platform: timed?.platform ?? platformFallback,
    status,
    articleId,
    errorMessage,
    canRetry: status === "failed" ? timed?.canRetry !== false : false,
    updatedAt: timed?.updatedAt ?? null,
  };
}

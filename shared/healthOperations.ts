/** 发布队列中仍占用/待处理的状态（不含 completed / failed） */
export const PUBLISH_QUEUE_ACTIVE_STATUSES = [
  "pending",
  "pending_agent",
  "pending_publish",
  "copied",
  "agent_processing",
  "processing",
  "session_expired",
  "manual_required",
  "draft_saved",
] as const;

export type PublishQueueActiveStatus = (typeof PUBLISH_QUEUE_ACTIVE_STATUSES)[number];

export function isPublishQueueActiveStatus(status: string): boolean {
  return (PUBLISH_QUEUE_ACTIVE_STATUSES as readonly string[]).includes(status);
}

export type HealthOperationCheck = {
  ok: boolean;
  message?: string;
  /** ISO 8601 */
  at?: string;
};

const MIN_GENERATED_BODY_CHARS = 50;

export function evaluateLastContentGeneration(input: {
  markdownContent: string;
  createdAt: Date | string | null | undefined;
} | null): HealthOperationCheck {
  if (!input) {
    return { ok: false, message: "尚无内容生成记录" };
  }
  const at = toIsoTimestamp(input.createdAt);
  const bodyLen = input.markdownContent.trim().length;
  if (bodyLen < MIN_GENERATED_BODY_CHARS) {
    return {
      ok: false,
      at,
      message: "最近生成记录正文为空或过短",
    };
  }
  return { ok: true, at };
}

export function evaluateLastPublish(input: {
  status: string;
  updatedAt: Date | string | null | undefined;
  agentFinishedAt?: Date | string | null;
  errorMessage?: string | null;
} | null): HealthOperationCheck {
  if (!input) {
    return { ok: false, message: "尚无发布任务记录" };
  }
  const at = toIsoTimestamp(input.agentFinishedAt ?? input.updatedAt);
  if (input.status === "completed") {
    return { ok: true, at };
  }
  if (input.status === "failed") {
    const detail = input.errorMessage?.trim();
    return {
      ok: false,
      at,
      message: detail ? `发布失败：${truncate(detail, 120)}` : "发布失败",
    };
  }
  return {
    ok: false,
    at,
    message: `发布未完成（${input.status}）`,
  };
}

function toIsoTimestamp(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

import { toast } from "sonner";

const recentErrorToasts = new Map<string, number>();
const DEDUP_WINDOW_MS = 1000;

/** 相同 error 文案在窗口期内只弹出一次 */
export function toastErrorDeduped(message: string, windowMs = DEDUP_WINDOW_MS): void {
  const text = message.trim();
  if (!text) return;
  const now = Date.now();
  const lastAt = recentErrorToasts.get(text);
  if (lastAt != null && now - lastAt < windowMs) return;
  recentErrorToasts.set(text, now);
  toast.error(text);
}

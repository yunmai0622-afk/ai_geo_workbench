import type { RetestPhase } from "@shared/retestPlan";

const MS_PER_DAY = 86_400_000;

export const RETEST_PHASE_CUSTOMER_LABELS: Record<RetestPhase, string> = {
  T1: "7 天后复测",
  T2: "14 天后复测",
  T3: "30 天后复测",
};

export function retestPhaseCustomerLabel(phase: RetestPhase): string {
  return RETEST_PHASE_CUSTOMER_LABELS[phase] ?? phase;
}

export function daysSincePublish(publishedAt?: Date | string | number | null): number | null {
  if (!publishedAt) return null;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

export function retestPhaseStatusLabel(
  phase: RetestPhase,
  daysSince: number | null,
  tested: boolean,
): string {
  if (tested) return "已完成";
  if (daysSince == null) return "待发布";
  const threshold = phase === "T1" ? 7 : phase === "T2" ? 30 : 90;
  if (daysSince >= threshold) return "待复测";
  return "未到期";
}

export function formatMentionDelta(delta: number | null): string {
  if (delta == null) return "暂无对比";
  const pct = Math.round(delta * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

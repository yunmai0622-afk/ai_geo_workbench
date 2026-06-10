/**
 * GEO-V2.0 Step8：每月可配合内容数（4 选 1，存库为代表值）
 */

export type WizardStep8MonthlyContentOptionId = "light" | "standard" | "high" | "unsure";

export const WIZARD_STEP8_MONTHLY_CONTENT_OPTIONS: ReadonlyArray<{
  id: WizardStep8MonthlyContentOptionId;
  label: string;
  value: number;
}> = [
  { id: "light", label: "1-3篇（轻量配合）", value: 2 },
  { id: "standard", label: "4-8篇（标准节奏）", value: 6 },
  { id: "high", label: "8篇以上（高强度）", value: 9 },
  { id: "unsure", label: "暂不确定", value: 0 },
];

export function monthlyContentCapacityValueFromOptionId(
  optionId: string,
): number | null {
  const match = WIZARD_STEP8_MONTHLY_CONTENT_OPTIONS.find(option => option.id === optionId);
  return match ? match.value : null;
}

export function resolveMonthlyContentCapacityOptionId(
  stored: number | null | undefined,
): WizardStep8MonthlyContentOptionId | "" {
  if (stored == null) return "";
  const exact = WIZARD_STEP8_MONTHLY_CONTENT_OPTIONS.find(option => option.value === stored);
  if (exact) return exact.id;
  if (stored <= 3) return "light";
  if (stored <= 8) return "standard";
  return "high";
}

export function hasMonthlyContentCapacitySelection(
  stored: number | null | undefined,
): boolean {
  return typeof stored === "number";
}

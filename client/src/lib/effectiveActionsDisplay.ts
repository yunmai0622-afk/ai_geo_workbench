import {
  BINDING_PUBLISH_PLATFORMS,
  isBindingPublishPlatform,
  PUBLISH_PLATFORM_LABELS,
} from "@shared/platformAccountVerify";
import { AI_VISIBILITY_TARGET_REGISTRY } from "@shared/aiVisibilityTargets";

export const EFFECTIVE_ACTION_TYPE_LABELS: Record<string, string> = {
  content_publish: "内容发布",
  profile_update: "资料更新",
  keyword_add: "关键词补充",
  competitor_analysis: "竞品分析",
};

export const EFFECTIVE_ACTION_EFFECT_LEVEL_LABELS: Record<string, string> = {
  A_obvious: "明显有效",
  B_possible: "可能有效",
  C_no_observed_effect: "暂未观察到效果",
  D_wrong_direction: "方向有误",
  watching: "观察中",
};

export const EFFECTIVE_ACTION_CHANGE_DIRECTION_LABELS: Record<string, string> = {
  up: "上升",
  flat: "持平",
  down: "下降",
  unknown: "未知",
};

export const EFFECTIVE_ACTION_TYPE_OPTIONS = Object.entries(EFFECTIVE_ACTION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const EFFECTIVE_ACTION_EFFECT_LEVEL_OPTIONS = [
  "A_obvious",
  "B_possible",
  "C_no_observed_effect",
  "watching",
] as const;

export const EFFECTIVE_ACTION_PLATFORM_OPTIONS = [
  ...BINDING_PUBLISH_PLATFORMS.map(id => ({
    value: id,
    label: PUBLISH_PLATFORM_LABELS[id],
    group: "内容发布平台",
  })),
  ...AI_VISIBILITY_TARGET_REGISTRY.filter(p => p.status !== "not_connected").map(p => ({
    value: p.id,
    label: p.label,
    group: "AI 搜索平台",
  })),
];

export function formatEffectiveActionType(value: string | null | undefined): string {
  if (!value) return "—";
  return EFFECTIVE_ACTION_TYPE_LABELS[value] ?? value;
}

export function formatEffectiveActionEffectLevel(value: string | null | undefined): string {
  if (!value) return "—";
  return EFFECTIVE_ACTION_EFFECT_LEVEL_LABELS[value] ?? value;
}

export function formatEffectiveActionChangeDirection(value: string | null | undefined): string {
  if (!value) return "—";
  return EFFECTIVE_ACTION_CHANGE_DIRECTION_LABELS[value] ?? value;
}

export function formatEffectiveActionPlatform(value: string | null | undefined): string {
  if (!value) return "—";
  if (isBindingPublishPlatform(value)) return PUBLISH_PLATFORM_LABELS[value];
  const ai = AI_VISIBILITY_TARGET_REGISTRY.find(p => p.id === value);
  if (ai) return ai.label;
  return value;
}

export function formatEffectiveActionExecutedAt(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildDefaultActionName(actionType: string): string {
  return formatEffectiveActionType(actionType);
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

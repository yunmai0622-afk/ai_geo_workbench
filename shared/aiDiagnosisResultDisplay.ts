/** AI 实测诊断页：客户可读的结果说明与最近实测时间 */

export function formatAiDiagnosisDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const t = date.getTime();
  if (Number.isNaN(t)) return "暂无数据";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maxTimestamp(values: Array<Date | string | null | undefined>): number | null {
  let max: number | null = null;
  for (const value of values) {
    if (!value) continue;
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) continue;
    max = max == null ? t : Math.max(max, t);
  }
  return max;
}

export function resolveAiDiagnosisLastTestLabel(input: {
  analysisTimestamps?: Array<Date | string | null | undefined>;
  t0FinishedAt?: Date | string | null;
  runTestedAtList?: Array<Date | string | null | undefined>;
}): string {
  const stamps: Array<Date | string | null | undefined> = [
    ...(input.analysisTimestamps ?? []),
    input.t0FinishedAt ?? null,
    ...(input.runTestedAtList ?? []),
  ];
  const max = maxTimestamp(stamps);
  if (max == null) return "暂无数据";
  return formatAiDiagnosisDateTime(new Date(max));
}

export function diagnosisMentionRateHint(mentionPct: number | null, hasData: boolean): string {
  if (!hasData) {
    return "尚未完成 AI 搜索实测，完成 AI 能见度诊断或运行内容诊断后将展示提及率。";
  }
  if (mentionPct == null) return "";
  if (mentionPct === 0) {
    return "当前处于基线阶段：AI 在实测问题中暂未稳定提及品牌，常见于品牌实体信号不足或问题偏泛。建议补充品牌认知、竞品对比类内容，7–14 天后复测。";
  }
  return `当前品牌在实测中的提及率为 ${mentionPct}%，可作为后续优化与复测对照。`;
}

export function diagnosisRecommendRateHint(recommendPct: number | null, hasData: boolean): string {
  if (!hasData) {
    return "完成实测后将展示 AI 是否主动推荐品牌。";
  }
  if (recommendPct == null) return "";
  if (recommendPct === 0) {
    return "优化建议：AI 暂未形成稳定推荐信号。请强化差异化案例、客户证言与「品牌名 + 品类 + 场景」的可引用表述，并优先补齐行业推荐类问题对应的内容。";
  }
  return `当前品牌推荐率为 ${recommendPct}%，可继续围绕高意向问题补强案例与证据链。`;
}

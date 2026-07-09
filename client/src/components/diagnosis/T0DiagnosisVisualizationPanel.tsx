import type { ReactNode } from "react";
import type {
  GeoScoreBarItem,
  PlatformMentionItem,
  QuestionTypeHitRateItem,
  T0DiagnosisVisualization,
} from "@shared/t0DiagnosisVisualization";

function HorizontalRateBar({
  label,
  percent,
  sampleCount,
  suffix = "提及率",
}: {
  label: string;
  percent: number;
  sampleCount: number;
  suffix?: string;
}) {
  const hasSample = sampleCount > 0;
  const displayPercent = hasSample ? percent : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="shrink-0 tabular-nums text-gray-900">
          {hasSample ? `${displayPercent}%` : "暂无样本"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${hasSample ? "bg-blue-600" : "bg-gray-200"}`}
          style={{ width: `${displayPercent}%` }}
          role="progressbar"
          aria-valuenow={displayPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}${suffix} ${hasSample ? `${displayPercent}%` : "暂无样本"}`}
        />
      </div>
      {hasSample ? (
        <p className="text-[10px] text-gray-400">
          {suffix} · 样本 {sampleCount} 次
        </p>
      ) : null}
    </div>
  );
}

function SectionBlock({
  title,
  description,
  children,
  testId,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4" data-testid={testId}>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export function T0DiagnosisVisualizationPanel({ visualization }: { visualization: T0DiagnosisVisualization }) {
  return (
    <div className="space-y-4" data-testid="ai-diagnosis-visualization">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI 实测结果可视化</h2>
          <p className="mt-1 text-xs text-gray-500">
            基于 AI 能见度诊断真实数据，共 {visualization.totalRuns} 次实测
          </p>
        </div>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700">
          数据来源：AI 实测结果
        </span>
      </div>

      <SectionBlock title="GEO 评分维度" testId="ai-diagnosis-geo-score-bars">
        {visualization.geoScoreBars.map((item: GeoScoreBarItem) => (
          <HorizontalRateBar
            key={item.key}
            label={item.label}
            percent={item.percent}
            sampleCount={item.sampleCount}
            suffix={
              item.key === "industry_recommend"
                ? "推荐率"
                : item.key === "content_asset"
                  ? "引用完整度"
                  : item.key === "competitor_resistance"
                    ? "抗压制率"
                    : "提及率"
            }
          />
        ))}
      </SectionBlock>

      <SectionBlock title="问题类型命中率" testId="ai-diagnosis-question-type-hits">
        {visualization.questionTypeHitRates.map((item: QuestionTypeHitRateItem) => (
          <HorizontalRateBar
            key={item.key}
            label={item.label}
            percent={item.percent}
            sampleCount={item.sampleCount}
          />
        ))}
      </SectionBlock>

      <SectionBlock title="平台对比" testId="ai-diagnosis-platform-comparison">
        {visualization.platformComparison.map((item: PlatformMentionItem) => (
          <HorizontalRateBar
            key={item.platform}
            label={item.label}
            percent={item.percent}
            sampleCount={item.sampleCount}
          />
        ))}
      </SectionBlock>
    </div>
  );
}

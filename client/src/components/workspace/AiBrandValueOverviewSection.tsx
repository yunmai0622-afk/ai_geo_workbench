import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";
import type { MaturityWeaknessHighlight } from "@shared/maturityDetailDisplay";
import {
  AI_BRAND_STATUS_EMPTY_BULLETS,
  AI_BRAND_STATUS_EMPTY_TITLE,
  AI_BRAND_STATUS_SECTION_TITLE,
  buildCompetitivePressureCopy,
  formatAiBrandRatePercent,
  rateToPercent,
  resolveAiBrandStatusConclusion,
  WORKSPACE_METRIC_HINTS,
  type AiBrandRatePercents,
} from "@shared/workspaceBrandValueOverview";
import { ArrowRight, AlertTriangle } from "lucide-react";

export type AiBrandValueOverviewSectionProps = {
  projectId: number;
  hasDiagnosisData: boolean;
  loading?: boolean;
  maturityScore: number | null;
  mentionRate: number | null;
  recommendRate: number | null;
  competitorRate: number | null;
  topWeaknesses: MaturityWeaknessHighlight[];
  onNavigate: (path: string) => void;
};

function BrandMetricCard({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint: string;
  testId: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4" data-testid={testId}>
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-2 text-[11px] leading-4 text-gray-500">{hint}</p>
    </div>
  );
}

export function AiBrandValueOverviewSection({
  projectId,
  hasDiagnosisData,
  loading = false,
  maturityScore,
  mentionRate,
  recommendRate,
  competitorRate,
  topWeaknesses,
  onNavigate,
}: AiBrandValueOverviewSectionProps) {
  const ratePercents: AiBrandRatePercents = {
    mentionRatePct: rateToPercent(mentionRate),
    recommendRatePct: rateToPercent(recommendRate),
    competitorRatePct: rateToPercent(competitorRate),
  };
  const conclusion = resolveAiBrandStatusConclusion(ratePercents);
  const competitivePressure = buildCompetitivePressureCopy(ratePercents);

  return (
    <section
      className="geo-card border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-white p-6"
      data-testid="workspace-ai-brand-value-overview"
    >
      <h2 className="text-lg font-semibold text-gray-900" data-testid="workspace-ai-brand-status-title">
        {AI_BRAND_STATUS_SECTION_TITLE}
      </h2>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">加载 AI 品牌状态…</p>
      ) : hasDiagnosisData ? (
        <div className="mt-4 space-y-5">
          <p
            className="text-sm font-medium leading-relaxed text-gray-800"
            data-testid="workspace-ai-brand-status-conclusion"
          >
            {conclusion}
          </p>

          <div
            className={`grid gap-3 ${maturityScore != null && maturityScore > 0 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
            data-testid="workspace-ai-brand-core-metrics"
          >
            {maturityScore != null && maturityScore > 0 ? (
              <BrandMetricCard
                label="AI 品牌成熟度"
                value={`${maturityScore} 分`}
                hint={WORKSPACE_METRIC_HINTS.maturity}
                testId="workspace-ai-brand-maturity"
              />
            ) : null}
            <BrandMetricCard
              label="品牌提及率"
              value={formatAiBrandRatePercent(mentionRate)}
              hint={WORKSPACE_METRIC_HINTS.mentionRate}
              testId="workspace-ai-brand-mention-rate"
            />
            <BrandMetricCard
              label="品牌推荐率"
              value={formatAiBrandRatePercent(recommendRate)}
              hint={WORKSPACE_METRIC_HINTS.recommendRate}
              testId="workspace-ai-brand-recommend-rate"
            />
            <BrandMetricCard
              label="竞品出现率"
              value={formatAiBrandRatePercent(competitorRate)}
              hint={WORKSPACE_METRIC_HINTS.competitorRate}
              testId="workspace-ai-brand-competitor-rate"
            />
          </div>

          {competitivePressure ? (
            <div
              className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
              data-testid="workspace-competitive-pressure-copy"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{competitivePressure}</p>
            </div>
          ) : null}

          <div data-testid="workspace-ai-brand-top-weaknesses">
            <h3 className="text-sm font-semibold text-gray-900">本月最需要改善的3件事</h3>
            {topWeaknesses.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {topWeaknesses.map(item => (
                  <li
                    key={item.key}
                    className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm"
                    data-testid={`workspace-ai-brand-weakness-${item.key}`}
                  >
                    <p className="font-medium text-gray-900">
                      {item.label}：{item.conclusion}
                    </p>
                    <p className="mt-1 text-gray-600">建议动作：{item.action}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                完成AI品牌成熟度评分后可查看改善建议
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className={cn("rounded-xl", geoP0Brand.primary)}
              data-testid="workspace-ai-brand-go-diagnosis"
              onClick={() => onNavigate(buildProjectUrl("/ai-diagnosis", projectId))}
            >
              查看AI诊断报告
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              data-testid="workspace-ai-brand-go-monthly-plan"
              onClick={() => onNavigate(buildProjectUrl("/monthly-plan", projectId))}
            >
              查看本月优化计划
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4" data-testid="workspace-ai-brand-empty-state">
          <p className="text-sm font-medium text-gray-800">{AI_BRAND_STATUS_EMPTY_TITLE}</p>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 text-sm text-gray-600">
            <p>完成一次AI现状诊断后，你将看到：</p>
            <ul className="mt-2 space-y-1">
              {AI_BRAND_STATUS_EMPTY_BULLETS.map(item => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
          <Button
            type="button"
            className={cn("rounded-xl", geoP0Brand.primary)}
            data-testid="workspace-ai-brand-start-diagnosis"
            onClick={() => onNavigate(buildProjectUrl("/ai-diagnosis", projectId))}
          >
            开始AI现状诊断
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}

import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { GeoBusinessMaturityReport, GeoBusinessMaturityStatus } from "@shared/geoBusinessMaturity";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, TrendingUp } from "lucide-react";

const statusCopy: Record<GeoBusinessMaturityStatus, { label: string; className: string }> = {
  good: { label: "稳定", className: "bg-emerald-50 text-emerald-700" },
  warning: { label: "待加强", className: "bg-amber-50 text-amber-700" },
  poor: { label: "优先补齐", className: "bg-red-50 text-red-700" },
};

export function GeoBusinessMaturityCard({
  report,
  loading,
  compact = false,
  onGoMonthlyPlan,
  onGoMaturityDetail,
}: {
  report?: GeoBusinessMaturityReport | null;
  loading?: boolean;
  compact?: boolean;
  onGoMonthlyPlan?: () => void;
  onGoMaturityDetail?: () => void;
}) {
  if (loading) {
    return (
      <P0Card testId="geo-business-maturity-card" className="flex items-center gap-2 text-sm text-gray-500">
        <Spinner className="size-4 text-blue-600" />
        正在汇总 AI 品牌经营成熟度…
      </P0Card>
    );
  }

  if (!report) {
    return (
      <P0Card testId="geo-business-maturity-card">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">暂未形成成熟度报告</p>
            <p className="mt-1 text-sm text-gray-600">完成品牌档案、问题池和 AI 实测后，这里会展示经营成熟度。</p>
          </div>
        </div>
      </P0Card>
    );
  }

  const shownDimensions = compact ? report.topWeaknesses : report.dimensions;

  return (
    <P0Card testId="geo-business-maturity-card" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">AI 品牌经营成熟度</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">{report.summary}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-3xl font-bold tabular-nums text-blue-700" data-testid="geo-business-maturity-score">
            {report.totalScore}
          </p>
          <p className="text-xs font-medium text-gray-500">{report.level}</p>
        </div>
      </div>

      <div className={cn("divide-y divide-gray-100", compact ? "text-sm" : "")}>
        {shownDimensions.map(dimension => {
          const status = statusCopy[dimension.status];
          const Icon = dimension.status === "good" ? CheckCircle2 : dimension.status === "warning" ? Circle : AlertTriangle;
          return (
            <div
              key={dimension.key}
              className="grid gap-2 py-3 sm:grid-cols-[180px_1fr]"
              data-testid={`business-maturity-dimension-${dimension.key}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("size-4", dimension.status === "good" ? "text-emerald-600" : dimension.status === "warning" ? "text-amber-600" : "text-red-600")} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{dimension.name}</p>
                  <p className="text-xs text-gray-500">{dimension.score} 分</p>
                </div>
              </div>
              <div>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>
                  {status.label}
                </span>
                <p className="mt-1 text-sm leading-6 text-gray-600">{dimension.explanation}</p>
                {!compact ? (
                  <p className="mt-1 text-xs leading-5 text-gray-500">{dimension.evidence.join("；")}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {onGoMonthlyPlan ? (
          <Button type="button" size="sm" onClick={onGoMonthlyPlan} data-testid="geo-business-maturity-monthly-plan">
            制定本月优化计划
            <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        ) : null}
        {onGoMaturityDetail ? (
          <Button type="button" size="sm" variant="outline" onClick={onGoMaturityDetail}>
            查看成熟度详情
          </Button>
        ) : null}
      </div>
    </P0Card>
  );
}

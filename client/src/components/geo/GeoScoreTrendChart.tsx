import {
  buildGeoScoreTrendSvgCoords,
  formatGeoScoreTrendDateLabel,
  geoScoreTrendPolyline,
  type GeoScoreTrendPoint,
} from "@shared/geoScoreTrend";

type GeoScoreTrendChartProps = {
  points: GeoScoreTrendPoint[];
  industryAverageScore?: number | null;
  loading?: boolean;
  variant?: "light" | "dark";
  className?: string;
  "data-testid"?: string;
};

const CHART_W = 280;
const CHART_H = 88;

export function GeoScoreTrendChart({
  points,
  industryAverageScore = null,
  loading = false,
  variant = "light",
  className = "",
  "data-testid": testId = "geo-score-trend-chart",
}: GeoScoreTrendChartProps) {
  const isDark = variant === "dark";
  const muted = "text-gray-500";
  const title = isDark ? "text-white" : "text-gray-900";
  const stroke = isDark ? "#38bdf8" : "#0284c7";
  const grid = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";

  if (loading) {
    return (
      <div
        className={`animate-pulse rounded-xl ${isDark ? "bg-white/[0.06] h-36" : "bg-gray-100 h-36"} ${className}`}
        data-testid={testId}
        aria-hidden
      />
    );
  }

  if (points.length === 0) {
    return (
      <div className={className} data-testid={testId}>
        <p className={`text-sm font-medium ${title}`}>GEO 分数趋势</p>
        <p className={`mt-2 text-sm ${muted}`}>暂无评分历史，完成内容诊断并计算评分后将在此展示最近 5 次变化。</p>
      </div>
    );
  }

  const coords = buildGeoScoreTrendSvgCoords(points, CHART_W, CHART_H);
  const polyline = geoScoreTrendPolyline(coords);
  const latest = points[points.length - 1]!;
  const earliest = points[0]!;
  const delta = latest.totalScore - earliest.totalScore;
  const hasIndustryAverage = typeof industryAverageScore === "number" && Number.isFinite(industryAverageScore);
  const industryDelta = hasIndustryAverage ? latest.totalScore - industryAverageScore : null;

  const formatDiagnosticTimeLabel = (value: Date | string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间未知";
    return date.toLocaleString("zh-CN", { hour12: false });
  };

  return (
    <div className={className} data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`text-sm font-medium ${title}`}>GEO 分数趋势</p>
        <p className={`text-xs ${muted}`}>
          最近 {points.length} 次诊断
          {points.length >= 2 ? (
            <span className={delta >= 0 ? " text-emerald-600" : " text-amber-600"}>
              {" "}
              · 较最早 {delta >= 0 ? "+" : ""}
              {delta} 分
            </span>
          ) : null}
        </p>
      </div>

      {points.length === 1 ? (
        <div className="mt-2 space-y-1">
          <p className={`text-sm ${muted}`}>完成更多 AI 诊断后可查看趋势变化。</p>
          {hasIndustryAverage ? (
            <p className={`text-xs ${muted}`}>
              行业平均分 {industryAverageScore} 分
              <span className={industryDelta != null && industryDelta >= 0 ? " text-emerald-600" : " text-amber-600"}>
                {" "}
                · 当前{industryDelta != null && industryDelta >= 0 ? "高于" : "低于"}
                行业平均 {Math.abs(industryDelta ?? 0)} 分
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-24 w-full max-w-xs shrink-0"
          role="img"
          aria-label={`GEO 总分趋势，从 ${earliest.totalScore} 分到 ${latest.totalScore} 分`}
        >
          <line x1="0" y1={CHART_H / 2} x2={CHART_W} y2={CHART_H / 2} stroke={grid} strokeWidth="1" />
          {points.length > 1 ? (
            <polyline
              fill="none"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline}
            />
          ) : null}
          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r="4" fill={stroke}>
              <title>{`${formatDiagnosticTimeLabel(points[i]!.createdAt)} · ${points[i]!.totalScore} 分`}</title>
            </circle>
          ))}
        </svg>

        <ul className="flex flex-1 flex-wrap gap-2 sm:flex-col sm:gap-1.5">
          {points.map((p, i) => (
            <li
              key={`${formatGeoScoreTrendDateLabel(p.createdAt)}-${i}`}
              className="flex min-w-[5.5rem] items-center gap-2 text-xs"
            >
              <span className="h-1.5 flex-1 rounded-full bg-gray-200" style={{ maxWidth: "4rem" }} title={`${p.totalScore} 分`}>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, p.totalScore))}%`,
                    backgroundColor: stroke,
                  }}
                />
              </span>
              <span className={isDark ? "text-gray-300" : "text-gray-700"}>{p.totalScore}</span>
              <span className={muted}>{formatGeoScoreTrendDateLabel(p.createdAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

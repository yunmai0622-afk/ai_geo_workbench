import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildGeoArticleQualityDimensionDisplays,
  formatGeoArticleQualityDimensionLine,
  hasGeoArticleQualityScoreDetail,
  type GeoArticleQualityScoreRow,
} from "@shared/geoArticleQualityScoreDetail";
import type { ReactNode } from "react";

type Props = {
  qualityRow: GeoArticleQualityScoreRow | null | undefined;
  children: ReactNode;
  /** 无细则数据时是否仍允许打开（展示空态说明） */
  allowEmpty?: boolean;
  testId?: string;
};

export function GeoArticleQualityScoreDetailPopover({
  qualityRow,
  children,
  allowEmpty = true,
  testId = "geo-article-quality-score-detail",
}: Props) {
  const dimensions = buildGeoArticleQualityDimensionDisplays(qualityRow);
  const hasDetail = hasGeoArticleQualityScoreDetail(qualityRow);
  const disabled = !hasDetail && !allowEmpty;

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-0.5 rounded-sm text-left underline decoration-dotted underline-offset-2 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          data-testid={`${testId}-trigger`}
          aria-label="查看 GEO 质检评分明细"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 border-gray-200 bg-white p-3 text-gray-900 shadow-lg"
        align="start"
        data-testid={testId}
      >
        <p className="text-xs font-semibold text-gray-800">GEO 质检评分明细</p>
        <p className="mt-0.5 text-[11px] text-gray-500">数据来自内容质量检查记录</p>
        {dimensions ? (
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700" data-testid={`${testId}-list`}>
            {dimensions.map(dim => (
              <li key={dim.label}>{formatGeoArticleQualityDimensionLine(dim)}</li>
            ))}
            {typeof qualityRow?.totalScore === "number" ? (
              <li className="border-t border-gray-100 pt-2 font-medium text-gray-900">
                质量总分：{qualityRow.totalScore} 分
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-gray-500" data-testid={`${testId}-empty`}>
            暂无评分明细。请先在内容生成流程中完成质量检查，系统将把分项得分写入质检记录。
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

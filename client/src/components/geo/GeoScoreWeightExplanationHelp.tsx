import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatGeoScoreWeightExplanationLine,
  GEO_SCORE_WEIGHT_EXPLANATION_ITEMS,
} from "@shared/geoScoreWeightExplanation";
import { cn } from "@/lib/utils";
import { CircleHelp } from "lucide-react";
import type { SyntheticEvent } from "react";

type Props = {
  className?: string;
  testId?: string;
  iconClassName?: string;
  /** 嵌套在其它可点击区域（如项目切换器）内时阻止冒泡 */
  stopPropagation?: boolean;
};

export function GeoScoreWeightExplanationHelp({
  className,
  testId = "geo-score-weight-explanation",
  iconClassName,
  stopPropagation = false,
}: Props) {
  const blockParentActivation = (event: SyntheticEvent) => {
    if (!stopPropagation) return;
    event.stopPropagation();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
            className,
          )}
          data-testid={`${testId}-trigger`}
          aria-label="查看 GEO 评分说明"
          onClick={blockParentActivation}
          onPointerDown={blockParentActivation}
        >
          <CircleHelp className={cn("h-3.5 w-3.5", iconClassName)} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 border-gray-200 bg-white p-3 text-gray-900 shadow-lg"
        data-testid={testId}
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <p className="text-xs font-semibold text-gray-800">GEO 评分说明</p>
        <p className="mt-0.5 text-[11px] text-gray-500">总分由以下维度加权计算</p>
        <ul className="mt-2.5 space-y-2" data-testid={`${testId}-list`}>
          {GEO_SCORE_WEIGHT_EXPLANATION_ITEMS.map(item => (
            <li key={item.label} className="text-xs leading-relaxed text-gray-700">
              {formatGeoScoreWeightExplanationLine(item)}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

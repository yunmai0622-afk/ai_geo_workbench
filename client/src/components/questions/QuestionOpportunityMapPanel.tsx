import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  QuestionOpportunityMapItem,
  QuestionOpportunityMapView,
} from "@shared/questionOpportunityMap";
import { ArrowRight, Map, Target } from "lucide-react";

const labelClass: Record<QuestionOpportunityMapItem["opportunityLabel"], string> = {
  高价值: "border-blue-200 bg-blue-50 text-blue-800",
  竞品占位: "border-red-200 bg-red-50 text-red-800",
  已覆盖: "border-emerald-200 bg-emerald-50 text-emerald-800",
  待优化: "border-amber-200 bg-amber-50 text-amber-800",
  待实测: "border-gray-200 bg-gray-50 text-gray-700",
};

export function QuestionOpportunityMapPanel({
  view,
  mutating,
  onPrimaryAction,
  onItemAction,
}: {
  view: QuestionOpportunityMapView;
  mutating: boolean;
  onPrimaryAction?: () => void;
  onItemAction: (item: QuestionOpportunityMapItem) => void;
}) {
  return (
    <P0Card testId="question-opportunity-map-panel" className="space-y-5 border-blue-100 bg-blue-50/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Map className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">AI 搜索机会地图</p>
          </div>
          <h2 className="mt-2 text-xl font-bold text-gray-950" data-testid="question-opportunity-map-headline">
            {view.headline}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{view.summary}</p>
        </div>
        {onPrimaryAction ? (
          <Button
            type="button"
            size="sm"
            onClick={onPrimaryAction}
            disabled={mutating}
            data-testid="question-opportunity-map-primary-action"
          >
            {view.primaryActionLabel}
            <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        ) : null}
      </div>

      <p className="text-sm leading-6 text-gray-700" data-testid="question-opportunity-map-proof">
        {view.proofLine}
      </p>

      <div className="grid gap-4 md:grid-cols-4" data-testid="question-opportunity-map-lanes">
        {view.lanes.map(lane => (
          <div key={lane.id} className="border-l-2 border-blue-200 pl-3">
            <p className="text-2xl font-bold tabular-nums text-gray-950">{lane.count}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{lane.title}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">{lane.description}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3" data-testid="question-opportunity-map-top-items">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-blue-600" />
          <p className="text-sm font-semibold text-gray-900">优先抢占清单</p>
        </div>
        {view.emptyHint ? (
          <div className="border border-dashed border-gray-200 bg-white/70 px-4 py-6 text-sm text-gray-500">
            {view.emptyHint}
          </div>
        ) : null}
        <div className="divide-y divide-blue-100">
          {view.topItems.map(item => (
            <div
              key={item.questionId}
              className="py-3"
              data-testid={`question-opportunity-map-item-${item.questionId}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">
                      {item.typeLabel}
                    </Badge>
                    <Badge variant="outline" className={cn(labelClass[item.opportunityLabel])}>
                      {item.opportunityLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-gray-950">{item.questionText}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{item.reason}</p>
                  <p className="mt-2 text-xs leading-5 text-gray-500">{item.evidenceLine}</p>
                  <p className="text-xs leading-5 text-gray-500">{item.sourceLine}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutating}
                  onClick={() => onItemAction(item)}
                  data-testid={`question-opportunity-map-action-${item.questionId}`}
                >
                  {item.nextActionLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs leading-5 text-gray-500" data-testid="question-opportunity-map-primary-reason">
        下一步原因：{view.primaryActionReason}
      </p>
    </P0Card>
  );
}

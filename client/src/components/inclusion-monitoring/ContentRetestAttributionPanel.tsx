import { cn } from "@/lib/utils";
import {
  mentionsBrandLabel,
  type ContentRetestAttributionView,
} from "@shared/contentRetestAttribution";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type Props = {
  recordId: number;
  attribution: ContentRetestAttributionView;
  included: boolean;
};

function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function ContentRetestAttributionPanel({ recordId, attribution, included }: Props) {
  const [open, setOpen] = useState(false);

  if (!included && !attribution.showExpand) return null;

  const canShowComparison = attribution.status === "ready";

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-white" data-testid={`content-retest-attribution-${recordId}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        onClick={() => setOpen(prev => !prev)}
        data-testid={`content-retest-attribution-toggle-${recordId}`}
      >
        <span className="text-xs font-medium text-blue-800">查看AI复测结果</span>
        <ChevronDown className={cn("h-4 w-4 text-blue-600 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-blue-50 px-3 pb-3 pt-2 text-xs text-gray-700">
          {attribution.questionText ? (
            <div>
              <p className="text-gray-400">关联AI搜索问题</p>
              <p className="mt-0.5 font-medium text-gray-900">{attribution.questionText}</p>
            </div>
          ) : null}

          {canShowComparison ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="font-medium text-gray-900">{attribution.before.label}</p>
                  <p className="mt-2 text-gray-600">
                    AI是否提及品牌：{mentionsBrandLabel(attribution.before.mentionsBrand)}
                  </p>
                  <p className="mt-1 text-gray-600">提及率：{formatRate(attribution.before.brandMentionRate)}</p>
                  {attribution.before.answerSummary ? (
                    <p className="mt-2 leading-relaxed text-gray-700">{attribution.before.answerSummary}</p>
                  ) : null}
                </div>
                <div className="rounded-md bg-blue-50/60 p-3">
                  <p className="font-medium text-gray-900">{attribution.after.label}</p>
                  <p className="mt-2 text-gray-600">
                    AI是否提及品牌：{mentionsBrandLabel(attribution.after.mentionsBrand)}
                  </p>
                  <p className="mt-1 text-gray-600">提及率：{formatRate(attribution.after.brandMentionRate)}</p>
                  {attribution.after.answerSummary ? (
                    <p className="mt-2 leading-relaxed text-gray-700">{attribution.after.answerSummary}</p>
                  ) : null}
                </div>
              </div>
              {attribution.changeConclusion ? (
                <p className="rounded-md bg-emerald-50 px-3 py-2 font-medium text-emerald-900">
                  变化：{attribution.changeConclusion}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-gray-600">{attribution.statusMessage}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

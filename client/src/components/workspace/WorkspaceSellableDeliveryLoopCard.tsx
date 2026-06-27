import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SellableDeliveryLoopView } from "@shared/sellableDeliveryLoop";
import { ArrowRight, CheckCircle2, Circle, Sparkles } from "lucide-react";

const stepStatusClass = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  current: "border-blue-200 bg-blue-50 text-blue-800",
  pending: "border-gray-200 bg-gray-50 text-gray-500",
} as const;

export function WorkspaceSellableDeliveryLoopCard({
  view,
  onNextAction,
}: {
  view: SellableDeliveryLoopView;
  onNextAction?: () => void;
}) {
  return (
    <P0Card testId="workspace-sellable-delivery-loop" className="space-y-5 border-blue-100 bg-blue-50/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">本月 GEO 交付闭环</p>
          </div>
          <h2 className="mt-2 text-xl font-bold text-gray-950" data-testid="workspace-delivery-loop-headline">
            {view.headline}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{view.stageSummary}</p>
        </div>
        {onNextAction ? (
          <Button type="button" size="sm" onClick={onNextAction} data-testid="workspace-delivery-loop-next">
            {view.nextActionLabel}
            <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="border-l-2 border-blue-200 pl-3">
          <p className="text-xs font-medium text-gray-500">本月重点</p>
          <p className="mt-2 text-sm leading-6 text-gray-800" data-testid="workspace-delivery-loop-focus">
            {view.currentFocus}
          </p>
        </div>
        <div className="border-l-2 border-emerald-200 pl-3">
          <p className="text-xs font-medium text-gray-500">交付证据</p>
          <p className="mt-2 text-sm leading-6 text-gray-800" data-testid="workspace-delivery-loop-proof">
            {view.proofLine}
          </p>
        </div>
        <div className="border-l-2 border-amber-200 pl-3">
          <p className="text-xs font-medium text-gray-500">续费解释</p>
          <p className="mt-2 text-sm leading-6 text-gray-800" data-testid="workspace-delivery-loop-renewal">
            {view.renewalReason}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8" data-testid="workspace-delivery-loop-steps">
        {view.steps.map(step => (
          <div
            key={step.id}
            className={cn(
              "min-h-[82px] rounded-lg border px-3 py-2",
              stepStatusClass[step.status],
            )}
            data-testid={`workspace-delivery-loop-step-${step.id}`}
            title={step.customerMeaning}
          >
            <div className="flex items-center gap-1.5">
              {step.status === "done" ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
              <p className="text-xs font-semibold">{step.label}</p>
            </div>
            <p className="mt-1 text-[11px] leading-4 opacity-80">
              {step.status === "done" ? "已形成证据" : step.status === "current" ? "当前重点" : "后续推进"}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs leading-5 text-gray-500" data-testid="workspace-delivery-loop-next-reason">
        下一步原因：{view.nextActionReason}
      </p>
    </P0Card>
  );
}

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

export function P0Card({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className={cn(geoP0Surfaces.card, geoP0Surfaces.cardPadding, className)}
    >
      {children}
    </div>
  );
}

export function P0Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>{title}</h2>
        {description ? <p className={geoP0Surfaces.muted}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function P0MetricTile({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string;
  value: string;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className={cn(geoP0Surfaces.card, "p-4")}>
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${label}说明`}
                className="inline-flex items-center text-gray-400 transition-colors hover:text-gray-600"
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-64 leading-relaxed">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

export function P0QuickLinkCard({
  title,
  active,
  onClick,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        geoP0Surfaces.card,
        "flex min-h-[88px] flex-col items-start justify-center p-4 text-left transition-colors",
        active ? "border-blue-300 bg-blue-50/80 ring-1 ring-blue-200" : "hover:border-blue-200",
      )}
    >
      <span className="text-sm font-semibold text-gray-900">{title}</span>
      <span className="mt-1 text-xs text-blue-600">打开 →</span>
    </button>
  );
}

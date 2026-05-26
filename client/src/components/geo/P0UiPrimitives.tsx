import { cn } from "@/lib/utils";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import type { ReactNode } from "react";

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

export function P0MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cn(geoP0Surfaces.card, "p-4")}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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
      <span className="text-sm font-semibold text-slate-900">{title}</span>
      <span className="mt-1 text-xs text-blue-600">打开 →</span>
    </button>
  );
}

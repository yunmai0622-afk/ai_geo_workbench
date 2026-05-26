import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** 统一页面壳：Hero → 主区 → 辅助区 */
export function AiPageShell({
  children,
  className,
  auxiliary,
}: {
  children: ReactNode;
  className?: string;
  auxiliary?: ReactNode;
}) {
  return (
    <div className={cn("ai-page-shell mx-auto w-full max-w-[90rem] space-y-10 pb-20 pt-1 text-gray-900", className)}>
      {children}
      {auxiliary ? <aside className="ai-page-auxiliary space-y-6 border-t border-gray-200 pt-10">{auxiliary}</aside> : null}
    </div>
  );
}

export function AiPageHero({
  title,
  description,
  badge,
  meta,
  children,
  className,
}: {
  title: string;
  description: string;
  badge?: string;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("ai-page-hero", className)}>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          {badge ? (
            <span className="ai-hero-badge inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700">
              {badge}
            </span>
          ) : null}
          <h1 className="ai-hero-title text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{title}</h1>
          <p className="max-w-2xl text-base leading-relaxed text-gray-500">{description}</p>
          {meta ? <div className="text-sm text-gray-500">{meta}</div> : null}
        </div>
        {children ? <div className="flex shrink-0 flex-col gap-2 sm:min-w-[220px] sm:items-end">{children}</div> : null}
      </div>
    </header>
  );
}

export function AiSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("ai-section space-y-5", className)}>
      {title ? (
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">{title}</h2>
          {description ? <p className="max-w-3xl text-sm text-gray-500">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AiMetricCard({
  label,
  value,
  hint,
  accent = "cyan",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "cyan" | "violet" | "emerald" | "amber";
  className?: string;
}) {
  const accentRing =
    accent === "violet"
      ? "from-violet-50"
      : accent === "emerald"
        ? "from-emerald-50"
        : accent === "amber"
          ? "from-amber-50"
          : "from-blue-50";
  return (
    <div className={cn("ai-metric-card relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm", className)}>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80", accentRing)} />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
        <p className="ai-metric-value mt-3 text-gray-900">{value}</p>
        {hint ? <p className="mt-2 text-xs leading-relaxed text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export function AiActionCard({
  title,
  description,
  actionLabel,
  onAction,
  disabled,
  variant = "primary",
  className,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
  className?: string;
}) {
  return (
    <div className={cn("ai-action-card flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center", className)}>
      <div className="min-w-0 space-y-1.5">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm leading-relaxed text-gray-500">{description}</p>
      </div>
      <Button
        type="button"
        className={cn("shrink-0", variant === "primary" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50")}
        variant={variant === "primary" ? "default" : "outline"}
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

export function AiAssetCard({
  title,
  subtitle,
  badges,
  footer,
  accentColor,
  className,
  onClick,
}: {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  footer?: ReactNode;
  accentColor?: string;
  className?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "ai-asset-card flex w-full flex-col rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition",
        onClick && "cursor-pointer hover:border-blue-300 hover:shadow-md",
        className,
      )}
      style={accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : undefined}
    >
      {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
      <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug text-gray-900">{title}</h3>
      {subtitle ? <p className="mt-2 text-xs leading-relaxed text-gray-500">{subtitle}</p> : null}
      {footer ? <div className="mt-4 border-t border-gray-100 pt-4">{footer}</div> : null}
    </Comp>
  );
}

export function AiStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "info" | "neutral";
}) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    neutral: "border-gray-200 bg-gray-50 text-gray-600",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function AiEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="ai-empty-state flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-2xl text-blue-600">
        ◇
      </div>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" className="mt-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function AiGlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6", className)}>{children}</div>;
}

export type FunnelStage = { label: string; value: string };

export function AiFunnelRail({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="ai-funnel-rail grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {stages.map((stage, index) => (
        <div key={stage.label} className="ai-funnel-step relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700">
            {index + 1}
          </span>
          <p className="text-sm font-medium text-gray-600">{stage.label}</p>
          <p className="text-lg font-semibold text-gray-900">{stage.value}</p>
          {index < stages.length - 1 ? (
            <span className="ai-funnel-connector hidden lg:block" aria-hidden />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AiConsolePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("ai-console-panel rounded-xl border border-gray-200 bg-white p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function AiStepRail({
  steps,
  activeIndex = 0,
}: {
  steps: { title: string; desc: string }[];
  activeIndex?: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => (
        <div
          key={step.title}
          className={cn(
            "rounded-xl border p-4 transition",
            i <= activeIndex
              ? "border-blue-300 bg-blue-50 shadow-sm"
              : "border-gray-200 bg-white",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Step {i + 1}</p>
          <p className="mt-2 font-medium text-gray-900">{step.title}</p>
          <p className="mt-1 text-xs text-gray-500">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}

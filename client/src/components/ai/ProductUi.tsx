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
    <div className={cn("ai-page-shell mx-auto w-full max-w-[90rem] space-y-10 pb-20 pt-1 text-slate-100", className)}>
      {children}
      {auxiliary ? <aside className="ai-page-auxiliary space-y-6 border-t border-white/8 pt-10">{auxiliary}</aside> : null}
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
            <span className="ai-hero-badge inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-100">
              {badge}
            </span>
          ) : null}
          <h1 className="ai-hero-title text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-400">{description}</p>
          {meta ? <div className="text-sm text-slate-500">{meta}</div> : null}
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
          <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
          {description ? <p className="max-w-3xl text-sm text-slate-400">{description}</p> : null}
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
      ? "from-violet-500/20"
      : accent === "emerald"
        ? "from-emerald-500/20"
        : accent === "amber"
          ? "from-amber-500/20"
          : "from-cyan-500/20";
  return (
    <div className={cn("ai-metric-card relative overflow-hidden", className)}>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80", accentRing)} />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className="ai-metric-value mt-3 text-white">{value}</p>
        {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
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
    <div className={cn("ai-action-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center", className)}>
      <div className="min-w-0 space-y-1.5">
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm leading-relaxed text-slate-400">{description}</p>
      </div>
      <Button
        type="button"
        variant={variant === "primary" ? "ai" : "outline"}
        className={cn("shrink-0", variant === "outline" && "border-white/15 text-cyan-100")}
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
        "ai-asset-card flex w-full flex-col rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-left transition",
        onClick && "cursor-pointer hover:border-cyan-400/25 hover:shadow-[0_0_32px_rgba(56,189,248,0.1)]",
        className,
      )}
      style={accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : undefined}
    >
      {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
      <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug text-white">{title}</h3>
      {subtitle ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      {footer ? <div className="mt-4 border-t border-white/8 pt-4">{footer}</div> : null}
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
    success: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-400/35 bg-amber-500/10 text-amber-100",
    info: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
    neutral: "border-white/12 bg-slate-950/60 text-slate-300",
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 to-violet-500/15 text-2xl text-cyan-200">
        ◇
      </div>
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="ai" className="mt-8" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function AiGlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ai-glass-panel p-5 md:p-6", className)}>{children}</div>;
}

export type FunnelStage = { label: string; value: string };

export function AiFunnelRail({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="ai-funnel-rail grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {stages.map((stage, index) => (
        <div key={stage.label} className="ai-funnel-step relative flex flex-col gap-2 p-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-500/10 text-sm font-bold text-cyan-100">
            {index + 1}
          </span>
          <p className="text-sm font-medium text-slate-300">{stage.label}</p>
          <p className="text-lg font-semibold text-white">{stage.value}</p>
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
    <div className={cn("ai-console-panel rounded-2xl border border-cyan-400/20 bg-gradient-to-b from-slate-950/80 to-slate-900/40 p-5 shadow-[0_0_40px_rgba(56,189,248,0.08)]", className)}>
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
            "rounded-2xl border p-4 transition",
            i <= activeIndex
              ? "border-cyan-400/30 bg-cyan-500/8 shadow-[0_0_24px_rgba(56,189,248,0.1)]"
              : "border-white/8 bg-slate-950/40",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200/80">Step {i + 1}</p>
          <p className="mt-2 font-medium text-white">{step.title}</p>
          <p className="mt-1 text-xs text-slate-500">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}

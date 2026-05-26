import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { workspaceCtaUrl, type WorkspaceStageDefinition } from "@shared/workspaceStateMachine";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type RecentItem = {
  label: string;
  detail?: string;
};

type Props = {
  projectId?: number;
  stage?: WorkspaceStageDefinition | null;
  blockerReason?: string | null;
  riskHints?: string[];
  recentItems?: RecentItem[];
  loading?: boolean;
};

function PanelBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(geoP0Surfaces.card, "space-y-3 p-4 shadow-none", className)}>{children}</div>
  );
}

export function ProjectNextActionPanel({
  projectId,
  stage,
  blockerReason,
  riskHints = [],
  recentItems = [],
  loading,
}: Props) {
  const [, setLocation] = useLocation();

  return (
    <aside
      className={cn(
        "w-full shrink-0 space-y-3 border-slate-200 lg:w-[280px] lg:border-l lg:pl-4",
        geoP0Surfaces.panel,
        "rounded-xl lg:rounded-none lg:bg-slate-50 lg:p-3",
      )}
      data-testid="project-next-action-panel"
    >
      <PanelBlock>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">下一步动作</p>
        {loading ? (
          <p className="text-sm text-slate-500">加载建议中…</p>
        ) : stage && projectId ? (
          <>
            <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
              {blockerReason ?? stage.blockerHint}
            </p>
            <button
              type="button"
              className={cn("inline-flex items-center text-sm", geoP0Brand.link)}
              data-testid="next-action-primary-button"
              onClick={() => setLocation(workspaceCtaUrl(projectId, stage))}
            >
              {stage.ctaLabel}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">请选择企业项目后查看建议</p>
        )}
      </PanelBlock>

      {riskHints.length > 0 ? (
        <PanelBlock className="border-l-4 border-l-amber-400 bg-amber-50/50" data-testid="next-action-risks">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            风险提醒
          </div>
          <ul className="space-y-1.5 text-sm text-amber-900/90">
            {riskHints.map(hint => (
              <li key={hint} className="flex gap-2">
                <span>·</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </PanelBlock>
      ) : null}

      {recentItems.length > 0 ? (
        <PanelBlock data-testid="next-action-recent">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">最近结果</p>
          <ul className="space-y-2 text-sm">
            {recentItems.map(item => (
              <li key={item.label} className="flex justify-between gap-2">
                <span className="text-slate-600">{item.label}</span>
                <span className="font-medium tabular-nums text-slate-900">{item.detail ?? "—"}</span>
              </li>
            ))}
          </ul>
        </PanelBlock>
      ) : null}
    </aside>
  );
}

import { geoP0Brand } from "@/lib/geoP0Visual";
import { workspaceCtaUrl, type WorkspaceStageDefinition } from "@shared/workspaceStateMachine";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
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

/**
 * 右侧下一步面板 — 顾问卡风格
 * 结构：下一步建议 → 风险提醒 → 最近结果
 * 无数据时隐藏对应区块
 */
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
      className="w-full space-y-4"
      data-testid="project-next-action-panel"
    >
      {/* ═══ 下一步建议 ═══ */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/70 to-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 shadow-sm shadow-blue-600/20">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">下一步建议</h3>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">加载建议中…</p>
        ) : stage && projectId ? (
          <div className="space-y-3">
            {/* 当前最应该处理什么 */}
            <p className="text-sm leading-relaxed text-gray-700">
              {blockerReason ?? stage.blockerHint}
            </p>
            {/* CTA */}
            <button
              type="button"
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                "bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md",
              )}
              data-testid="next-action-primary-button"
              onClick={() => setLocation(workspaceCtaUrl(projectId, stage))}
            >
              {stage.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">请选择企业项目后查看建议</p>
        )}
      </div>

      {/* ═══ 风险提醒 ═══ */}
      {riskHints.length > 0 ? (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4"
          data-testid="next-action-risks"
        >
          <div className="mb-2.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <h3 className="text-[13px] font-semibold text-amber-800">风险提醒</h3>
          </div>
          <ul className="space-y-1.5">
            {riskHints.map(hint => (
              <li key={hint} className="flex gap-2 text-[13px] leading-relaxed text-amber-900/90">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ═══ 最近结果 ═══ */}
      {recentItems.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4" data-testid="next-action-recent">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">最近 7 天</p>
          <ul className="space-y-2.5">
            {recentItems.map(item => (
              <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-semibold tabular-nums text-gray-900">{item.detail ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

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
 * 右侧下一步面板
 * 规范：像“交付顾问提醒下一步”，不是系统日志
 * 清晰的卡片分区，温暖的引导语气
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
      className="w-full shrink-0 space-y-4 lg:w-[280px] lg:pl-4"
      data-testid="project-next-action-panel"
    >
      {/* 下一步动作卡 */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-xs font-semibold tracking-wide text-blue-700">下一步动作</p>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">加载建议中…</p>
        ) : stage && projectId ? (
          <div className="space-y-3">
            <p className="line-clamp-3 text-sm leading-relaxed text-gray-700">
              {blockerReason ?? stage.blockerHint}
            </p>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md",
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

      {/* 风险提醒 */}
      {riskHints.length > 0 ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm"
          data-testid="next-action-risks"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            风险提醒
          </div>
          <ul className="space-y-1.5 text-sm leading-relaxed text-amber-900/90">
            {riskHints.map(hint => (
              <li key={hint} className="flex gap-2">
                <span className="text-amber-500">•</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 最近结果 */}
      {recentItems.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid="next-action-recent">
          <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400">最近 7 天</p>
          <ul className="space-y-2.5 text-sm">
            {recentItems.map(item => (
              <li key={item.label} className="flex justify-between gap-2">
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

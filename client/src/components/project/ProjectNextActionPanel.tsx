import { geoP0Brand } from "@/lib/geoP0Visual";
import { CUSTOMER_STAGE_LABELS } from "@/lib/projectWorkspaceDisplay";
import type { MainChainNextAction } from "@/lib/workspaceHomeDisplay";
import type { PageNextActionSuggestion } from "@shared/pageNextActionSuggestion";
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
  mainChainNextAction?: MainChainNextAction | null;
  pageNextAction?: PageNextActionSuggestion | null;
  pageNextActionPath?: string | null;
  blockerReason?: string | null;
  riskHints?: string[];
  recentItems?: RecentItem[];
  loading?: boolean;
};

/**
 * 右侧下一步面板 — 顾问卡风格
 * 结构：
 * 1. 下一步建议（当前最该做什么 + 为什么 + 做完进入哪阶段 + CTA）
 * 2. 风险提醒（默认折叠，有风险时展开）
 * 3. 最近结果（紧凑摘要）
 * 无数据时隐藏对应区块
 */
export function ProjectNextActionPanel({
  projectId,
  stage,
  mainChainNextAction,
  pageNextAction,
  pageNextActionPath,
  blockerReason,
  riskHints = [],
  recentItems = [],
  loading,
}: Props) {
  const [, setLocation] = useLocation();

  const STAGE_ORDER = ["待建档", "待诊断", "待生产", "待绑定发布", "待发布", "待监测", "优化中", "报告已生成"];
  const currentLabel = stage ? CUSTOMER_STAGE_LABELS[stage.id] : null;
  const currentIdx = currentLabel ? STAGE_ORDER.indexOf(currentLabel) : -1;
  const fallbackNextStageName =
    currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1
      ? STAGE_ORDER[currentIdx + 1]
      : "持续优化";

  const ctaLabel = pageNextAction?.ctaLabel ?? mainChainNextAction?.ctaLabel ?? stage?.ctaLabel;
  const reason =
    pageNextAction?.reason ?? mainChainNextAction?.reason ?? blockerReason ?? stage?.blockerHint;
  const nextStageName =
    pageNextAction?.nextStageName ?? mainChainNextAction?.nextStageName ?? fallbackNextStageName;
  const ctaPath =
    pageNextActionPath ??
    mainChainNextAction?.ctaPath ??
    (stage && projectId ? workspaceCtaUrl(projectId, stage) : null);

  const recentSummary = recentItems
    .map(item => (item.detail ? `${item.label} ${item.detail}` : item.label))
    .join(" · ");

  return (
    <aside
      className="w-full space-y-4"
      data-testid="project-next-action-panel"
    >
      {/* ═══ 下一步建议 ═══ */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60 p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 shadow-sm shadow-blue-600/20">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-blue-900">下一步建议</h3>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">加载建议中…</p>
        ) : ctaLabel && projectId && ctaPath ? (
          <div className="space-y-3">
            <p className="text-[13px] font-medium leading-relaxed text-gray-800">{ctaLabel}</p>

            {reason ? (
              <p className="text-[12px] leading-relaxed text-gray-600">原因：{reason}</p>
            ) : null}

            <p className="text-[12px] text-gray-500">
              完成后进入：<span className="font-medium text-blue-700">{nextStageName}</span>
            </p>

            <button
              type="button"
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                geoP0Brand.primary,
              )}
              data-testid="next-action-primary-button"
              onClick={() => setLocation(ctaPath)}
            >
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">请选择企业项目后查看建议</p>
        )}
      </div>

      {/* ═══ 风险提醒 ═══ */}
      {riskHints.length > 0 ? (
        <details
          open
          className="rounded-2xl border border-amber-200 bg-amber-50/60"
          data-testid="next-action-risks"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <h3 className="text-[13px] font-semibold text-amber-800">风险提醒</h3>
            <span className="ml-auto text-[11px] text-amber-700">{riskHints.length} 项</span>
          </summary>
          <ul className="space-y-1.5 border-t border-amber-200/60 px-4 pb-3 pt-2">
            {riskHints.map(hint => (
              <li key={hint} className="flex gap-2 text-[12px] leading-relaxed text-amber-900/90">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* ═══ 最近结果 ═══ */}
      {recentSummary ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3" data-testid="next-action-recent">
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">最近数据</h4>
          <p className="text-[11px] leading-relaxed text-gray-600">{recentSummary}</p>
        </div>
      ) : null}
    </aside>
  );
}

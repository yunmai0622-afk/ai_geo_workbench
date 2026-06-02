import { Sparkles } from "lucide-react";

type Props = {
  summaryLabel: string;
  children: React.ReactNode;
};

/** 移动端底部可折叠「下一步建议」区域（桌面端由右侧栏承载，不渲染本组件） */
export function ProjectNextActionMobileDock({ summaryLabel, children }: Props) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden"
      data-testid="project-next-action-mobile-dock"
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-blue-900 [&::-webkit-details-marker]:hidden">
          <Sparkles className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
          <span className="shrink-0">下一步建议</span>
          <span className="min-w-0 flex-1 truncate text-xs font-normal text-gray-600">{summaryLabel}</span>
          <span className="shrink-0 text-xs text-blue-600 group-open:hidden">展开</span>
          <span className="hidden shrink-0 text-xs text-blue-600 group-open:inline">收起</span>
        </summary>
        <div className="max-h-[min(60vh,480px)] space-y-4 overflow-y-auto border-t border-gray-100 px-4 pb-4 pt-3">
          {children}
        </div>
      </details>
    </div>
  );
}

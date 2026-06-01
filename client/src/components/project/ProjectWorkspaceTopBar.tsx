import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import { formatGeoScore } from "@/lib/projectWorkspaceDisplay";
import { geoP0Brand, geoP0Surfaces, stageBadgeClass } from "@/lib/geoP0Visual";
import { workspaceCtaUrl, type WorkspaceStageDefinition } from "@shared/workspaceStateMachine";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ProjectSwitcher } from "./ProjectSwitcher";

type Props = {
  enterpriseName?: string | null;
  stageLabel?: string | null;
  geoScore?: number | null;
  ctaStage?: WorkspaceStageDefinition | null;
  projectId?: number;
  loading?: boolean;
};

/**
 * 项目内顶部栏
 * 规范：56px 白底，左侧返回+企业名，中间阶段标签+GEO分，右侧CTA
 * 清爽可信，不占据过多视觉重量
 */
export function ProjectWorkspaceTopBar({
  enterpriseName,
  stageLabel,
  geoScore,
  ctaStage,
  projectId,
  loading,
}: Props) {
  const [, setLocation] = useLocation();

  if (!projectId) {
    return (
      <div
        className={cn(geoP0Surfaces.topBar, "flex flex-wrap items-center justify-between gap-3 rounded-none px-4")}
        data-testid="project-workspace-top-bar"
      >
        <p className="text-sm text-amber-700">请选择企业项目后继续操作</p>
        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setLocation("/clients")}>
          返回客户项目
        </Button>
      </div>
    );
  }

  return (
    <header
      className={cn(
        geoP0Surfaces.topBar,
        "-mx-4 flex flex-wrap items-center gap-3 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:gap-4 lg:px-8",
      )}
      data-testid="project-workspace-top-bar"
    >
      {/* 左侧：返回 + 企业名 */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => setLocation("/clients")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </Button>
        <span className="h-4 w-px bg-gray-200" aria-hidden />
        <button
          type="button"
          className="truncate text-left text-sm font-semibold text-gray-800 transition-colors hover:text-blue-600 md:text-[15px]"
          data-testid="project-topbar-name"
          onClick={() => setLocation(buildProjectUrl("/workspace", projectId))}
        >
          {loading ? "加载中…" : enterpriseName ?? "未命名企业"}
        </button>
      </div>

      {/* 中间：阶段 + GEO 分 */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {stageLabel ? (
          <span className={stageBadgeClass(stageLabel)} data-testid="project-topbar-stage">
            {stageLabel}
          </span>
        ) : null}
        <div className="flex items-baseline gap-1.5 text-sm text-gray-500" data-testid="project-topbar-score">
          <span className="text-xs font-medium">GEO</span>
          <span className="text-lg font-bold tabular-nums tracking-tight text-gray-900">{formatGeoScore(geoScore)}</span>
        </div>
      </div>

      {/* 右侧：CTA */}
      {ctaStage ? (
        <Button
          type="button"
          size="sm"
          className={cn("shrink-0 rounded-xl", geoP0Brand.primary)}
          data-testid="project-topbar-cta"
          onClick={() => setLocation(workspaceCtaUrl(projectId, ctaStage))}
        >
          {ctaStage.ctaLabel}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ) : null}
    </header>
  );
}

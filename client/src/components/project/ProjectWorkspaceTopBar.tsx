import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces, stageBadgeClass } from "@/lib/geoP0Visual";
import { workspaceCtaUrl, type WorkspaceStageDefinition } from "@shared/workspaceStateMachine";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ProjectSwitcher } from "./ProjectSwitcher";

type Props = {
  enterpriseName?: string | null;
  stageLabel?: string | null;
  geoScore?: number | null;
  ctaStage?: WorkspaceStageDefinition | null;
  projectId?: number;
  loading?: boolean;
};

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
        "-mx-4 flex flex-col items-stretch gap-3 px-4 sm:flex-row sm:flex-wrap sm:items-center md:-mx-6 md:px-6 lg:-mx-8 lg:gap-4 lg:px-8",
      )}
      data-testid="project-workspace-top-bar"
    >
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
        <ProjectSwitcher
          currentProjectId={projectId}
          currentEnterpriseName={enterpriseName}
          currentGeoScore={geoScore}
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {stageLabel ? (
          <span className={stageBadgeClass(stageLabel)} data-testid="project-topbar-stage">
            {stageLabel}
          </span>
        ) : null}
      </div>

      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
        <NotificationBell />
        {ctaStage ? (
          <Button
            type="button"
            size="sm"
            className={cn("w-full rounded-xl sm:w-auto", geoP0Brand.primary)}
            data-testid="project-topbar-cta"
            onClick={() => setLocation(workspaceCtaUrl(projectId, ctaStage))}
          >
            {ctaStage.ctaLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </header>
  );
}

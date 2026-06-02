import { PageUsageHelpButton } from "@/components/help/PageUsageHelpButton";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces, stageBadgeClass } from "@/lib/geoP0Visual";
import { resolvePageUsageHelpId } from "@shared/pageUsageHelp";
import { workspaceCtaUrl, type WorkspaceStageDefinition } from "@shared/workspaceStateMachine";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { resolveProjectTopBarPresentation } from "@/lib/projectWorkspaceTopBar";
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
  const [location, setLocation] = useLocation();
  const pathname = location.split("?")[0] || location;
  const pageHelpId = resolvePageUsageHelpId(pathname);
  const topBar = resolveProjectTopBarPresentation(stageLabel, ctaStage);

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

      <div className="flex flex-wrap items-center gap-3 sm:ml-auto md:gap-4">
        {topBar.stageBadgeLabel ? (
          <span className={stageBadgeClass(topBar.stageBadgeLabel)} data-testid="project-topbar-stage">
            {topBar.stageBadgeLabel}
          </span>
        ) : null}
        {pageHelpId ? <PageUsageHelpButton helpId={pageHelpId} testId={`page-usage-help-${pageHelpId}`} /> : null}
      </div>

      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
        {ctaStage && topBar.actionLabel ? (
          <Button
            type="button"
            size="sm"
            className={cn("w-full rounded-xl sm:w-auto", geoP0Brand.primary)}
            data-testid="project-topbar-cta"
            onClick={() => setLocation(workspaceCtaUrl(projectId, ctaStage))}
          >
            {topBar.actionLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </header>
  );
}

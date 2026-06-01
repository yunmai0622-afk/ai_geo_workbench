import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildProjectUrl, setActiveProjectId } from "@/lib/activeProject";
import { formatGeoScore } from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

type Props = {
  currentProjectId?: number;
  currentEnterpriseName?: string | null;
  currentGeoScore?: number | null;
  loading?: boolean;
  className?: string;
};

/**
 * 工作台顶部项目切换器：展示当前项目名 + GEO 分，点击可切换其他项目。
 */
export function ProjectSwitcher({
  currentProjectId,
  currentEnterpriseName,
  currentGeoScore,
  loading,
  className,
}: Props) {
  const [location, setLocation] = useLocation();
  const { data: projects = [], isLoading: listLoading } = trpc.geo.clientDashboard.listProjectsSummary.useQuery();

  const pathname = location.split("?")[0] || location;

  const handleSelect = (projectId: number) => {
    if (projectId === currentProjectId) return;
    setActiveProjectId(projectId);
    if (pathname === "/clients" || pathname === "/onboarding") {
      setLocation(buildProjectUrl("/workspace", projectId));
      return;
    }
    setLocation(buildProjectUrl(pathname, projectId));
  };

  const scoreText = formatGeoScore(currentGeoScore);
  const triggerLabel = loading ? "加载中…" : currentEnterpriseName ?? "未选择项目";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto max-w-[min(100%,280px)] gap-1.5 rounded-lg px-2 py-1.5 text-left font-semibold text-gray-800 hover:bg-gray-100 hover:text-gray-900 md:max-w-xs",
            className,
          )}
          data-testid="project-switcher-trigger"
        >
          <span className="min-w-0 truncate text-sm md:text-[15px]">{triggerLabel}</span>
          <span className="shrink-0 text-xs font-medium text-gray-400">GEO {scoreText}</span>
          {listLoading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(100vw-2rem,320px)]">
        <DropdownMenuLabel className="text-xs font-normal text-gray-500">切换企业项目</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.length === 0 ? (
          <DropdownMenuItem disabled className="text-gray-500">
            暂无其他项目
          </DropdownMenuItem>
        ) : (
          projects.map(project => {
            const isActive = project.id === currentProjectId;
            return (
              <DropdownMenuItem
                key={project.id}
                className="flex cursor-pointer items-center justify-between gap-2"
                data-testid={`project-switcher-item-${project.id}`}
                onClick={() => handleSelect(project.id)}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{project.enterpriseName}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                  {formatGeoScore(project.latestGeoScore)}
                </span>
                {isActive ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : <span className="w-4" />}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-blue-700 focus:text-blue-700"
          data-testid="project-switcher-all-projects"
          onClick={() => setLocation("/clients")}
        >
          查看全部企业项目
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

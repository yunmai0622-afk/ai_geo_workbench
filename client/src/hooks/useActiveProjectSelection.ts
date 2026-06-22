import {
  buildProjectUrl,
  getPathnameFromLocation,
  getProjectIdFromUrl,
  getSearchFromLocation,
  inspectActiveProjectContext,
  setActiveProjectId,
} from "@/lib/activeProject";
import { filterNavigableProjects } from "@shared/projectNavigation";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  isProjectsListNavigationPending,
  useInvalidProjectRedirect,
} from "@/hooks/useInvalidProjectRedirect";

export type ProjectOption = { id: number; enterpriseName: string };

const PATHS_SKIP_URL_SYNC = new Set(["/clients"]);

export function useActiveProjectSelection() {
  const [location, setLocation] = useLocation();
  const search = getSearchFromLocation(location);
  const pathname = getPathnameFromLocation(location);
  const projectsQuery = trpc.geo.projects.list.useQuery();
  const projectsRaw = projectsQuery.data ?? [];
  const projectsListPending = isProjectsListNavigationPending({
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
    isFetched: projectsQuery.isFetched,
  });
  const projects = useMemo(
    () =>
      filterNavigableProjects(projectsRaw).map(p => ({
        id: p.id,
        enterpriseName: p.enterpriseName ?? "",
      })),
    [projectsRaw],
  );

  const inspection = useMemo(() => {
    if (projectsListPending) {
      return { projectId: null as number | null, contextId: null as number | null, staleContext: false };
    }
    return inspectActiveProjectContext(projects, { search });
  }, [projectsListPending, projects, search]);

  useInvalidProjectRedirect({
    projectsLoading: projectsListPending,
    projects,
    contextProjectId: inspection.contextId,
  });

  const resolvedProjectId = useMemo(() => {
    if (projectsListPending || inspection.staleContext) return undefined;
    return inspection.projectId ?? undefined;
  }, [projectsListPending, inspection]);

  const [selectedProjectId, setSelectedProjectIdState] = useState<number | undefined>(resolvedProjectId);

  useEffect(() => {
    setSelectedProjectIdState(resolvedProjectId);
    if (resolvedProjectId) setActiveProjectId(resolvedProjectId);
  }, [resolvedProjectId]);

  useEffect(() => {
    if (projectsListPending || PATHS_SKIP_URL_SYNC.has(pathname)) return;
    const fromUrl = getProjectIdFromUrl(search);
    if (!resolvedProjectId) return;
    if (fromUrl === resolvedProjectId) return;
    setLocation(buildProjectUrl(pathname, resolvedProjectId));
  }, [projectsListPending, pathname, search, resolvedProjectId, setLocation]);

  const setSelectedProjectId = (id?: number) => {
    if (!id) {
      setSelectedProjectIdState(undefined);
      return;
    }
    setActiveProjectId(id);
    setSelectedProjectIdState(id);
    if (!PATHS_SKIP_URL_SYNC.has(pathname)) {
      setLocation(buildProjectUrl(pathname, id));
    }
  };

  const projectInput = useMemo(() => ({ projectId: resolvedProjectId }), [resolvedProjectId]);
  const selectedProject = projects.find(p => p.id === resolvedProjectId) as ProjectOption | undefined;

  return {
    projects: projects as ProjectOption[],
    selectedProjectId: resolvedProjectId,
    selectedProject,
    setSelectedProjectId,
    projectInput,
    enabled: Boolean(resolvedProjectId),
    needsProjectSelection: !projectsListPending && !resolvedProjectId,
    isLoading: projectsListPending,
    projectsLoading: projectsListPending,
  };
}

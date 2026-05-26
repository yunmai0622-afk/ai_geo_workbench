import {
  buildProjectUrl,
  getActiveProjectId,
  getActiveProjectIdFromStorage,
  getPathnameFromLocation,
  getProjectIdFromUrl,
  getSearchFromLocation,
  setActiveProjectId,
} from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export type ProjectOption = { id: number; enterpriseName: string };

const PATHS_SKIP_URL_SYNC = new Set(["/clients"]);

export function useActiveProjectSelection() {
  const [location, setLocation] = useLocation();
  const search = getSearchFromLocation(location);
  const pathname = getPathnameFromLocation(location);
  const { data: projects = [], isLoading: projectsLoading } = trpc.geo.projects.list.useQuery();

  const contextProjectId = useMemo(() => getActiveProjectId({ search }), [search]);

  const resolvedProjectId = useMemo(() => {
    if (!contextProjectId) return undefined;
    return projects.some(p => p.id === contextProjectId) ? contextProjectId : undefined;
  }, [contextProjectId, projects]);

  const [selectedProjectId, setSelectedProjectIdState] = useState<number | undefined>(resolvedProjectId);

  useEffect(() => {
    setSelectedProjectIdState(resolvedProjectId);
    if (resolvedProjectId) setActiveProjectId(resolvedProjectId);
  }, [resolvedProjectId]);

  useEffect(() => {
    if (projectsLoading || PATHS_SKIP_URL_SYNC.has(pathname)) return;
    const fromUrl = getProjectIdFromUrl(search);
    const fromStorage = getActiveProjectIdFromStorage();
    const id = fromUrl ?? fromStorage;
    if (!id || !projects.some(p => p.id === id)) return;
    if (!fromUrl && fromStorage) {
      setLocation(buildProjectUrl(pathname, fromStorage));
    }
  }, [projectsLoading, pathname, search, projects, setLocation]);

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
    needsProjectSelection: !projectsLoading && !resolvedProjectId,
    isLoading: projectsLoading,
    projectsLoading,
  };
}

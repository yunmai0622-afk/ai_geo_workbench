import {
  buildProjectUrl,
  clearActiveProjectId,
  getActiveProjectIdFromStorage,
  getPathnameFromLocation,
  getProjectIdFromSearch,
  getSearchFromLocation,
  setActiveProjectId as persistActiveProjectId,
} from "@/lib/activeProject";
import { useCallback, useMemo } from "react";
import { useLocation } from "wouter";

export function useActiveProjectId() {
  const [location, setLocation] = useLocation();
  const pathname = getPathnameFromLocation(location);
  const search = getSearchFromLocation(location);
  const urlProjectId = useMemo(() => getProjectIdFromSearch(search), [search]);
  const storedId = getActiveProjectIdFromStorage();
  const activeProjectId = urlProjectId ?? storedId ?? null;

  const setActiveProjectId = useCallback(
    (projectId: number | null) => {
      if (projectId === null) {
        clearActiveProjectId();
        setLocation(pathname);
        return;
      }
      persistActiveProjectId(projectId);
      setLocation(buildProjectUrl(pathname, projectId));
    },
    [pathname, setLocation],
  );

  return { activeProjectId, setActiveProjectId };
}

export {
  getActiveProjectId,
  setActiveProjectId,
  clearActiveProjectId,
  buildProjectUrl,
  activateProject,
  resolveActiveProjectId,
} from "@/lib/activeProject";

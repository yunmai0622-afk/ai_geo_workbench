import {
  buildProjectUrl,
  clearActiveProjectId,
  getActiveProjectIdFromStorage,
  getPathnameFromLocation,
  getProjectIdFromSearch,
  getSearchFromLocation,
  setActiveProjectId as persistActiveProjectId,
} from "@/lib/activeProject";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";

export function useActiveProjectId(options?: { syncUrl?: boolean }) {
  const [location, setLocation] = useLocation();
  const pathname = getPathnameFromLocation(location);
  const search = getSearchFromLocation(location);
  const urlProjectId = useMemo(() => getProjectIdFromSearch(search), [search]);

  useEffect(() => {
    if (urlProjectId) persistActiveProjectId(urlProjectId);
  }, [urlProjectId]);

  const storedId = getActiveProjectIdFromStorage();
  const activeProjectId = urlProjectId ?? storedId;

  useEffect(() => {
    if (options?.syncUrl === false) return;
    if (urlProjectId) return;
    if (!storedId) return;
    if (pathname === "/clients" || pathname.startsWith("/legacy/")) return;
    const target = buildProjectUrl(pathname, storedId);
    const current = `${pathname}${search}`;
    if (current !== target) setLocation(target);
  }, [urlProjectId, storedId, pathname, search, setLocation, options?.syncUrl]);

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

export { getActiveProjectId, setActiveProjectId, clearActiveProjectId, buildProjectUrl } from "@/lib/activeProject";

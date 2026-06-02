import {
  clearActiveProjectId,
  getActiveProjectId,
  getPathnameFromLocation,
  getSearchFromLocation,
  INVALID_PROJECT_MESSAGE,
  isProjectIdAccessible,
} from "@/lib/activeProject";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

/** 已在客户管理台或公开/引导页，不再重复跳转 */
let invalidProjectToastShown = false;

function hasShownInvalidProjectToast() {
  return invalidProjectToastShown;
}

function markInvalidProjectToastShown() {
  invalidProjectToastShown = true;
}

/** 单测或二次进入 clients 时可重置 */
export function resetInvalidProjectToastGuard() {
  invalidProjectToastShown = false;
}

const SKIP_INVALID_PROJECT_REDIRECT = new Set([
  "/clients",
  "/onboarding",
  "/landing",
  "/pricing",
  "/register",
  "/status",
]);

type Options = {
  projectsLoading: boolean;
  projects: readonly { id: number }[];
  /** 默认从 URL + sessionStorage 解析 */
  contextProjectId?: number | null;
};

/**
 * URL / session 中的 projectId 不在当前用户项目列表时，清理上下文并跳转 /clients。
 */
export function useInvalidProjectRedirect(options: Options) {
  const [location, setLocation] = useLocation();
  const pathname = getPathnameFromLocation(location);
  const redirectedRef = useRef(false);

  const contextProjectId =
    options.contextProjectId !== undefined
      ? options.contextProjectId
      : getActiveProjectId({ search: getSearchFromLocation(location) });

  const invalidProjectContext =
    !options.projectsLoading &&
    contextProjectId != null &&
    !isProjectIdAccessible(contextProjectId, options.projects);

  useEffect(() => {
    if (!invalidProjectContext) return;
    if (
      SKIP_INVALID_PROJECT_REDIRECT.has(pathname) ||
      pathname.startsWith("/legacy/") ||
      pathname.startsWith("/geo/content/") ||
      pathname.startsWith("/delivery-reports/public/")
    ) {
      if (contextProjectId != null) clearActiveProjectId();
      return;
    }
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    clearActiveProjectId();
    if (!hasShownInvalidProjectToast()) {
      markInvalidProjectToastShown();
      toast.error(INVALID_PROJECT_MESSAGE);
    }
    setLocation("/clients");
  }, [invalidProjectContext, pathname, setLocation, contextProjectId]);

  return { invalidProjectContext };
}

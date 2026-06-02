import type { WorkspaceStageId } from "./workspaceStateMachine";

/** 展示「待绑定发布」顶栏/侧栏入口的页面（项目工作台 + 平台适配发布） */
export const PATHS_WITH_PUBLISH_BIND_NAV = ["/workspace", "/flow", "/content-publishing", "/publish"] as const;

export function normalizeAppPathname(pathname: string): string {
  return pathname.split("?")[0] || pathname;
}

export function shouldShowPublishBindNav(pathname: string): boolean {
  const path = normalizeAppPathname(pathname);
  return (PATHS_WITH_PUBLISH_BIND_NAV as readonly string[]).includes(path);
}

export function isPublishBindStage(stageId: WorkspaceStageId | null | undefined): boolean {
  return stageId === "bind_publish_env";
}

/** 顶栏阶段徽标 / 绑定 CTA：仅在发布相关页展示「待绑定发布」类信息 */
export function shouldShowPublishBindTopChrome(
  pathname: string,
  stageId: WorkspaceStageId | null | undefined,
  stageLabel: string | null | undefined,
): boolean {
  if (!isPublishBindStage(stageId) && stageLabel !== "待绑定发布") {
    return true;
  }
  return shouldShowPublishBindNav(pathname);
}

export type PageShellRoute =
  | "workspace"
  | "enterprise_profile"
  | "ai_diagnosis"
  | "questions"
  | "content_assets"
  | "content_publishing"
  | "inclusion_monitoring"
  | "delivery_reports"
  | "other";

export function resolvePageShellRoute(pathname: string): PageShellRoute {
  const path = normalizeAppPathname(pathname);
  if (path === "/workspace" || path === "/flow") return "workspace";
  if (path === "/enterprise-profile" || path === "/assets" || path === "/projects") {
    return "enterprise_profile";
  }
  if (
    path === "/ai-diagnosis" ||
    path === "/diagnosis" ||
    path === "/responses" ||
    path === "/analysis" ||
    path === "/scores"
  ) {
    return "ai_diagnosis";
  }
  if (path === "/questions") return "questions";
  if (path === "/weekly" || path === "/content-generation" || path === "/articles") {
    return "content_assets";
  }
  if (path === "/content-publishing" || path === "/publish") return "content_publishing";
  if (path === "/inclusion-monitoring" || path === "/monitoring") return "inclusion_monitoring";
  if (path === "/delivery-reports" || path === "/reports") return "delivery_reports";
  return "other";
}

import { LEGACY_ORPHAN_PROJECT_ID } from "./const";

export { LEGACY_ORPHAN_PROJECT_ID };

/** 数据清理后不得再参与路由、菜单 URL、项目切换的演示孤儿 ID */
export function isLegacyOrphanProjectId(projectId: number | null | undefined): boolean {
  return projectId === LEGACY_ORPHAN_PROJECT_ID;
}

export function filterNavigableProjects<T extends { id: number }>(
  projects: readonly T[],
): T[] {
  return projects.filter(p => !isLegacyOrphanProjectId(p.id));
}

export function pickFirstNavigableProjectId(projects: readonly { id: number }[]): number | null {
  for (const p of projects) {
    if (!isLegacyOrphanProjectId(p.id) && Number.isFinite(p.id) && p.id > 0) {
      return p.id;
    }
  }
  return null;
}

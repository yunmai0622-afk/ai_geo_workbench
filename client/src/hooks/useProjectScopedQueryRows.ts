import { useMemo } from "react";

/** 切换企业项目时，在对应 query 未 refetch 完成前不展示上一项目的列表数据。 */
export function useProjectScopedQueryRows<T>(
  projectId: number | undefined,
  query: { data?: readonly T[] | null; isFetched: boolean },
): T[] {
  return useMemo(() => {
    if (!projectId || !query.isFetched) return [];
    return [...(query.data ?? [])];
  }, [projectId, query.data, query.isFetched]);
}

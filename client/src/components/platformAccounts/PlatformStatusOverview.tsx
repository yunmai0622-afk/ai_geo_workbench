import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import {
  buildPublishPlatformStatusOverview,
  formatPlatformStatusLastPublished,
} from "@shared/publishPlatformStatusOverview";
import { useMemo } from "react";

type Props = {
  projectId: number;
  className?: string;
};

export function PlatformStatusOverview({ projectId, className }: Props) {
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery({ projectId });
  const rows = useMemo(() => {
    const groups = accountsQuery.data?.accounts ?? [];
    return buildPublishPlatformStatusOverview(groups);
  }, [accountsQuery.data]);

  return (
    <P0Card testId="platform-status-overview" className={className}>
      <div>
        <h2 className="text-base font-semibold text-gray-900">平台状态总览</h2>
        <p className="mt-1 text-sm text-gray-600">
          各平台账号绑定与发布方式一览；绑定状态来自本地客户端同步。
        </p>
      </div>

      {accountsQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4 text-blue-600" />
          正在加载平台状态…
        </div>
      ) : accountsQuery.isError ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          暂未读取到平台状态，不影响其他建档操作。
        </p>
      ) : (
        <ul
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          data-testid="platform-status-overview-list"
        >
          {rows.map(row => (
            <li
              key={row.kind === "binding" ? row.platform : row.key}
              className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5"
              data-testid={
                row.kind === "binding"
                  ? `platform-status-${row.platform}`
                  : `platform-status-${row.key}`
              }
            >
              <p className="text-sm font-medium text-gray-900">{row.label}</p>
              {row.kind === "manual" ? (
                <p className="mt-1 text-xs text-gray-600">{row.detail}</p>
              ) : (
                <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                  <p>
                    {row.bound ? (
                      <span className="font-medium text-emerald-700">已绑定</span>
                    ) : (
                      <span className="font-medium text-gray-500">未绑定</span>
                    )}
                  </p>
                  {row.platform === "zhihu" ? (
                    <p>
                      最近发布时间：{formatPlatformStatusLastPublished(row.lastPublishedAt)}
                    </p>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </P0Card>
  );
}

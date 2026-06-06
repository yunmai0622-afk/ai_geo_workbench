import { P0Card } from "@/components/geo/P0UiPrimitives";
import { LocalAgentDownloadCard } from "@/components/LocalAgentDownloadCard";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { focusLocalAgentAccountsTab } from "@/lib/localAgentClient";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { flattenPlatformAccountsForServerHeartbeat } from "@/lib/localAgentServerContext";
import { buildPublishPlatformAccountOverview } from "@shared/publishPlatformAccountOverview";
import { isPublishReadyPlatformAccount } from "@shared/publishReadiness";
import { toUserFacingError } from "@shared/userFacingErrors";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

type Props = {
  projectId: number;
  /** 发布页已有折叠下载区时可隐藏内嵌下载卡片 */
  showDownloadCard?: boolean;
  className?: string;
};

export function PublishPlatformAccountsOverview({
  projectId,
  showDownloadCard = true,
  className,
}: Props) {
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery({ projectId });
  const rows = useMemo(() => {
    const groups = accountsQuery.data?.accounts ?? [];
    return buildPublishPlatformAccountOverview(groups);
  }, [accountsQuery.data]);

  const boundCount = rows.filter(r => r.bound).length;
  const accountGroups = accountsQuery.data?.accounts ?? [];
  const flattenedPlatformAccounts = useMemo(
    () => flattenPlatformAccountsForServerHeartbeat(accountGroups),
    [accountGroups],
  );
  const boundPublishAccountCount = useMemo(() => {
    let count = 0;
    for (const group of accountGroups) {
      for (const account of group.accounts ?? []) {
        if (
          isPublishReadyPlatformAccount({
            platform: group.platform,
            accountName: account.accountName,
            isEnabled: account.isEnabled,
            localProfileId: account.localProfileId,
            localAgentId: account.localAgentId,
            sessionStatus: account.sessionStatus,
          })
        ) {
          count += 1;
        }
      }
    }
    return count;
  }, [accountGroups]);

  return (
    <div id="publish-platform-accounts" className={cn("scroll-mt-28", className)}>
    <P0Card testId="publish-platform-accounts-overview">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">管理发布账号</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">
            各平台发布账号需在 GEO 本地发布客户端中登录与维护。网页端仅展示绑定状态，不保存密码、不上传
            Cookie。
          </p>
        </div>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
          已绑定 {boundCount} / {rows.length} 个平台
        </span>
      </div>

      {accountsQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4 text-blue-600" />
          正在加载账号绑定状态…
        </div>
      ) : accountsQuery.isError ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          暂未读取到账号绑定状态，你仍可继续填写建档资料；稍后可刷新页面或在本地客户端完成绑定。
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm" data-testid="publish-platform-accounts-table">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-2.5">平台</th>
                <th className="px-4 py-2.5">绑定状态</th>
                <th className="px-4 py-2.5">已绑定账号</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map(row => (
                <tr key={row.platform} data-testid={`platform-account-row-${row.platform}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.label}</td>
                  <td className="px-4 py-3">
                    {row.bound ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        已绑定
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        未绑定
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.accountNames.length > 0 ? row.accountNames.join("、") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm leading-relaxed text-blue-900">
        <p className="font-medium">在本地客户端管理账号</p>
        <p className="mt-1 text-blue-800/90">
          下载并启动 GEO 本地发布客户端后，在客户端顶部打开「账号环境」，选择平台并创建登录环境。绑定完成后返回本页刷新即可看到最新状态。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            data-testid="open-local-agent-manage-accounts"
            onClick={() => {
              void focusLocalAgentAccountsTab()
                .then(r => {
                  if (r.ok) toast.success("已切换到本地客户端「账号环境」");
                  else toast.error(toUserFacingError(r.message, "无法唤起本地客户端，请手动打开应用"));
                })
                .catch(() => {
                  toast.message("请在本机打开 GEO 本地发布客户端，点击顶部「账号环境」标签");
                });
            }}
          >
            <ExternalLink className="mr-1 size-3.5" />
            打开本地客户端管理账号
          </Button>
          {accountsQuery.isFetched ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              data-testid="refresh-publish-platform-accounts"
              disabled={accountsQuery.isFetching}
              onClick={() => void accountsQuery.refetch()}
            >
              刷新绑定状态
            </Button>
          ) : null}
        </div>
      </div>

      {showDownloadCard ? (
        <div className="mt-4">
          <LocalAgentDownloadCard
            platformAccounts={flattenedPlatformAccounts}
            boundPublishAccountCount={boundPublishAccountCount}
          />
        </div>
      ) : null}
    </P0Card>
    </div>
  );
}

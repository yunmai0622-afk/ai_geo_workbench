import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  resolvePublishStatusLocalAgentLabelFromResolved,
  type LocalAgentConnectionStatus,
  type LocalAgentResolvedConnectionState,
} from "@shared/localAgentConnectionStatus";

type Props = {
  localAgentLabel: string;
  readyAccountCount: number;
  pendingTaskCount: number;
  activeTaskCount: number;
  failedTaskCount: number;
  waitingLinkCount: number;
  checking?: boolean;
  tasksFetching?: boolean;
  onPullTasks: () => void;
  onRefreshAccountStatus: () => void;
  onOpenClient: () => void;
};

export function PublishStatusBar({
  localAgentLabel,
  readyAccountCount,
  pendingTaskCount,
  activeTaskCount,
  failedTaskCount,
  waitingLinkCount,
  checking = false,
  tasksFetching = false,
  onPullTasks,
  onRefreshAccountStatus,
  onOpenClient,
}: Props) {
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="publish-status-overview"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">发布状态总览</h2>
          <p className="mt-1 text-xs text-gray-500">查看待发布任务、客户端连接与账号就绪情况。</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            disabled={tasksFetching}
            data-testid="publish-queue-refresh"
            onClick={onPullTasks}
          >
            {tasksFetching ? "拉取中…" : "立即拉取任务"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            disabled={checking}
            data-testid="publish-status-refresh-accounts"
            onClick={onRefreshAccountStatus}
          >
            刷新账号状态
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            disabled={checking}
            data-testid="publish-open-client"
            onClick={onOpenClient}
          >
            打开客户端
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">本地发布助手状态</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-local-agent">
            {localAgentLabel}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">可发布账号数</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-ready-accounts">
            {readyAccountCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">待发布任务数</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-pending-tasks">
            {pendingTaskCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">发布中数量</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-active-tasks">
            {activeTaskCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">发布失败数量</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-failed-tasks">
            {failedTaskCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">待回填链接数量</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-waiting-links">
            {waitingLinkCount}
          </p>
        </div>
      </div>
    </section>
  );
}

export function resolvePublishStatusLocalAgentLabel(
  status: LocalAgentConnectionStatus,
  connectedOnline: boolean,
  resolvedState?: LocalAgentResolvedConnectionState,
): string {
  if (resolvedState) {
    return resolvePublishStatusLocalAgentLabelFromResolved(resolvedState);
  }
  if (connectedOnline) return "已连接";
  if (status === "DISCONNECTED" || status === "ERROR") return "未连接";
  return "未检测";
}

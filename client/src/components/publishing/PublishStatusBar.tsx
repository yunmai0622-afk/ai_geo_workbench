import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { LocalAgentConnectionStatus } from "@shared/localAgentConnectionStatus";

type Props = {
  localAgentLabel: string;
  readyAccountCount: number;
  pendingTaskCount: number;
  abnormalTaskCount: number;
  checking?: boolean;
  showDisconnectedHint?: boolean;
  onCheckConnection: () => void;
  onRefreshAccountStatus: () => void;
};

export function PublishStatusBar({
  localAgentLabel,
  readyAccountCount,
  pendingTaskCount,
  abnormalTaskCount,
  checking = false,
  showDisconnectedHint = false,
  onCheckConnection,
  onRefreshAccountStatus,
}: Props) {
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
      data-testid="publish-status-bar"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">本地客户端</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-local-agent">
              {localAgentLabel}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">可发布账号</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-ready-accounts">
              {readyAccountCount} 个
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">待发布任务</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-pending-tasks">
              {pendingTaskCount} 条
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">异常任务</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900" data-testid="publish-status-abnormal-tasks">
              {abnormalTaskCount} 条
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <div data-testid="publish-status-check-connection" className="contents">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              disabled={checking}
              data-testid="publish-ready-refresh"
              onClick={onCheckConnection}
            >
              检测客户端连接
            </Button>
          </div>
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
        </div>
      </div>
      {showDisconnectedHint ? (
        <p className="mt-3 text-xs text-gray-600" data-testid="publish-status-disconnected-hint">
          请打开 GEO 本地发布助手后点击检测连接。
        </p>
      ) : null}
    </section>
  );
}

export function resolvePublishStatusLocalAgentLabel(
  status: LocalAgentConnectionStatus,
  connectedOnline: boolean,
): string {
  if (connectedOnline) return "已连接";
  if (status === "DISCONNECTED" || status === "ERROR") return "未连接";
  return "未检测";
}

import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  LOCAL_AGENT_TROUBLESHOOTING_ANCHOR,
  localAgentConnectionCopy,
  type LocalAgentConnectionStatus,
} from "@shared/localAgentConnectionStatus";
import { Download, RefreshCw } from "lucide-react";

export type LocalAgentStatusSnapshot = {
  connected: boolean | null;
  browserReady: boolean | null;
  boundPlatformCount: number | null;
  pendingTaskCount: number | null;
};

function displayMetric(value: number | null, suffix = ""): string {
  if (value == null) return "--";
  return `${value}${suffix}`;
}

export type LocalAgentUpdateNotice = {
  clientVersion: string;
  manifestVersion: string;
  downloadHref: string;
};

type Props = {
  status: LocalAgentConnectionStatus;
  statusSnapshot: LocalAgentStatusSnapshot;
  checking?: boolean;
  onCheckConnection?: () => void;
  onRefreshAccountStatus?: () => void;
  updateNotice?: LocalAgentUpdateNotice | null;
};

export function LocalAgentStatusCard({
  status,
  statusSnapshot,
  checking,
  onCheckConnection,
  onRefreshAccountStatus,
  updateNotice,
}: Props) {
  const copy = localAgentConnectionCopy(status);
  const connectionLabel =
    statusSnapshot.connected === null ? "--" : statusSnapshot.connected ? "已连接" : "未连接";
  const browserLabel =
    statusSnapshot.browserReady === null
      ? "--"
      : statusSnapshot.browserReady
        ? "已准备好"
        : "未检测到";
  const primaryAction =
    copy.primaryButton === "刷新账号状态" ? onRefreshAccountStatus : onCheckConnection;

  return (
    <P0Card testId="local-agent-status-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={geoP0Surfaces.sectionTitle}>{copy.title}</p>
          <p className={`mt-1 ${geoP0Surfaces.muted}`}>{copy.description}</p>
        </div>
        {copy.primaryButton && primaryAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            disabled={checking}
            onClick={() => void primaryAction()}
            data-testid="local-agent-status-primary-action"
          >
            <RefreshCw className={`mr-1 size-3.5 ${checking ? "animate-spin" : ""}`} />
            {copy.primaryButton}
          </Button>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="连接状态" value={connectionLabel} />
        <Metric label="本地浏览器" value={browserLabel} />
        <Metric label="已绑定平台" value={displayMetric(statusSnapshot.boundPlatformCount, " 个")} />
        <Metric label="待发布任务" value={displayMetric(statusSnapshot.pendingTaskCount, " 条")} />
      </dl>
      {copy.secondaryButton ? (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            asChild
            data-testid="local-agent-status-secondary-action"
          >
            <a href={LOCAL_AGENT_TROUBLESHOOTING_ANCHOR}>{copy.secondaryButton}</a>
          </Button>
        </div>
      ) : null}
      {updateNotice ? (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="local-agent-update-notice"
        >
          <p className="font-medium">有新版本可用，建议更新客户端</p>
          <p className="mt-1 text-amber-800">
            当前客户端 v{updateNotice.clientVersion}，最新版本 v{updateNotice.manifestVersion}
          </p>
          <Button
            type="button"
            size="sm"
            className={`mt-3 ${geoP0Brand.primary}`}
            asChild
            data-testid="local-agent-update-download"
          >
            <a href={updateNotice.downloadHref} download>
              <Download className="mr-1.5 size-3.5" />
              下载最新客户端
            </a>
          </Button>
        </div>
      ) : null}
    </P0Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

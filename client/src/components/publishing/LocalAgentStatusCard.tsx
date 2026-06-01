import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
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
  status: LocalAgentStatusSnapshot;
  checking?: boolean;
  onRefresh?: () => void;
  updateNotice?: LocalAgentUpdateNotice | null;
};

export function LocalAgentStatusCard({ status, checking, onRefresh, updateNotice }: Props) {
  const connectionLabel =
    status.connected === null ? "--" : status.connected ? "已连接" : "未连接";
  const browserLabel =
    status.browserReady === null ? "--" : status.browserReady ? "已准备好" : "未检测到";

  return (
    <P0Card testId="local-agent-status-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={geoP0Surfaces.sectionTitle}>Local Agent 状态</p>
          <p className={`mt-1 ${geoP0Surfaces.muted}`}>本地发布客户端连接与账号准备情况</p>
        </div>
        {onRefresh ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            disabled={checking}
            onClick={onRefresh}
          >
            <RefreshCw className={`mr-1 size-3.5 ${checking ? "animate-spin" : ""}`} />
            检测连接
          </Button>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="连接状态" value={connectionLabel} />
        <Metric label="本地浏览器" value={browserLabel} />
        <Metric label="已绑定平台" value={displayMetric(status.boundPlatformCount, " 个")} />
        <Metric label="待发布任务" value={displayMetric(status.pendingTaskCount, " 条")} />
      </dl>
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

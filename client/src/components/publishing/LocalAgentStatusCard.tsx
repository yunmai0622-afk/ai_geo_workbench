import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { RefreshCw } from "lucide-react";

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

type Props = {
  status: LocalAgentStatusSnapshot;
  checking?: boolean;
  onRefresh?: () => void;
};

export function LocalAgentStatusCard({ status, checking, onRefresh }: Props) {
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
    </P0Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

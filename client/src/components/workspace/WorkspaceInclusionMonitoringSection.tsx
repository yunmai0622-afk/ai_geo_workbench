import { P0Card, P0Section } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";
import {
  formatInclusionCheckedAtLabel,
  workspaceInclusionEmptyGuide,
  type WorkspaceInclusionPlatformRow,
} from "@shared/workspaceInclusionMonitoring";
import { ArrowRight, RadioTower } from "lucide-react";

function inclusionStatusTone(status: string): string {
  if (status === "已收录") return "text-emerald-700 bg-emerald-50 border-emerald-100";
  if (status === "未收录" || status === "检测失败") return "text-amber-800 bg-amber-50 border-amber-100";
  if (status === "检测中") return "text-blue-800 bg-blue-50 border-blue-100";
  return "text-gray-700 bg-gray-50 border-gray-100";
}

type Props = {
  loading: boolean;
  platformRows: WorkspaceInclusionPlatformRow[];
  publishRecordCount: number;
  monitoringRecordCount: number;
  onOpenMonitoring: () => void;
  onOpenPublishing: () => void;
};

export function WorkspaceInclusionMonitoringSection({
  loading,
  platformRows,
  publishRecordCount,
  monitoringRecordCount,
  onOpenMonitoring,
  onOpenPublishing,
}: Props) {
  const emptyGuide = workspaceInclusionEmptyGuide({
    monitoringCount: monitoringRecordCount,
    publishRecordCount,
  });
  const emptyCta =
    monitoringRecordCount === 0 && publishRecordCount === 0 ? onOpenPublishing : onOpenMonitoring;

  return (
    <P0Section
      title="收录监测明细"
      description="按发布平台查看收录检测状态与最近检测时间；不承诺保证收录或排名。"
    >
      <div className="geo-card p-5" data-testid="workspace-inclusion-monitoring-section">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Spinner className="size-5 text-blue-600" />
            正在加载收录监测…
          </div>
        ) : platformRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-8 text-center">
            <RadioTower className="mx-auto h-9 w-9 text-gray-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-gray-800">{emptyGuide.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{emptyGuide.description}</p>
            <Button
              type="button"
              className={cn("mt-4 rounded-xl", geoP0Brand.primary)}
              data-testid="workspace-inclusion-monitoring-empty-cta"
              onClick={emptyCta}
            >
              {emptyGuide.ctaLabel}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm" data-testid="workspace-inclusion-platform-table">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                    <th className="pb-2 pr-4 font-medium">发布平台</th>
                    <th className="pb-2 pr-4 font-medium">收录状态</th>
                    <th className="pb-2 font-medium">最近检测时间</th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map(row => (
                    <tr
                      key={row.platform}
                      className="border-b border-gray-50 last:border-0"
                      data-testid={`workspace-inclusion-row-${row.platform}`}
                    >
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {row.platform}
                        {row.recordCount > 1 ? (
                          <span className="ml-1 text-xs font-normal text-gray-400">({row.recordCount} 条)</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            inclusionStatusTone(row.inclusionStatus),
                          )}
                        >
                          {row.inclusionStatus}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600 tabular-nums">
                        {formatInclusionCheckedAtLabel(row.lastCheckedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">
                共 {monitoringRecordCount} 条监测记录，覆盖 {platformRows.length} 个发布平台
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg border-gray-200"
                data-testid="workspace-inclusion-monitoring-detail-cta"
                onClick={onOpenMonitoring}
              >
                查看收录监测详情
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
      <P0Card className="text-xs leading-relaxed text-gray-500">
        收录状态来自系统对已登记公开链接的检测记录；样本量有限，不代表全网收录结果。
      </P0Card>
    </P0Section>
  );
}

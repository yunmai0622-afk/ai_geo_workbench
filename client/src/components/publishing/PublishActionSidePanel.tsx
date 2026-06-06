import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { LocalAgentPublishStepsPanel } from "@/components/publishing/LocalAgentPublishStepsPanel";

type Props = {
  projectId?: number;
  publishAllBusy?: boolean;
  publishAllDisabled?: boolean;
  readyPlatformCount?: number;
  onPublishAll: () => void;
  onGenerateWeekly: () => void;
  onViewHistory: () => void;
};

export function PublishActionSidePanel({
  projectId,
  publishAllBusy,
  publishAllDisabled,
  readyPlatformCount = 0,
  onPublishAll,
  onGenerateWeekly,
  onViewHistory,
}: Props) {
  return (
    <div className="space-y-4 lg:sticky lg:top-20" data-testid="publish-action-side-panel">
      <P0Card testId="publish-action-panel">
        <p className="text-sm font-semibold text-gray-900">发布操作</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          一键将各平台「待发布」内容加入本地发布队列；需保持 Local Agent 运行并在平台人工确认。
        </p>
        <div className="mt-4 space-y-2">
          <Button
            type="button"
            className={`w-full ${geoP0Brand.primary}`}
            size="lg"
            disabled={publishAllDisabled || publishAllBusy}
            data-testid="publish-all-platforms"
            onClick={onPublishAll}
          >
            {publishAllBusy ? "正在加入队列…" : "一键发布所有平台"}
          </Button>
          {readyPlatformCount > 0 ? (
            <p className="text-center text-xs text-gray-500">
              当前有 {readyPlatformCount} 个平台内容待发布
            </p>
          ) : (
            <p className="text-center text-xs text-gray-500">暂无待发布平台内容</p>
          )}
          <Button
            type="button"
            variant="outline"
            className={`w-full ${geoP0Brand.primaryOutline}`}
            data-testid="publish-generate-weekly-content"
            onClick={onGenerateWeekly}
          >
            生成本周内容
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-blue-700 hover:text-blue-800"
            data-testid="publish-view-history"
            onClick={onViewHistory}
          >
            查看发布历史
          </Button>
        </div>
      </P0Card>

      <LocalAgentPublishStepsPanel projectId={projectId} />
    </div>
  );
}

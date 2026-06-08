import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { LocalAgentConnectionStatus } from "@shared/localAgentConnectionStatus";
import { ArrowRight } from "lucide-react";

type Props = {
  status: LocalAgentConnectionStatus;
  onGoPublishingPage?: () => void;
};

export function WeeklyLocalAgentStatusBar({ status, onGoPublishingPage }: Props) {
  const connected =
    status === "CONNECTED" || status === "CONNECTED_ACCOUNT_NOT_SYNCED";

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="weekly-local-agent-status-bar"
    >
      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">本地发布助手：</span>
        <span data-testid="weekly-local-agent-status-label">{connected ? "已连接" : "未连接"}</span>
      </p>
      {onGoPublishingPage ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={geoP0Brand.primaryOutline}
          data-testid="weekly-go-platform-publishing"
          onClick={onGoPublishingPage}
        >
          去发布执行中心处理
          <ArrowRight className="ml-1.5 size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

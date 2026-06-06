import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  LOCAL_AGENT_TROUBLESHOOTING_ANCHOR,
  localAgentConnectionCopy,
  type LocalAgentConnectionStatus,
} from "@shared/localAgentConnectionStatus";
import { RefreshCw } from "lucide-react";

type Props = {
  status: LocalAgentConnectionStatus;
  checking?: boolean;
  onCheckConnection?: () => void;
  onRefreshAccountStatus?: () => void;
  className?: string;
};

export function LocalAgentConnectionPanel({
  status,
  checking = false,
  onCheckConnection,
  onRefreshAccountStatus,
  className,
}: Props) {
  const copy = localAgentConnectionCopy(status);
  const primaryAction =
    copy.primaryButton === "刷新账号状态" ? onRefreshAccountStatus : onCheckConnection;

  return (
    <div
      className={className ?? "rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"}
      data-testid="local-agent-connection-panel"
    >
      <p className="font-medium text-gray-800">{copy.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">{copy.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {copy.primaryButton && primaryAction ? (
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            disabled={checking}
            data-testid="local-agent-connection-primary"
            onClick={() => void primaryAction()}
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${checking ? "animate-spin" : ""}`} />
            {copy.primaryButton}
          </Button>
        ) : null}
        {copy.secondaryButton ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="local-agent-connection-secondary"
            asChild
          >
            <a href={LOCAL_AGENT_TROUBLESHOOTING_ANCHOR}>{copy.secondaryButton}</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

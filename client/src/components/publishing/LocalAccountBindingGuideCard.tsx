import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { focusLocalAgentAccountsTab } from "@/lib/localAgentClient";
import {
  formatCreatablePlatformList,
  formatPendingPlatformList,
  LOCAL_AGENT_ACCOUNT_BINDING_BODY,
  LOCAL_AGENT_ACCOUNT_BINDING_TITLE,
  LOCAL_AGENT_CONNECTED_NO_ACCOUNT_HINT,
  LOCAL_AGENT_NOT_CONNECTED_HINT,
} from "@shared/localAgentAccountBinding";
import { toUserFacingError } from "@shared/userFacingErrors";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Props = {
  localAgentOnline: boolean | null;
  boundPlatformCount: number;
  checking?: boolean;
  onRefresh?: () => void;
};

export function LocalAccountBindingGuideCard({
  localAgentOnline,
  boundPlatformCount,
  checking,
  onRefresh,
}: Props) {
  const needsGuide = boundPlatformCount === 0;
  if (!needsGuide) return null;

  const showNotConnected = localAgentOnline === false;
  const showConnectedNoAccount = localAgentOnline === true && boundPlatformCount === 0;

  return (
    <P0Card testId="local-account-binding-guide" className="border-amber-200 bg-amber-50/80">
      <p className="text-sm font-semibold text-amber-900">{LOCAL_AGENT_ACCOUNT_BINDING_TITLE}</p>
      <p className="mt-2 text-sm leading-relaxed text-amber-800">{LOCAL_AGENT_ACCOUNT_BINDING_BODY}</p>
      <p className="mt-2 text-xs text-amber-700/90">
        当前可在客户端创建：{formatCreatablePlatformList()}。即将支持：{formatPendingPlatformList()}。
      </p>
      {showNotConnected ? (
        <p className="mt-2 text-sm text-amber-800" data-testid="local-agent-not-connected-hint">
          {LOCAL_AGENT_NOT_CONNECTED_HINT}
        </p>
      ) : null}
      {showConnectedNoAccount ? (
        <p className="mt-2 text-sm text-amber-800" data-testid="local-agent-no-account-hint">
          {LOCAL_AGENT_CONNECTED_NO_ACCOUNT_HINT}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className={geoP0Brand.primary}
          data-testid="open-local-agent-accounts"
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
          打开本地客户端账号环境
        </Button>
        {onRefresh ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            disabled={checking}
            data-testid="refresh-account-binding-status"
            onClick={onRefresh}
          >
            <RefreshCw className={`mr-1 size-3.5 ${checking ? "animate-spin" : ""}`} />
            刷新账号状态
          </Button>
        ) : null}
      </div>
      <details className="mt-3 text-xs text-amber-800/90">
        <summary className="cursor-pointer font-medium">查看绑定说明</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>下载并打开 GEO 本地发布客户端（见本页下方「下载 Local Agent」）。</li>
          <li>在客户端点击「账号环境」，左侧选择平台（如知乎）。</li>
          <li>点击「创建知乎账号环境」，在打开的浏览器中登录。</li>
          <li>返回本页点击「刷新账号状态」，并在企业档案中完成账号绑定关联。</li>
        </ol>
      </details>
    </P0Card>
  );
}

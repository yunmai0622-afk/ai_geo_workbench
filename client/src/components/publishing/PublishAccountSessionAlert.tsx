import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { openLocalAgentLogin } from "@/lib/localAgentClient";
import { trpc } from "@/lib/trpc";
import {
  collectExpiredPublishAccounts,
  formatPublishAccountLastValidAt,
  publishAccountHealthPlatformLabel,
  type PublishAccountHealthGroup,
} from "@shared/publishAccountHealthCheck";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  projectId: number;
  groups: ReadonlyArray<PublishAccountHealthGroup>;
  checking?: boolean;
  localAgentConnectedOnline?: boolean;
  onAfterRelogin?: () => void;
  className?: string;
};

export function PublishAccountSessionAlert({
  projectId,
  groups = [],
  checking = false,
  localAgentConnectedOnline = false,
  onAfterRelogin,
  className,
}: Props) {
  const [reloginProfileId, setReloginProfileId] = useState<string | null>(null);
  const expiredAccounts = useMemo(() => collectExpiredPublishAccounts(groups), [groups]);

  if (expiredAccounts.length === 0 && !checking) {
    return null;
  }

  async function handleRelogin(profileId: string | null) {
    if (!profileId) {
      toast.error("该账号未关联本地环境，请先到企业档案重新绑定");
      return;
    }
    setReloginProfileId(profileId);
    try {
      await openLocalAgentLogin(profileId);
      toast.success("已打开本地登录窗口，完成登录后系统将自动更新状态");
      onAfterRelogin?.();
    } catch (e) {
      toast.error(toUserFacingErrorFromUnknown(e, "无法打开登录窗口，请在本机打开 GEO 本地发布客户端"));
    } finally {
      setReloginProfileId(null);
    }
  }

  return (
    <div
      className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900 ${className ?? ""}`}
      data-testid="publish-account-session-alert"
      role="alert"
    >
      <div className="flex flex-wrap items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-red-800">发布账号登录已失效</p>
            <p className="mt-1 text-sm text-red-700/90">
              {!localAgentConnectedOnline
                ? "本地发布助手未连接，无法自动检测；请先打开客户端后刷新本页。"
                : "以下账号需重新登录后才能继续发布。登录完成后可点击「刷新检测」更新状态。"}
            </p>
          </div>

          {checking ? (
            <div className="flex items-center gap-2 text-sm text-red-700">
              <Spinner className="size-4 text-red-600" />
              正在检查账号登录状态…
            </div>
          ) : (
            <ul className="space-y-2 text-sm" data-testid="publish-account-session-alert-list">
              {expiredAccounts.map(row => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-md border border-red-200/80 bg-white/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`publish-account-expired-${row.id}`}
                >
                  <div>
                    <p className="font-medium text-red-900">
                      {publishAccountHealthPlatformLabel(row.platform)} · {row.accountName}
                    </p>
                    <p className="mt-0.5 text-xs text-red-700/90">
                      最后有效时间：{formatPublishAccountLastValidAt(row.lastLoginAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-red-300 bg-white text-red-800 hover:bg-red-50"
                    data-testid={`publish-account-relogin-${row.id}`}
                    disabled={reloginProfileId === row.localProfileId}
                    onClick={() => void handleRelogin(row.localProfileId)}
                  >
                    {reloginProfileId === row.localProfileId ? "正在打开…" : "重新登录"}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!checking && expiredAccounts.length > 0 ? (
            <RefreshCheckButton projectId={projectId} onDone={onAfterRelogin} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RefreshCheckButton({
  projectId,
  onDone,
}: {
  projectId: number;
  onDone?: () => void;
}) {
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={`border-red-300 bg-white text-red-800 hover:bg-red-50 ${geoP0Brand.primaryOutline}`}
      data-testid="publish-account-refresh-check"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void utils.geo.platformAccounts.list
          .invalidate({ projectId })
          .then(() => {
            onDone?.();
            toast.success("已刷新账号状态");
          })
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "刷新中…" : "刷新检测"}
    </Button>
  );
}

import { PublishAccountBindDialog, type PublishAccountBindDialogMode } from "@/components/publishing/PublishAccountBindDialog";
import type { LocalAgentConnectionCheckResult } from "@/hooks/useLocalAgentConnection";
import { focusLocalAgentAccountsTab } from "@/lib/localAgentClient";
import {
  fetchLocalAgentDownloadManifest,
  pickLocalAgentDownloadHref,
} from "@/lib/localAgentDownloadManifest";
import type {
  LocalAgentConnectionStatus,
  LocalAgentResolvedConnectionState,
} from "@shared/localAgentConnectionStatus";
import {
  publishAccountBindCtaLabel,
  resolvePublishAccountBindCtaState,
  type PublishAccountBindCtaState,
} from "@shared/publishAccountBindCta";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export function openPublishPlatformAccountsFold(): void {
  const el = document.querySelector('[data-testid="publish-platform-accounts-fold"]');
  if (el instanceof HTMLDetailsElement) {
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

type Input = {
  projectId?: number;
  boundPublishAccountCount: number;
  localAgentConnectionStatus: LocalAgentConnectionStatus;
  localAgentConnectedOnline: boolean;
  localAgentResolvedState?: LocalAgentResolvedConnectionState;
  localAccountSnapshotEmpty?: boolean;
  checking?: boolean;
  checkConnection: () => Promise<LocalAgentConnectionCheckResult>;
  refreshAccountStatus?: () => Promise<void>;
};

export function usePublishAccountBindCta(input: Input) {
  const [dialogMode, setDialogMode] = useState<PublishAccountBindDialogMode>(null);
  const [actionChecking, setActionChecking] = useState(false);

  const ctaState: PublishAccountBindCtaState = useMemo(
    () =>
      resolvePublishAccountBindCtaState({
        localAgentConnectionStatus: input.localAgentConnectionStatus,
        localAgentConnectedOnline: input.localAgentConnectedOnline,
        localAgentResolvedState: input.localAgentResolvedState,
        boundPublishAccountCount: input.boundPublishAccountCount,
        localAccountSnapshotEmpty: input.localAccountSnapshotEmpty,
      }),
    [
      input.boundPublishAccountCount,
      input.localAccountSnapshotEmpty,
      input.localAgentConnectedOnline,
      input.localAgentConnectionStatus,
      input.localAgentResolvedState,
    ],
  );

  const ctaLabel = publishAccountBindCtaLabel(ctaState);
  const checking = Boolean(input.checking || actionChecking);

  const handleDownloadClient = useCallback(async () => {
    const manifest = await fetchLocalAgentDownloadManifest();
    const href = pickLocalAgentDownloadHref(manifest);
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      toast.message("已开始下载本地发布客户端，请安装后打开并确认「GEO Web 已连接」");
      return;
    }
    openPublishPlatformAccountsFold();
    toast.message("请在本页下方「下载 Local Agent」区域获取安装包");
  }, []);

  const handleOpenAccountsTab = useCallback(async () => {
    const result = await focusLocalAgentAccountsTab();
    if (result.ok) {
      toast.success("已切换到本地客户端「账号环境」");
      return;
    }
    toast.message("请手动打开 GEO 本地发布助手，并进入「账号环境」");
  }, []);

  const runRefreshAccountStatus = useCallback(async () => {
    if (!input.refreshAccountStatus) {
      toast.message("正在刷新账号状态…");
      await input.checkConnection();
      toast.success("账号状态已更新");
      return;
    }
    setActionChecking(true);
    toast.message("正在刷新账号状态…");
    try {
      await input.refreshAccountStatus();
      toast.success("账号状态已同步");
    } catch (e) {
      toast.error(
        toUserFacingErrorFromUnknown(
          e,
          "账号状态同步失败，请在本地客户端「账号环境」中重新检测。",
        ),
      );
    } finally {
      setActionChecking(false);
    }
  }, [input]);

  const handlePublishAccountBindCta = useCallback(async () => {
    switch (ctaState) {
      case "not_connected":
        setDialogMode("not_connected");
        return;
      case "not_synced":
        await runRefreshAccountStatus();
        return;
      case "not_bound":
        setDialogMode("not_bound");
        return;
      case "bound":
        openPublishPlatformAccountsFold();
        toast.message(`已绑定 ${input.boundPublishAccountCount} 个可发布账号，可在下方管理`);
        return;
    }
  }, [ctaState, input.boundPublishAccountCount, runRefreshAccountStatus]);

  const handleDialogCheckConnection = useCallback(async () => {
    setActionChecking(true);
    try {
      const result = await input.checkConnection();
      if (result.online) {
        setDialogMode(null);
        if (result.feedback.kind === "success") toast.success(result.feedback.message);
        else toast.message(result.feedback.message);
        if (result.status === "CONNECTED_ACCOUNT_NOT_SYNCED") {
          await runRefreshAccountStatus();
        }
        return;
      }
      toast.error(result.feedback.message);
    } finally {
      setActionChecking(false);
    }
  }, [input, runRefreshAccountStatus]);

  const handleDialogRefreshAccounts = useCallback(async () => {
    await runRefreshAccountStatus();
    setDialogMode(null);
  }, [runRefreshAccountStatus]);

  const dialog = (
    <PublishAccountBindDialog
      mode={dialogMode}
      checking={checking}
      onOpenChange={open => {
        if (!open) setDialogMode(null);
      }}
      onCheckConnection={() => void handleDialogCheckConnection()}
      onDownloadClient={() => void handleDownloadClient()}
      onOpenAccountsTab={() => void handleOpenAccountsTab()}
      onRefreshAccounts={() => void handleDialogRefreshAccounts()}
    />
  );

  return {
    ctaState,
    ctaLabel,
    checking,
    handlePublishAccountBindCta,
    dialog,
  };
}

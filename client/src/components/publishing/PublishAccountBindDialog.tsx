import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  PUBLISH_ACCOUNT_BIND_NOT_BOUND_DIALOG,
  PUBLISH_ACCOUNT_BIND_NOT_CONNECTED_DIALOG,
} from "@shared/publishAccountBindCta";

export type PublishAccountBindDialogMode = "not_connected" | "not_bound" | null;

type Props = {
  mode: PublishAccountBindDialogMode;
  checking?: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckConnection: () => void;
  onDownloadClient: () => void;
  onOpenAccountsTab: () => void;
  onRefreshAccounts: () => void;
};

export function PublishAccountBindDialog({
  mode,
  checking,
  onOpenChange,
  onCheckConnection,
  onDownloadClient,
  onOpenAccountsTab,
  onRefreshAccounts,
}: Props) {
  const open = mode !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="publish-account-bind-dialog">
        {mode === "not_connected" ? (
          <>
            <DialogHeader>
              <DialogTitle>{PUBLISH_ACCOUNT_BIND_NOT_CONNECTED_DIALOG.title}</DialogTitle>
              <DialogDescription>{PUBLISH_ACCOUNT_BIND_NOT_CONNECTED_DIALOG.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                className={`w-full ${geoP0Brand.primary}`}
                disabled={checking}
                data-testid="publish-bind-dialog-check-connection"
                onClick={onCheckConnection}
              >
                {checking ? "检测中…" : "检测客户端连接"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`w-full ${geoP0Brand.primaryOutline}`}
                data-testid="publish-bind-dialog-download-client"
                onClick={onDownloadClient}
              >
                下载/打开本地客户端
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                data-testid="publish-bind-dialog-cancel"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
            </DialogFooter>
          </>
        ) : null}
        {mode === "not_bound" ? (
          <>
            <DialogHeader>
              <DialogTitle>{PUBLISH_ACCOUNT_BIND_NOT_BOUND_DIALOG.title}</DialogTitle>
              <DialogDescription>{PUBLISH_ACCOUNT_BIND_NOT_BOUND_DIALOG.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                className={`w-full ${geoP0Brand.primary}`}
                data-testid="publish-bind-dialog-open-accounts"
                onClick={onOpenAccountsTab}
              >
                打开本地客户端账号环境
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`w-full ${geoP0Brand.primaryOutline}`}
                disabled={checking}
                data-testid="publish-bind-dialog-refresh-accounts"
                onClick={onRefreshAccounts}
              >
                {checking ? "刷新中…" : "我已完成，刷新账号状态"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                data-testid="publish-bind-dialog-cancel-bound"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

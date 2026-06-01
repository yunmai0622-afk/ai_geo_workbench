import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildDangerousActionConfirmMessage } from "@shared/dangerousActionConfirm";

type DangerousActionConfirmDialogProps = {
  open: boolean;
  operationName: string | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DangerousActionConfirmDialog({
  open,
  operationName,
  pending,
  onOpenChange,
  onConfirm,
}: DangerousActionConfirmDialogProps) {
  const message = operationName ? buildDangerousActionConfirmMessage(operationName) : "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dangerous-action-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>请确认操作</AlertDialogTitle>
          <AlertDialogDescription data-testid="dangerous-action-confirm-message">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} data-testid="dangerous-action-confirm-cancel">
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !operationName}
            data-testid="dangerous-action-confirm-submit"
            onClick={event => {
              event.preventDefault();
              onConfirm();
            }}
          >
            确认
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

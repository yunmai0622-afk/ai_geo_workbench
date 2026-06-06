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
import type { AiDiagnosisRerunConfirmCopy } from "@shared/aiDiagnosisManualT0Gate";

type Props = {
  open: boolean;
  copy: AiDiagnosisRerunConfirmCopy | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function AiDiagnosisRerunConfirmDialog({ open, copy, pending, onOpenChange, onConfirm }: Props) {
  if (!copy) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="ai-diagnosis-rerun-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="ai-diagnosis-rerun-confirm-title">{copy.title}</AlertDialogTitle>
          <AlertDialogDescription data-testid="ai-diagnosis-rerun-confirm-body">{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} data-testid="ai-diagnosis-rerun-confirm-cancel">
            {copy.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            data-testid="ai-diagnosis-rerun-confirm-submit"
            onClick={event => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

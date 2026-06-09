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
import type { T0StartConfirmCopy } from "@shared/aiDiagnosisManualT0Gate";

type Props = {
  open: boolean;
  copy: T0StartConfirmCopy | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function AiDiagnosisT0ConfirmDialog({ open, copy, pending, onOpenChange, onConfirm }: Props) {
  if (!copy) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="ai-diagnosis-t0-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="ai-diagnosis-t0-confirm-title">{copy.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-gray-600">
              <p data-testid="ai-diagnosis-t0-confirm-intro">{copy.intro}</p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800">
                <p className="font-medium text-gray-900">检测范围：</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li data-testid="ai-diagnosis-t0-confirm-question-count">启用问题：{copy.questionCount} 个</li>
                  <li data-testid="ai-diagnosis-t0-confirm-platform-count">检测平台：{copy.platformCount} 个</li>
                  <li data-testid="ai-diagnosis-t0-confirm-estimated-minutes">
                    {copy.estimatedMinutesLabel ?? `预计耗时：约 ${copy.estimatedMinutes} 分钟`}
                  </li>
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">{copy.footerNote}</p>
                {copy.backgroundMode ? (
                  <p className="mt-2 text-xs leading-relaxed text-indigo-800">
                    可查看检测进度，或稍后刷新结果；无需一直停留在此页面等待。
                  </p>
                ) : null}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} data-testid="ai-diagnosis-t0-confirm-cancel">
            {copy.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            data-testid="ai-diagnosis-t0-confirm-submit"
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

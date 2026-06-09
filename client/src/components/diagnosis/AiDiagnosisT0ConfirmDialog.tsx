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
                <p className="font-medium text-gray-900">本次将检测：</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li data-testid="ai-diagnosis-t0-confirm-question-count">
                    {copy.questionCount} 个客户常问问题
                  </li>
                  <li data-testid="ai-diagnosis-t0-confirm-platform-count">{copy.platformCount} 个 AI 平台</li>
                  <li data-testid="ai-diagnosis-t0-confirm-analysis-count">
                    约 {copy.analysisCount} 次 AI 回答分析
                  </li>
                </ul>
                {copy.estimatedMinutesLabel ? (
                  <p
                    className="mt-2 text-xs leading-relaxed text-indigo-800"
                    data-testid="ai-diagnosis-t0-confirm-estimated-minutes"
                  >
                    {copy.estimatedMinutesLabel}
                  </p>
                ) : copy.footerNote ? (
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{copy.footerNote}</p>
                ) : null}
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-800">
                <p className="font-medium text-gray-900">完成后你将看到：</p>
                <ul
                  className="mt-2 list-inside list-disc space-y-1"
                  data-testid="ai-diagnosis-t0-confirm-completion-outcomes"
                >
                  {copy.completionOutcomes.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
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

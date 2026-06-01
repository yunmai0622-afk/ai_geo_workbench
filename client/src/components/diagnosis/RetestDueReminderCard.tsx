import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { RetestDueReminder } from "@shared/retestPlan";
import { AlertCircle } from "lucide-react";

type Props = {
  reminder: RetestDueReminder | null | undefined;
  onGoRetest: () => void;
  testId?: string;
};

/** T1/T2/T3 到期复测提醒条（与 T1 自动提醒交互一致） */
export function RetestDueReminderCard({ reminder, onGoRetest, testId = "retest-due-reminder-card" }: Props) {
  if (!reminder) return null;

  return (
    <div
      role="status"
      data-testid={testId}
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2 text-sm text-amber-950">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <p className="font-medium leading-relaxed">{reminder.message}</p>
      </div>
      <Button
        type="button"
        size="sm"
        className={geoP0Brand.primary}
        data-testid="retest-due-reminder-go-diagnosis"
        onClick={onGoRetest}
      >
        {reminder.ctaLabel}
      </Button>
    </div>
  );
}

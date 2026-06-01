import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  T1_RETEST_AUTO_TRIGGER_CTA_LABEL,
  T1_RETEST_AUTO_TRIGGER_MESSAGE,
} from "@shared/t1RetestAutoTrigger";
import { AlertCircle } from "lucide-react";

type Props = {
  visible: boolean;
  onGoRetest: () => void;
  testId?: string;
};

/** 发布满 7 天且未完成 T1 复测时的提醒条 */
export function T1RetestReminderCard({ visible, onGoRetest, testId = "t1-retest-reminder-card" }: Props) {
  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid={testId}
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2 text-sm text-amber-950">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <p className="font-medium leading-relaxed">{T1_RETEST_AUTO_TRIGGER_MESSAGE}</p>
      </div>
      <Button
        type="button"
        size="sm"
        className={geoP0Brand.primary}
        data-testid="t1-retest-reminder-go-diagnosis"
        onClick={onGoRetest}
      >
        {T1_RETEST_AUTO_TRIGGER_CTA_LABEL}
      </Button>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { DeliveryReportShareRenewalReminder } from "@shared/deliveryReportPublicShare";
import { AlertCircle } from "lucide-react";

type Props = {
  reminder: DeliveryReportShareRenewalReminder | null | undefined;
  onRenew: () => void;
  renewing?: boolean;
  testId?: string;
};

/** 客户报告分享链接到期前续期提醒条 */
export function DeliveryReportShareRenewalReminderCard({
  reminder,
  onRenew,
  renewing = false,
  testId = "delivery-report-share-renewal-reminder",
}: Props) {
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
        disabled={renewing}
        data-testid="delivery-report-share-renewal-cta"
        onClick={onRenew}
      >
        {reminder.ctaLabel}
      </Button>
    </div>
  );
}

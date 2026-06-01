import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_UPGRADE_PATH } from "@shared/subscriptionLimits";
import { cn } from "@/lib/utils";

type SubscriptionUpgradePromptProps = {
  message: string;
  className?: string;
  testId?: string;
};

export function SubscriptionUpgradePrompt({ message, className, testId = "subscription-upgrade-prompt" }: SubscriptionUpgradePromptProps) {
  return (
    <div
      className={cn("rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950", className)}
      data-testid={testId}
      role="alert"
    >
      <p>{message}</p>
      <Button asChild variant="outline" size="sm" className="mt-3 border-amber-300 bg-white hover:bg-amber-50">
        <Link href={SUBSCRIPTION_UPGRADE_PATH} data-testid="subscription-upgrade-pricing-link">
          查看套餐与升级
        </Link>
      </Button>
    </div>
  );
}

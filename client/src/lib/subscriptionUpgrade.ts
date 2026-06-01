import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { isSubscriptionLimitMessage, SUBSCRIPTION_UPGRADE_PATH } from "@shared/subscriptionLimits";

export function extractTrpcErrorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "";
}

export function showSubscriptionUpgradeToast(message: string): void {
  toast.error(message, {
    action: {
      label: "升级套餐",
      onClick: () => {
        window.location.assign(SUBSCRIPTION_UPGRADE_PATH);
      },
    },
  });
}

/** 若为套餐限额错误则弹出升级引导并返回 true */
export function handleSubscriptionLimitMutationError(err: unknown): boolean {
  const message = extractTrpcErrorMessage(err).trim();
  if (!isSubscriptionLimitMessage(message)) return false;
  showSubscriptionUpgradeToast(message);
  return true;
}

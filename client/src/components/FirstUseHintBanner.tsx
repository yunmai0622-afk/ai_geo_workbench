import { Button } from "@/components/ui/button";
import { useFirstUseHint } from "@/hooks/useFirstUseHint";
import type { FirstUseHintKey } from "@/lib/firstUseHints";
import { cn } from "@/lib/utils";
import { Info, X } from "lucide-react";

type Props = {
  storageKey: FirstUseHintKey;
  message: string;
  className?: string;
  "data-testid"?: string;
};

/** 首次进入页面时展示一次的可关闭说明条 */
export function FirstUseHintBanner({ storageKey, message, className, "data-testid": testId }: Props) {
  const { visible, dismiss } = useFirstUseHint(storageKey);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid={testId ?? "first-use-hint-banner"}
      className={cn(
        "flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">{message}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-blue-700 hover:bg-blue-100 hover:text-blue-900"
        aria-label="关闭提示"
        data-testid={testId ? `${testId}-dismiss` : "first-use-hint-dismiss"}
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

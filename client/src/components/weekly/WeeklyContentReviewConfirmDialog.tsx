import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { geoP0Brand } from "@/lib/geoP0Visual";

export type WeeklyContentReviewDialogMode = "review_only" | "review_and_enqueue";

type Props = {
  open: boolean;
  articleTitle?: string | null;
  confirmed: boolean;
  busy?: boolean;
  mode?: WeeklyContentReviewDialogMode;
  onOpenChange: (open: boolean) => void;
  onConfirmedChange: (confirmed: boolean) => void;
  onConfirm: () => void;
};

export function WeeklyContentReviewConfirmDialog({
  open,
  articleTitle,
  confirmed,
  busy,
  onOpenChange,
  onConfirmedChange,
  onConfirm,
  mode = "review_and_enqueue",
}: Props) {
  const submitLabel =
    mode === "review_only" ? "确认标记已审核" : "确认并加入发布队列";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-gray-200 bg-white text-gray-900 sm:max-w-md"
        data-testid="weekly-content-review-confirm-dialog"
      >
        <DialogHeader>
          <DialogTitle>确认人工审核</DialogTitle>
          <DialogDescription className="text-left text-gray-600">
            {articleTitle ? `${articleTitle} · ` : ""}
            该内容已通过 AI 质检，但尚未完成你的人工审核。请确认标题、正文、封面和发布平台无误后，再加入发布队列。
          </DialogDescription>
        </DialogHeader>
        <label
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
          htmlFor="weekly-review-confirm-checkbox"
        >
          <Checkbox
            id="weekly-review-confirm-checkbox"
            checked={confirmed}
            onCheckedChange={value => onConfirmedChange(value === true)}
            data-testid="weekly-review-confirm-checkbox"
          />
          <span>我已人工确认内容无误，标记为已审核可发布</span>
        </label>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="weekly-review-confirm-cancel"
          >
            取消
          </Button>
          <Button
            type="button"
            className={geoP0Brand.primary}
            disabled={!confirmed || busy}
            data-testid="weekly-review-confirm-submit"
            onClick={onConfirm}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

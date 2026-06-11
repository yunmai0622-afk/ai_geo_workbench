import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";

type Props = {
  currentStep: number;
  saving: boolean;
  onPrev: () => void;
  onSaveDraft: () => void;
  onPrimaryAction: () => void;
};

export function WizardStepFooter({ currentStep, saving, onPrev, onSaveDraft, onPrimaryAction }: Props) {
  const isFinalStep = currentStep >= 8;
  const primaryLabel = isFinalStep ? "完成建档" : "保存并继续";
  const primaryTestId = isFinalStep ? "wizard-complete-profile" : "wizard-save-and-continue";

  return (
    <footer
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5"
      data-testid="wizard-step-footer"
    >
      <Button type="button" variant="outline" disabled={currentStep <= 1 || saving} onClick={onPrev}>
        上一步
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-gray-600"
          disabled={saving}
          data-testid="wizard-save-draft"
          onClick={onSaveDraft}
        >
          {saving ? "保存中…" : "保存草稿"}
        </Button>
        <Button
          type="button"
          className={cn("rounded-xl", geoP0Brand.primary)}
          disabled={saving}
          data-testid={primaryTestId}
          onClick={onPrimaryAction}
        >
          {saving ? "保存中…" : primaryLabel}
        </Button>
      </div>
    </footer>
  );
}

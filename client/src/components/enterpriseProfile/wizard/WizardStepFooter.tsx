import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";

type Props = {
  currentStep: number;
  saving: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
};

export function WizardStepFooter({ currentStep, saving, onPrev, onNext, onSaveDraft }: Props) {
  return (
    <footer
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5"
      data-testid="wizard-step-footer"
    >
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={currentStep <= 1 || saving} onClick={onPrev}>
          上一步
        </Button>
        <Button type="button" variant="outline" disabled={currentStep >= 8 || saving} onClick={onNext}>
          下一步
        </Button>
      </div>
      <Button
        type="button"
        className={cn("rounded-xl", geoP0Brand.primary)}
        disabled={saving}
        data-testid="wizard-save-draft"
        onClick={onSaveDraft}
      >
        {saving ? "保存中…" : "保存草稿"}
      </Button>
    </footer>
  );
}

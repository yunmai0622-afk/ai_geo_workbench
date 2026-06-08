import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";

type Props = {
  stageLabel: string;
  nextStep: string;
  onPrimaryAction: () => void;
  primaryDisabled?: boolean;
};

export function WeeklyContentStatusBar({
  stageLabel,
  nextStep,
  onPrimaryAction,
  primaryDisabled,
}: Props) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      data-testid="weekly-content-status-bar"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">当前工作重点</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-800">
          <p data-testid="weekly-status-stage">
            <span className="font-medium text-gray-500">当前阶段：</span>
            {stageLabel}
          </p>
          <p className="min-w-0" data-testid="weekly-status-next-step">
            <span className="font-medium text-gray-500">下一步：</span>
            {nextStep}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className={geoP0Brand.primary}
        disabled={primaryDisabled}
        data-testid="weekly-status-primary-action"
        onClick={onPrimaryAction}
      >
        审核并生成平台内容
      </Button>
    </div>
  );
}

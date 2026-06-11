import { cn } from "@/lib/utils";
import {
  resolveCompletenessDimensionStatusIcon,
  resolveCompletenessDimensionStatusLabel,
} from "@shared/onboardingCompletenessReport";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { ONBOARDING_WIZARD_STEPS, ONBOARDING_WIZARD_SAVE_HINT } from "@shared/onboardingWizardSteps";

export type WizardDimensionScore = {
  step: number;
  title: string;
  score: number;
};

type Props = {
  currentStep: number;
  stepComplete: Record<number, boolean>;
  completionScore: number;
  dimensionScores?: WizardDimensionScore[];
  children: ReactNode;
  onStepSelect: (step: number) => void;
};

export function OnboardingWizardShell({
  currentStep,
  stepComplete,
  completionScore,
  dimensionScores,
  children,
  onStepSelect,
}: Props) {
  const dimensions =
    dimensionScores ??
    ONBOARDING_WIZARD_STEPS.map(step => ({
      step: step.step,
      title: step.title,
      score: stepComplete[step.step] ? 100 : 0,
    }));

  return (
    <div className="space-y-6" data-testid="onboarding-wizard-layout">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid="wizard-completeness-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700">建档完整度 {completionScore}%</p>
            <p className="text-xs text-gray-500">8 步向导均等加权，补全越多 AI 理解越准确</p>
          </div>
          <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-100 sm:w-64">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, completionScore)}%` }}
              data-testid="wizard-completion-progress"
            />
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-gray-600" data-testid="wizard-save-hint">
          {ONBOARDING_WIZARD_SAVE_HINT}
        </p>

        <div
          className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="wizard-dimension-scores"
        >
          {dimensions.map(dim => {
            const statusIcon = resolveCompletenessDimensionStatusIcon(dim.score);
            const statusLabel = resolveCompletenessDimensionStatusLabel(dim.score);
            return (
              <button
                key={dim.step}
                type="button"
                onClick={() => onStepSelect(dim.step)}
                className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs transition-colors hover:border-blue-200 hover:bg-blue-50"
                data-testid={`wizard-dimension-step-${dim.step}`}
              >
                <span aria-hidden className="shrink-0 text-sm">
                  {statusIcon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-800">{dim.title}</span>
                  <span className="text-[11px] text-gray-500">
                    {dim.score} 分 · {statusLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          aria-label="建档步骤"
          data-testid="wizard-step-nav"
        >
          <ul className="space-y-1">
            {ONBOARDING_WIZARD_STEPS.map(step => {
              const done = stepComplete[step.step];
              const active = currentStep === step.step;
              return (
                <li key={step.step}>
                  <button
                    type="button"
                    onClick={() => onStepSelect(step.step)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active ? "bg-blue-50 text-blue-800" : "text-gray-700 hover:bg-gray-50",
                    )}
                    data-testid={`wizard-nav-step-${step.step}`}
                    data-complete={done ? "true" : "false"}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        done ? "bg-emerald-100 text-emerald-700" : active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : step.step}
                    </span>
                    <span className="font-medium">{step.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" data-testid="wizard-step-content">
          {children}
        </div>
      </div>
    </div>
  );
}

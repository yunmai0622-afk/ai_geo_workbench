import type { OnboardingWizardStepMeta } from "@shared/onboardingWizardSteps";

type Props = {
  meta: OnboardingWizardStepMeta;
};

export function WizardStepHeader({ meta }: Props) {
  return (
    <header className="space-y-3 border-b border-gray-100 pb-5" data-testid={`wizard-step-header-${meta.step}`}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-blue-600">步骤 {meta.step}</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{meta.title}</h2>
      </div>
      <div className="space-y-2 text-sm text-gray-600">
        <p>
          <span className="font-medium text-gray-800">本页目的：</span>
          {meta.purpose}
        </p>
        <p>
          <span className="font-medium text-gray-800">为什么重要：</span>
          {meta.whyImportant}
        </p>
        <p>
          <span className="font-medium text-gray-800">系统会如何使用：</span>
          {meta.systemUsage}
        </p>
      </div>
    </header>
  );
}

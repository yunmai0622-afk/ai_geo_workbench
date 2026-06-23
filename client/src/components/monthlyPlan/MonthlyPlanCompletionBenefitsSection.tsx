import {
  buildMonthlyPlanCompletionBenefitLines,
  MONTHLY_PLAN_COMPLETION_BENEFITS_FOOTNOTE,
  MONTHLY_PLAN_COMPLETION_BENEFITS_TITLE,
} from "@shared/workspaceBrandValueOverview";

export type MonthlyPlanCompletionBenefitsSectionProps = {
  progress: { totalCount: number };
  tasks: Array<{ relatedQuestionId?: number | null; taskType?: string | null }>;
  boundPublishAccountCount?: number | null;
};

export function MonthlyPlanCompletionBenefitsSection({
  progress,
  tasks,
  boundPublishAccountCount,
}: MonthlyPlanCompletionBenefitsSectionProps) {
  const lines = buildMonthlyPlanCompletionBenefitLines({
    progress,
    tasks,
    boundPublishAccountCount,
  });

  if (progress.totalCount <= 0) return null;

  return (
    <section
      className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white p-5 shadow-sm"
      data-testid="monthly-plan-completion-benefits"
    >
      <h2 className="text-base font-semibold text-gray-900">{MONTHLY_PLAN_COMPLETION_BENEFITS_TITLE}</h2>
      <ul className="mt-3 space-y-2 text-sm text-gray-700">
        {lines.map(line => (
          <li key={line.key} className="flex gap-2" data-testid={`monthly-plan-benefit-${line.key}`}>
            <span aria-hidden>·</span>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-gray-600">{MONTHLY_PLAN_COMPLETION_BENEFITS_FOOTNOTE}</p>
    </section>
  );
}

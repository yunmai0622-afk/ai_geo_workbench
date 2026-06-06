import { CheckCircle2, CircleAlert, AlertTriangle } from "lucide-react";
import type { PrePublishChecklistResult } from "@shared/publishPrePublishChecklist";
import type { PublishPreflightCheck } from "@shared/publishPreflight";

type Props = {
  checklist?: PrePublishChecklistResult | null;
  preflightChecks?: PublishPreflightCheck[] | null;
};

export function PublishPrePublishChecklist({ checklist, preflightChecks }: Props) {
  if (preflightChecks && preflightChecks.length > 0) {
    return (
      <div
        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
        data-testid="publish-pre-checklist"
      >
        <p className="text-xs font-medium text-gray-900">发布前自动检查</p>
        <ul className="mt-2 space-y-1.5">
          {preflightChecks.map(row => (
            <li
              key={row.code}
              className="flex items-start gap-2 text-xs"
              data-testid={`pre-check-${row.code}`}
            >
              {row.status === "pass" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ) : row.status === "warning" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              )}
              <span className={row.status === "pass" ? "text-gray-700" : "text-amber-900"}>
                <span className="font-medium">{row.label}</span>
                {row.status !== "pass" && row.message ? (
                  <span className="mt-0.5 block text-amber-800">{row.message}</span>
                ) : null}
                {row.status === "pass" && row.message ? (
                  <span className="mt-0.5 block text-gray-600">{row.message}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!checklist) return null;

  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
      data-testid="publish-pre-checklist"
    >
      <p className="text-xs font-medium text-gray-900">发布前自动检查</p>
      <ul className="mt-2 space-y-1.5">
        {checklist.items.map(row => (
          <li key={row.id} className="flex items-start gap-2 text-xs" data-testid={`pre-check-${row.id}`}>
            {row.passed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
            )}
            <span className={row.passed ? "text-gray-700" : "text-amber-900"}>
              <span className="font-medium">{row.label}</span>
              {!row.passed && row.reason ? (
                <span className="mt-0.5 block text-amber-800">{row.reason}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

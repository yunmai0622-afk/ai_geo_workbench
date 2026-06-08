import { CheckCircle2, CircleAlert, AlertTriangle } from "lucide-react";
import type { PrePublishChecklistResult } from "@shared/publishPrePublishChecklist";
import type { PublishPreflightCheck, PublishPreflightCheckCode } from "@shared/publishPreflight";

type Props = {
  checklist?: PrePublishChecklistResult | null;
  preflightChecks?: PublishPreflightCheck[] | null;
  variant?: "full" | "summary";
  blockingCodes?: PublishPreflightCheckCode[];
};

function PublishPreflightCheckSummary({
  preflightChecks,
  blockingCodes = [],
}: {
  preflightChecks: PublishPreflightCheck[];
  blockingCodes?: PublishPreflightCheckCode[];
}) {
  const total = preflightChecks.length;
  const passed = preflightChecks.filter(row => row.status === "pass").length;
  const failures = preflightChecks.filter(row => row.status === "fail");
  const blockingFailures = failures.filter(row => blockingCodes.includes(row.code));
  const nonBlockingFailures = failures.filter(row => !blockingCodes.includes(row.code));
  const warnings = preflightChecks.filter(row => row.status === "warning");

  if (failures.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2" data-testid="publish-pre-checklist">
        <p className="text-xs text-gray-800" data-testid="publish-pre-checklist-summary">
          ✅ 发布前检查通过（{passed}/{total}）
        </p>
        {warnings.length > 0 ? (
          <p className="mt-1 text-xs text-amber-600" data-testid="publish-pre-checklist-warnings">
            {warnings.map(row => row.message || row.label).join("；")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2" data-testid="publish-pre-checklist">
      <p className="text-xs font-medium text-red-900">
        发布前检查未通过（{passed}/{total}）
      </p>
      {blockingFailures.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {blockingFailures.map(row => (
            <li
              key={row.code}
              className="flex items-start gap-2 text-xs text-red-800"
              data-testid={`pre-check-${row.code}`}
            >
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
              <span>
                <span className="font-medium">{row.label}</span>
                {row.message ? <span className="mt-0.5 block text-red-700">{row.message}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {nonBlockingFailures.length > 0 ? (
        <p className="mt-1 text-xs text-gray-600">
          另有 {nonBlockingFailures.length} 项提示未展开
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <p className="mt-1 text-xs text-amber-600" data-testid="publish-pre-checklist-warnings">
          {warnings.map(row => row.message || row.label).join("；")}
        </p>
      ) : null}
    </div>
  );
}

export function PublishPrePublishChecklist({
  checklist,
  preflightChecks,
  variant = "full",
  blockingCodes,
}: Props) {
  if (preflightChecks && preflightChecks.length > 0) {
    if (variant === "summary") {
      return (
        <PublishPreflightCheckSummary
          preflightChecks={preflightChecks}
          blockingCodes={blockingCodes}
        />
      );
    }

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

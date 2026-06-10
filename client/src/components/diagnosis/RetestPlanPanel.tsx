import { shouldShowRetestPlanAllCompleteMessage, type RetestPlanView } from "@shared/retestPlan";
import { AlertCircle, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";

type Props = {
  plan: RetestPlanView | null | undefined;
  testId?: string;
};

function statusIcon(status: RetestPlanView["milestones"][number]["status"]) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (status === "due") return <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />;
  return <Clock3 className="h-4 w-4 text-gray-400" aria-hidden />;
}

export function RetestPlanPanel({ plan, testId = "retest-plan-panel" }: Props) {
  if (!plan) return null;

  const showAllComplete = shouldShowRetestPlanAllCompleteMessage(plan);

  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      aria-labelledby="retest-plan-heading"
    >
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="retest-plan-heading" className="text-base font-semibold text-gray-900">
            复测时间计划
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            以最近一次平台发布完成时间为起点，安排 T1（7 天）、T2（30 天）、T3（90 天）追踪复测。
            {plan.publishAtLabel ? ` 最近发布：${plan.publishAtLabel}。` : " 完成发布后将自动计算各节点日期。"}
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {plan.milestones.filter(Boolean).map(item => (
          <li
            key={item?.phase ?? "milestone"}
            data-testid={`retest-plan-milestone-${item.phase}`}
            className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2">
              {statusIcon(item?.status ?? "pending")}
              <div>
                <p className="font-medium text-gray-900">
                  {item?.title ?? "复测节点"}
                  <span className="ml-2 text-xs font-normal text-gray-500">{item?.scheduleHint ?? ""}</span>
                </p>
                <p className="mt-0.5 text-sm text-gray-600">建议时间：{item?.suggestedAtLabel ?? "待定"}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item?.dueInDaysLabel ?? ""}</p>
              </div>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                item?.status === "completed"
                  ? "bg-emerald-50 text-emerald-800"
                  : item?.status === "due"
                    ? "bg-amber-50 text-amber-900"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {item?.statusLabel ?? ""}
            </span>
          </li>
        ))}
      </ol>

      {plan.nextSuggestion ? (
        <p
          className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"
          data-testid="retest-plan-next-suggestion"
        >
          下次复测建议：{plan.nextSuggestion.title}，建议时间 {plan.nextSuggestion.suggestedAtLabel}。
        </p>
      ) : showAllComplete ? (
        <p className="mt-4 text-sm text-emerald-700" data-testid="retest-plan-all-complete">
          三轮复测计划均已完成，可继续在交付报告中查看对比结果。
        </p>
      ) : !plan.publishAt ? (
        <p className="mt-4 text-sm text-gray-600" data-testid="retest-plan-awaiting-publish">
          完成首次发布并回填公开链接后，系统将自动计算发布后复测时间节点。
        </p>
      ) : null}
    </section>
  );
}

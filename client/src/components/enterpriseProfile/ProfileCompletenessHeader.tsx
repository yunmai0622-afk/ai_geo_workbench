import { cn } from "@/lib/utils";
import {
  PROFILE_COMPLETENESS_COMPLETE_BADGE,
  type EnterpriseProfileCompleteness,
} from "@shared/enterpriseProfileCompleteness";
import { BadgeCheck, CheckCircle2 } from "lucide-react";

type Props = {
  completeness: EnterpriseProfileCompleteness;
  className?: string;
};

export function ProfileCompletenessHeader({ completeness, className }: Props) {
  const { percent, missingLabels, isComplete, filledCount, totalCount } = completeness;

  return (
    <div className={cn("geo-card p-5", className)} data-testid="profile-completeness-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">企业资料完整度</p>
          <p className="text-[12px] text-gray-400">
            基于 {totalCount} 项核心建档字段 · 已填 {filledCount} 项
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isComplete ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
              data-testid="profile-completeness-complete-badge"
            >
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              {PROFILE_COMPLETENESS_COMPLETE_BADGE}
            </span>
          ) : null}
          <span className="text-lg font-bold tabular-nums text-gray-900" data-testid="profile-completeness-percent">
            {percent}%
          </span>
        </div>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isComplete ? "bg-emerald-500" : percent >= 60 ? "bg-blue-600" : "bg-amber-500",
          )}
          style={{ width: `${percent}%` }}
          data-testid="profile-completeness-progress"
        />
      </div>

      {isComplete ? (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span>核心信息已完整，可保存并开始 AI 实测诊断</span>
        </div>
      ) : missingLabels.length > 0 ? (
        <div className="mt-3 space-y-2" data-testid="profile-completeness-missing">
          <p className="text-[12px] font-medium text-amber-800">以下字段尚未填写，请补充：</p>
          <ul className="flex flex-wrap gap-1.5">
            {missingLabels.map(label => (
              <li
                key={label}
                className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-900"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

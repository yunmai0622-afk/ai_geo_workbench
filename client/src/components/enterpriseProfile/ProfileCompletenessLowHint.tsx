import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  PROFILE_COMPLETENESS_LOW_HINT,
  evaluateEnterpriseProfileCompletenessFromProfile,
  isEnterpriseProfileFeaturePath,
} from "@shared/enterpriseProfileCompleteness";
import { AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";

type Props = {
  projectId: number | null;
  className?: string;
};

/** 完整度低于 60% 时，在非企业资料页顶部展示引导文案 */
export function ProfileCompletenessLowHint({ projectId, className }: Props) {
  const [location] = useLocation();
  const pathname = location.split("?")[0] || location;

  const summaryQuery = trpc.geo.assetLibrary.summary.useQuery(
    { projectId: projectId ?? 0 },
    { enabled: Boolean(projectId) },
  );

  if (!projectId || !isEnterpriseProfileFeaturePath(pathname)) return null;

  const completeness = evaluateEnterpriseProfileCompletenessFromProfile(
    (summaryQuery.data?.profile ?? null) as Record<string, unknown> | null,
  );

  if (summaryQuery.isLoading || !completeness.showLowCompletenessHint) return null;

  const profileUrl = buildProjectUrl("/enterprise-profile", projectId);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950",
        className,
      )}
      data-testid="profile-completeness-low-hint"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p>{PROFILE_COMPLETENESS_LOW_HINT}</p>
      </div>
      <Link
        href={profileUrl}
        className="shrink-0 font-medium text-amber-900 underline-offset-2 hover:underline"
        data-testid="profile-completeness-low-hint-link"
      >
        去完善企业资料
      </Link>
    </div>
  );
}

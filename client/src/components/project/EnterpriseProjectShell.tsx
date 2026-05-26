import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { CUSTOMER_STAGE_LABELS } from "@/lib/projectWorkspaceDisplay";
import { trpc } from "@/lib/trpc";
import { resolveWorkspaceStage } from "@shared/workspaceStateMachine";
import { useEffect, useMemo, useState } from "react";
import { ProjectNextActionPanel } from "./ProjectNextActionPanel";
import { ProjectWorkspaceTopBar } from "./ProjectWorkspaceTopBar";

type Props = {
  children: React.ReactNode;
};

export function EnterpriseProjectShell({ children }: Props) {
  const { selectedProjectId, selectedProject } = useActiveProjectSelection();
  const [localAgentOnline, setLocalAgentOnline] = useState<boolean | null>(null);

  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const health = await checkLocalAgentHealth();
      if (!cancelled) setLocalAgentOnline(health?.ok ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const resolution = useMemo(() => {
    const m = summaryQuery.data;
    if (!m || !selectedProjectId) return null;
    return resolveWorkspaceStage({ ...m, localAgentOnline });
  }, [summaryQuery.data, selectedProjectId, localAgentOnline]);

  const recentItems = useMemo(() => {
    const m = summaryQuery.data;
    if (!m) return [];
    const items: { label: string; detail?: string }[] = [];
    if (m.articleCount > 0) {
      items.push({ label: "内容资产", detail: `${m.articleCount} 篇` });
    }
    if (m.publishRecordCount > 0) {
      items.push({ label: "发布记录", detail: `${m.publishRecordCount} 次` });
    }
    if (m.aiTestResultCount > 0) {
      const rate =
        m.brandMentionRate != null ? `提及率 ${Math.round(m.brandMentionRate * 100)}%` : `${m.aiTestResultCount} 条`;
      items.push({ label: "AI 实测", detail: rate });
    }
    if (m.geoScore != null) {
      items.push({ label: "GEO 评分", detail: `${m.geoScore} 分` });
    }
    return items.slice(0, 4);
  }, [summaryQuery.data]);

  const stageLabel = resolution ? CUSTOMER_STAGE_LABELS[resolution.currentStageId] : null;

  return (
    <div className="space-y-0" data-testid="enterprise-project-shell">
      <ProjectWorkspaceTopBar
        enterpriseName={selectedProject?.enterpriseName}
        stageLabel={stageLabel}
        geoScore={summaryQuery.data?.geoScore ?? null}
        ctaStage={resolution?.currentStage ?? null}
        projectId={selectedProjectId}
        loading={summaryQuery.isLoading && Boolean(selectedProjectId)}
      />
      {/* 三栏：左导航(DashboardLayout) + 中间主内容 + 右侧面板(300px固定) */}
      <div className="flex gap-6 pt-6">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="hidden shrink-0 lg:block" style={{ width: 300 }}>
          <div className="sticky top-6">
            <ProjectNextActionPanel
              projectId={selectedProjectId}
              stage={resolution?.currentStage ?? null}
              blockerReason={resolution?.blockerReasons[0] ?? null}
              riskHints={resolution?.riskHints ?? []}
              recentItems={recentItems}
              loading={summaryQuery.isLoading && Boolean(selectedProjectId)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

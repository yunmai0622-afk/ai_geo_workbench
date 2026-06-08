import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import { buildPublishingViewModel } from "@/lib/buildPublishingViewModel";
import { flattenPlatformAccountsForServerHeartbeat } from "@/lib/localAgentServerContext";
import { asArray } from "@/lib/contentPublishingSafeData";
import { resolvePublishStatusLocalAgentLabel } from "@/components/publishing/PublishStatusBar";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

export function PublishAssistantPanel({
  publishAccountBindCtaLabel: _publishAccountBindCtaLabel,
  onPublishAccountBindCta: _onPublishAccountBindCta,
  publishAccountBindChecking: _publishAccountBindChecking,
}: {
  publishAccountBindCtaLabel?: string;
  onPublishAccountBindCta?: () => void;
  publishAccountBindChecking?: boolean;
} = {}) {
  const { selectedProjectId, enabled } = useActiveProjectSelection();

  const tasksQuery = trpc.publishTasks.listRecentByProject.useQuery(
    { projectId: selectedProjectId!, limit: 30 },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const publishRecordsQuery = trpc.geo.publishRecords.listWithStatus.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const accountGroups = useMemo(() => {
    const accounts = accountsQuery.data?.accounts;
    if (!Array.isArray(accounts)) return [];
    return accounts.map(group => ({
      ...group,
      accounts: Array.isArray(group.accounts) ? group.accounts : [],
    }));
  }, [accountsQuery.data?.accounts]);

  const boundPublishAccountCount = useMemo(() => {
    let count = 0;
    for (const group of accountGroups) {
      for (const account of group.accounts ?? []) {
        if (account.isEnabled) count += 1;
      }
    }
    return count;
  }, [accountGroups]);

  const viewModel = useMemo(() => {
    if (!selectedProjectId) return null;
    return buildPublishingViewModel({
      projectId: selectedProjectId,
      articles: [],
      scores: [],
      publishRecords: asArray(publishRecordsQuery.data),
      agentTasks: asArray(tasksQuery.data?.tasks),
      accountGroups,
      articleById: new Map(),
      autoInclusionByArticleAndUrl: new Set(),
    });
  }, [selectedProjectId, tasksQuery.data?.tasks, publishRecordsQuery.data, accountGroups]);

  const flattenedPlatformAccounts = useMemo(
    () => flattenPlatformAccountsForServerHeartbeat(accountGroups),
    [accountGroups],
  );

  const {
    status: localAgentConnectionStatus,
    resolvedState: localAgentResolvedState,
    localAgentConnectedOnline,
  } = useLocalAgentConnection({
    boundPublishAccountCount,
    boundPlatformCount: accountsQuery.isLoading ? null : accountGroups.filter(g => (g.accounts ?? []).some(a => a.isEnabled)).length,
    pendingTaskCount: tasksQuery.isLoading ? null : viewModel?.agentTaskDerivedState.pendingCount ?? null,
    platformAccounts: flattenedPlatformAccounts,
  });

  const localAgentLabel = resolvePublishStatusLocalAgentLabel(
    localAgentConnectionStatus,
    localAgentConnectedOnline,
    localAgentResolvedState,
  );

  const pendingCount = viewModel?.agentTaskDerivedState.pendingCount ?? 0;
  const failedCount = viewModel?.agentTaskDerivedState.failedCount ?? 0;
  const waitingLinkCount = viewModel?.agentTaskDerivedState.waitingLinkCount ?? 0;

  return (
    <aside className="w-full space-y-4" data-testid="publish-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">发布执行摘要</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div data-testid="publish-sidebar-pending-count">
            <dt className="text-xs font-semibold text-gray-500">待发布任务数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{pendingCount}</dd>
          </div>
          <div data-testid="publish-sidebar-failed-count">
            <dt className="text-xs font-semibold text-gray-500">发布失败数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{failedCount}</dd>
          </div>
          <div data-testid="publish-sidebar-client-status">
            <dt className="text-xs font-semibold text-gray-500">客户端连接状态</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{localAgentLabel}</dd>
          </div>
          <div data-testid="publish-sidebar-waiting-links">
            <dt className="text-xs font-semibold text-gray-500">待回填链接数</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{waitingLinkCount}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

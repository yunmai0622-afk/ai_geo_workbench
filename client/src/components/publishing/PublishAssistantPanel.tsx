import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useLocalAgentConnection } from "@/hooks/useLocalAgentConnection";
import { usePublishAccountHealthCheck } from "@/hooks/usePublishAccountHealthCheck";
import { buildPublishingViewModel } from "@/lib/buildPublishingViewModel";
import { asArray } from "@/lib/contentPublishingSafeData";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { collectExpiredPublishAccounts } from "@shared/publishAccountHealthCheck";
import type { LocalAgentConnectionStatus } from "@shared/localAgentConnectionStatus";
import { resolvePublishStatusLocalAgentLabel } from "@/components/publishing/PublishStatusBar";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

function buildBlockers(input: {
  localAgentStatus: LocalAgentConnectionStatus;
  connectedOnline: boolean;
  expiredAccountCount: number;
  unsyncedAccounts: boolean;
}): string[] {
  const blockers: string[] = [];
  if (!input.connectedOnline) {
    const label = resolvePublishStatusLocalAgentLabel(input.localAgentStatus, false);
    if (label === "未检测") blockers.push("本地客户端未检测");
    else blockers.push("本地客户端未连接");
  }
  if (input.unsyncedAccounts) {
    blockers.push("发布账号待同步");
  }
  if (input.expiredAccountCount > 0) {
    blockers.push(`${input.expiredAccountCount} 个账号登录态待更新`);
  }
  return blockers;
}

function buildNextSteps(input: {
  localAgentStatus: LocalAgentConnectionStatus;
  connectedOnline: boolean;
  unsyncedAccounts: boolean;
}): string[] {
  const steps: string[] = [];
  if (!input.connectedOnline) {
    steps.push("检测客户端连接");
  }
  if (
    input.connectedOnline &&
    (input.unsyncedAccounts || input.localAgentStatus === "CONNECTED_ACCOUNT_NOT_SYNCED")
  ) {
    steps.push("刷新账号状态");
  } else if (input.connectedOnline) {
    steps.push("刷新账号状态");
  }
  if (steps.length === 0) {
    steps.push("处理待发布任务队列");
  }
  return steps;
}

export function PublishAssistantPanel({
  publishAccountBindCtaLabel,
  onPublishAccountBindCta,
  publishAccountBindChecking,
}: {
  publishAccountBindCtaLabel?: string;
  onPublishAccountBindCta?: () => void;
  publishAccountBindChecking?: boolean;
} = {}) {
  const { selectedProjectId, projectInput, enabled } = useActiveProjectSelection();

  const summaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const tasksQuery = trpc.publishTasks.listRecentByProject.useQuery(
    { projectId: selectedProjectId!, limit: 30 },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const accountsQuery = trpc.geo.platformAccounts.list.useQuery(
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
      publishRecords: [],
      agentTasks: asArray(tasksQuery.data?.tasks),
      accountGroups,
      articleById: new Map(),
      autoInclusionByArticleAndUrl: new Set(),
    });
  }, [selectedProjectId, tasksQuery.data?.tasks, accountGroups]);

  const { checking: accountHealthChecking, runCheck: runAccountHealthCheck } =
    usePublishAccountHealthCheck(selectedProjectId ?? null, enabled);

  const {
    status: localAgentConnectionStatus,
    checkConnection,
    localAgentConnectedOnline,
  } = useLocalAgentConnection({
    boundPublishAccountCount,
    boundPlatformCount: accountsQuery.isLoading ? null : accountGroups.filter(g => (g.accounts ?? []).some(a => a.isEnabled)).length,
    pendingTaskCount: tasksQuery.isLoading ? null : viewModel?.agentTaskDerivedState.pendingCount ?? null,
  });

  const expiredAccounts = useMemo(
    () => collectExpiredPublishAccounts(accountGroups),
    [accountGroups],
  );

  const blockers = buildBlockers({
    localAgentStatus: localAgentConnectionStatus,
    connectedOnline: localAgentConnectedOnline,
    expiredAccountCount: expiredAccounts.length,
    unsyncedAccounts: localAgentConnectionStatus === "CONNECTED_ACCOUNT_NOT_SYNCED",
  });

  const nextSteps = buildNextSteps({
    localAgentStatus: localAgentConnectionStatus,
    connectedOnline: localAgentConnectedOnline,
    unsyncedAccounts: localAgentConnectionStatus === "CONNECTED_ACCOUNT_NOT_SYNCED",
  });

  const recentStatus = useMemo(() => {
    const items: string[] = [];
    const articleCount = summaryQuery.data?.articleCount ?? 0;
    if (articleCount > 0) {
      items.push(`内容资产：${articleCount} 篇`);
    }
    const pending = viewModel?.agentTaskDerivedState.pendingCount ?? 0;
    items.push(`待发布：${pending} 条`);
    return items;
  }, [summaryQuery.data?.articleCount, viewModel?.agentTaskDerivedState.pendingCount]);

  const checking = localAgentConnectionStatus === "CHECKING" || accountHealthChecking;

  async function handleCheckConnection() {
    await checkConnection();
  }

  async function handleRefreshAccounts() {
    const result = await checkConnection();
    if (result.online) {
      await runAccountHealthCheck({ detectSessions: true });
    }
  }

  return (
    <aside className="w-full space-y-4" data-testid="publish-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">发布助手</h3>

        <div className="mt-4 space-y-4">
          <div data-testid="publish-assistant-blockers">
            <p className="text-xs font-semibold text-gray-500">当前阻断</p>
            {blockers.length === 0 ? (
              <p className="mt-1 text-sm text-gray-600">暂无阻断项，可处理发布任务。</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-gray-800">
                {blockers.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="text-gray-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div data-testid="publish-assistant-next-steps">
            <p className="text-xs font-semibold text-gray-500">下一步</p>
            <ul className="mt-1 space-y-1 text-sm text-gray-800">
              {nextSteps.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="text-gray-400">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-2">
              {onPublishAccountBindCta && publishAccountBindCtaLabel ? (
                <Button
                  type="button"
                  size="sm"
                  className={`w-full ${geoP0Brand.primary}`}
                  disabled={checking || publishAccountBindChecking}
                  data-testid="publish-assistant-bind-cta"
                  onClick={() => onPublishAccountBindCta()}
                >
                  {publishAccountBindChecking ? "处理中…" : publishAccountBindCtaLabel}
                </Button>
              ) : null}
              {!localAgentConnectedOnline && !onPublishAccountBindCta ? (
                <Button
                  type="button"
                  size="sm"
                  className={`w-full ${geoP0Brand.primary}`}
                  disabled={checking}
                  data-testid="publish-ready-refresh"
                  onClick={() => void handleCheckConnection()}
                >
                  检测客户端连接
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`w-full ${geoP0Brand.primaryOutline}`}
                disabled={checking || publishAccountBindChecking}
                data-testid="publish-assistant-refresh-accounts"
                onClick={() => void handleRefreshAccounts()}
              >
                刷新账号状态
              </Button>
            </div>
          </div>

          <div data-testid="publish-assistant-recent-status">
            <p className="text-xs font-semibold text-gray-500">最近状态</p>
            <ul className="mt-1 space-y-1 text-sm text-gray-800">
              {recentStatus.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="text-gray-400">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}

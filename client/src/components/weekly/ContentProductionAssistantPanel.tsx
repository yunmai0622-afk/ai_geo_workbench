import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { trpc } from "@/lib/trpc";
import { getArticlePublishPlatform } from "@shared/articlePublishPlatform";
import {
  buildWeeklyContentTaskNextStep,
  type WeeklyContentAssistantStats,
} from "@shared/weeklyContentTaskStatus";
import { resolveWeeklyCoverDisplayStatus } from "@shared/weeklyPublishableDisplay";
import { isContentReviewPending } from "@shared/contentReviewStatus";
import { evaluatePublishPreflight } from "@shared/publishPreflight";
import { WEEKLY_PLATFORM_DEFS } from "@/lib/weeklyPlatformBoard";
import { useMemo } from "react";

export function ContentProductionAssistantPanel() {
  const { selectedProjectId, enabled } = useActiveProjectSelection();

  const articlesQuery = trpc.geo.articles.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const platformAccountsQuery = trpc.geo.platformAccounts.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const publishTasksQuery = trpc.publishTasks.listRecentByProject.useQuery(
    { projectId: selectedProjectId!, limit: 50 },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const view = useMemo(() => {
    const articles = articlesQuery.data ?? [];
    const publishTasks = publishTasksQuery.data?.tasks ?? [];
    const latestTaskByArticle = new Map<number, (typeof publishTasks)[number]>();
    for (const task of publishTasks) {
      const articleId = typeof task.articleId === "number" ? task.articleId : null;
      if (!articleId) continue;
      const prev = latestTaskByArticle.get(articleId);
      const taskTime = new Date(task.createdAt ?? 0).getTime();
      const prevTime = prev ? new Date(prev.createdAt ?? 0).getTime() : -1;
      if (!prev || taskTime >= prevTime) latestTaskByArticle.set(articleId, task);
    }

    let pendingReviewCount = 0;
    let pendingEnqueueCount = 0;
    let missingCoverCount = 0;
    const platformWithReadyAccount = new Set<string>();

    for (const group of platformAccountsQuery.data?.accounts ?? []) {
      const ready = (group.accounts ?? []).some(
        a => a.isEnabled && a.sessionStatus === "active" && a.localProfileId && a.localAgentId,
      );
      if (ready) platformWithReadyAccount.add(group.platform);
    }

    for (const article of articles) {
      if (article.status === "已发布") continue;
      const platformResolved = getArticlePublishPlatform({
        generationBasis: article.generationBasis ?? null,
        targetPlatform: article.targetPlatform,
        publishPlatform: article.publishPlatform,
      });
      const preflight =
        selectedProjectId != null
          ? evaluatePublishPreflight({
              projectId: selectedProjectId,
              article,
              platformAccounts: (platformAccountsQuery.data?.accounts ?? []).flatMap(g =>
                (g.accounts ?? []).map(a => ({ ...a, platform: g.platform })),
              ),
            })
          : null;
      const ready = preflight?.ready ?? false;
      const latestTask = latestTaskByArticle.get(article.id);
      const queued = Boolean(
        latestTask && latestTask.status !== "failed" && latestTask.status !== "session_expired",
      );

      if (isContentReviewPending(article.contentReviewStatus) && ready) pendingReviewCount += 1;
      if (ready && !isContentReviewPending(article.contentReviewStatus) && !queued) {
        pendingEnqueueCount += 1;
      }
      const coverStatus = resolveWeeklyCoverDisplayStatus(article, platformResolved.publishQueueSlug);
      if (coverStatus === "未配置") missingCoverCount += 1;
    }

    const unboundAccountPlatformCount = WEEKLY_PLATFORM_DEFS.filter(def => {
      const slug = def.publishPlatformId;
      return slug ? !platformWithReadyAccount.has(slug) : false;
    }).length;

    const stats: WeeklyContentAssistantStats = {
      pendingReviewCount,
      pendingEnqueueCount,
      missingCoverCount,
      unboundAccountPlatformCount,
    };

    const nextStep = buildWeeklyContentTaskNextStep({
      pendingReviewCount,
      publishReadyCount: pendingEnqueueCount + pendingReviewCount,
      generatedCount: articles.filter(a => a.status !== "已发布").length,
    });

    return { stats, nextStep, unboundAccountPlatformCount };
  }, [articlesQuery.data, platformAccountsQuery.data, publishTasksQuery.data, selectedProjectId]);

  if (!enabled || !selectedProjectId) return null;

  return (
    <aside className="w-full space-y-4" data-testid="content-production-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">内容生产助手</h3>

        <dl className="mt-4 space-y-3 text-sm text-gray-800">
          <div data-testid="content-assistant-pending-review">
            <dt className="text-xs font-semibold text-gray-500">待审核内容</dt>
            <dd className="mt-0.5 font-medium">{view.stats.pendingReviewCount} 篇</dd>
          </div>
          <div data-testid="content-assistant-pending-enqueue">
            <dt className="text-xs font-semibold text-gray-500">可入队内容</dt>
            <dd className="mt-0.5 font-medium">{view.stats.pendingEnqueueCount} 篇</dd>
          </div>
          <div data-testid="content-assistant-missing-cover">
            <dt className="text-xs font-semibold text-gray-500">缺封面内容</dt>
            <dd className="mt-0.5 font-medium">{view.stats.missingCoverCount} 篇</dd>
          </div>
          {view.unboundAccountPlatformCount > 0 ? (
            <div data-testid="content-assistant-account-warning">
              <dt className="text-xs font-semibold text-gray-500">账号异常提醒</dt>
              <dd className="mt-0.5 text-amber-900">
                {view.unboundAccountPlatformCount} 个平台未绑定有效发布账号
              </dd>
            </div>
          ) : null}
          <div data-testid="content-assistant-next-step">
            <dt className="text-xs font-semibold text-gray-500">下一步动作</dt>
            <dd className="mt-0.5 text-gray-700">{view.nextStep}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

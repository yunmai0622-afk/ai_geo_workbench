import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { getArticlePublishPlatform } from "@shared/articlePublishPlatform";
import {
  buildWeeklyContentAssistantNextSteps,
  buildWeeklyContentAssistantRiskReminders,
  buildWeeklyContentTaskNextStep,
  type WeeklyContentAssistantStats,
} from "@shared/weeklyContentTaskStatus";
import { resolveWeeklyCoverDisplayStatus } from "@shared/weeklyPublishableDisplay";
import { isContentReviewPending } from "@shared/contentReviewStatus";
import { evaluatePublishPreflight } from "@shared/publishPreflight";
import { WEEKLY_PLATFORM_DEFS } from "@/lib/weeklyPlatformBoard";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

export function ContentProductionAssistantPanel() {
  const { selectedProjectId, enabled } = useActiveProjectSelection();
  const [, setLocation] = useLocation();

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

    const hasData =
      pendingReviewCount > 0 ||
      pendingEnqueueCount > 0 ||
      missingCoverCount > 0 ||
      unboundAccountPlatformCount > 0;

    return {
      hasData,
      stats,
      nextStep: buildWeeklyContentTaskNextStep({
        pendingReviewCount,
        publishReadyCount: pendingEnqueueCount + pendingReviewCount,
        generatedCount: articles.filter(a => a.status !== "已发布").length,
      }),
      riskReminders: buildWeeklyContentAssistantRiskReminders(stats),
      nextSteps: buildWeeklyContentAssistantNextSteps({
        qualityPendingCount: 0,
        publishReadyCount: pendingEnqueueCount + pendingReviewCount,
      }),
    };
  }, [articlesQuery.data, platformAccountsQuery.data, publishTasksQuery.data, selectedProjectId]);

  if (!view.hasData) return null;

  return (
    <aside className="w-full space-y-4" data-testid="content-production-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">内容审核助手</h3>

        <div className="mt-4 space-y-4">
          <div data-testid="content-assistant-next-step">
            <p className="text-xs font-semibold text-gray-500">下一步建议</p>
            <p className="mt-1 text-sm text-gray-800">{view.nextStep}</p>
          </div>

          {view.riskReminders.length > 0 ? (
            <div data-testid="content-assistant-risks">
              <p className="text-xs font-semibold text-gray-500">风险提醒</p>
              <ul className="mt-1 space-y-1 text-sm text-amber-900">
                {view.riskReminders.map(item => (
                  <li key={item} className="flex gap-2">
                    <span>-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div data-testid="content-assistant-recent-stats">
            <p className="text-xs font-semibold text-gray-500">最近数据</p>
            <ul className="mt-1 space-y-1 text-sm text-gray-800">
              {view.stats.pendingReviewCount > 0 ? (
                <li>待审核内容 {view.stats.pendingReviewCount} 篇</li>
              ) : null}
              {view.stats.pendingEnqueueCount > 0 ? (
                <li>待入队内容 {view.stats.pendingEnqueueCount} 篇</li>
              ) : null}
              {view.stats.missingCoverCount > 0 ? (
                <li>未配置封面 {view.stats.missingCoverCount} 篇</li>
              ) : null}
              {view.stats.unboundAccountPlatformCount > 0 ? (
                <li>未绑定账号 {view.stats.unboundAccountPlatformCount} 个平台</li>
              ) : null}
            </ul>
          </div>

          {selectedProjectId ? (
            <Button
              type="button"
              size="sm"
              className={`w-full ${geoP0Brand.primary}`}
              data-testid="content-assistant-go-publishing-queue"
              onClick={() => setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}
            >
              去发布队列
              <ArrowRight className="ml-1.5 size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

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
import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { useMemo } from "react";
function resolveAssistantGuidance(i:{pendingReviewCount:number;pendingEnqueueCount:number;generatedCount:number}){if(i.pendingReviewCount>0)return{what:"先完成待审核内容的人工确认",why:"审核通过后才能进入发布队列。",after:"审核完成后进入平台适配发布。",label:"去审核内容"};if(i.pendingEnqueueCount>0)return{what:"将已通过审核的内容加入发布队列",why:"入队后发布中心会执行发布。",after:"入队后进入发布中心。",label:"加入发布队列"};if(i.generatedCount===0)return{what:"按推荐平台生成首批平台稿",why:"先有平台稿才能推进质检与审核。",after:"生成后回到本页预览与审核。",label:"生成平台稿"};const n=buildWeeklyContentTaskNextStep({pendingReviewCount:i.pendingReviewCount,publishReadyCount:i.pendingEnqueueCount,generatedCount:i.generatedCount});return{what:n,why:"按顺序推进减少返工。",after:"完成后继续推进或进入发布中心。",label:"生成平台稿"};}

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

    const generatedCount = articles.filter(a => a.status !== "已发布").length;
    const guidance = resolveAssistantGuidance({ pendingReviewCount, pendingEnqueueCount, generatedCount });
    return { stats, guidance, unboundAccountPlatformCount };
  }, [articlesQuery.data, platformAccountsQuery.data, publishTasksQuery.data, selectedProjectId]);

  if (!enabled || !selectedProjectId) return null;

  return (
    <aside className="w-full space-y-4" data-testid="content-production-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">下一步</h3>
        <dl className="mt-4 space-y-3 text-sm"><div data-testid="content-assistant-what"><dt className="text-xs font-semibold text-gray-500">当前应该做什么</dt><dd>{view.guidance.what}</dd></div><div data-testid="content-assistant-why"><dt className="text-xs font-semibold text-gray-500">为什么这一步重要</dt><dd>{view.guidance.why}</dd></div><div data-testid="content-assistant-after"><dt className="text-xs font-semibold text-gray-500">完成后进入</dt><dd>{view.guidance.after}</dd></div></dl>
        <div className="mt-4"><Button size="sm" className={geoP0Brand.primary} data-testid="content-assistant-primary">{view.guidance.label}</Button></div>
      </div>
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
        </dl>
      </div>
    </aside>
  );
}

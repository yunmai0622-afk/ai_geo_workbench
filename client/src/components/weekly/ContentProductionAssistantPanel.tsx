import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { getArticlePublishPlatform } from "@shared/articlePublishPlatform";
import {
  buildWeeklyContentAssistantBlockers,
  buildWeeklyContentAssistantNextSteps,
} from "@shared/weeklyContentTaskStatus";
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

  const tasksQuery = trpc.geo.tasks.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const view = useMemo(() => {
    const articles = articlesQuery.data ?? [];
    const platformWithArticle = new Set<string>();
    let publishReadyCount = 0;
    let qualityPendingCount = 0;
    let currentTaskLabel: string | null = null;

    for (const article of articles) {
      const platformKey = getArticlePublishPlatform({
        generationBasis: article.generationBasis ?? null,
        targetPlatform: article.targetPlatform,
        publishPlatform: article.publishPlatform,
      }).weeklyPlatformKey;
      if (platformKey) platformWithArticle.add(platformKey);
      if (article.status === "已发布") continue;
      const hasQuality = article.geoQualityScore != null;
      if (hasQuality) publishReadyCount += 1;
      else qualityPendingCount += 1;
    }

    const ungeneratedPlatformCount = WEEKLY_PLATFORM_DEFS.filter(
      def => !platformWithArticle.has(def.key),
    ).length;

    const nextUngenerated = WEEKLY_PLATFORM_DEFS.find(def => !platformWithArticle.has(def.key));

    const tasks = tasksQuery.data ?? [];
    const firstTask = tasks[0];
    if (firstTask?.taskName) {
      currentTaskLabel = firstTask.taskName;
    }

    return {
      currentTaskLabel,
      publishReadyCount,
      blockers: buildWeeklyContentAssistantBlockers({
        ungeneratedPlatformCount,
        qualityPendingCount,
        publishReadyCount,
      }),
      nextSteps: buildWeeklyContentAssistantNextSteps({
        nextUngeneratedPlatformLabel: nextUngenerated?.label ?? null,
        qualityPendingCount,
        publishReadyCount,
      }),
    };
  }, [articlesQuery.data, tasksQuery.data]);

  return (
    <aside className="w-full space-y-4" data-testid="content-production-assistant-panel">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">内容生产助手</h3>

        <div className="mt-4 space-y-4">
          <div data-testid="content-assistant-current-task">
            <p className="text-xs font-semibold text-gray-500">当前任务</p>
            <p className="mt-1 text-sm text-gray-800">
              {view.currentTaskLabel ?? "围绕 AI 诊断缺口按平台生成内容"}
            </p>
          </div>

          <div data-testid="content-assistant-blockers">
            <p className="text-xs font-semibold text-gray-500">当前阻断</p>
            {view.blockers.length === 0 ? (
              <p className="mt-1 text-sm text-gray-600">暂无阻断，可继续生成或发布。</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-gray-800">
                {view.blockers.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="text-gray-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div data-testid="content-assistant-next-steps">
            <p className="text-xs font-semibold text-gray-500">下一步</p>
            <ul className="mt-1 space-y-1 text-sm text-gray-800">
              {view.nextSteps.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="text-gray-400">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div data-testid="content-assistant-publishable-count">
            <p className="text-xs font-semibold text-gray-500">可发布内容</p>
            <p className="mt-1 text-sm font-medium text-emerald-800">
              {view.publishReadyCount} 篇可加入发布队列
            </p>
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

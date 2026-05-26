import {
  AiFunnelRail,
  AiGlassPanel,
  AiMetricCard,
  AiPageHero,
  AiPageShell,
  AiSection,
} from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import {
  buildProgressNextActions,
  computeAssetFunnel,
  computePlatformDistribution,
  computePublishOverview,
  countAfterPublishTests,
  countAiTestedMonitoring,
  monitoringEvidenceRows,
  recordPublicLink,
  type PublishRecordForDisplay,
} from "@/lib/assetProgressDisplay";
import { BusinessPageProjectHeader } from "@/components/BusinessPageProjectHeader";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import { useMemo } from "react";
import { useLocation } from "wouter";

type ProjectOption = { id: number; enterpriseName: string };
type ScoreRow = { id: number; totalScore: number; createdAt?: Date | string | null };
type ArticleRow = { id: number; title?: string | null; createdAt?: Date | string | null };
type PublishRecordRow = PublishRecordForDisplay & { id: number; publishTitle?: string | null };
type TaskRow = { id: number; taskName?: string | null };
type MonitoringRow = { lastAiTestedAt?: Date | string | null; [key: string]: unknown };

function parseTime(value: Date | string | null | undefined): number {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

function getThisWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isInThisWeek(createdAt: Date | string | null | undefined): boolean {
  const t = parseTime(createdAt ?? null);
  if (Number.isNaN(t)) return false;
  const { start, end } = getThisWeekRange();
  return t >= start.getTime() && t <= end.getTime();
}

function useProjectSelection() {
  return useActiveProjectSelection();
}

export default function ProgressPage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, projectInput, enabled, projectsLoading } = useProjectSelection();

  const scoresQuery = trpc.geo.scores.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });

  const scores = (scoresQuery.data ?? []) as ScoreRow[];
  const articles = (articlesQuery.data ?? []) as ArticleRow[];
  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordRow[];
  const tasks = (tasksQuery.data ?? []) as TaskRow[];
  const monitoring = (monitoringQuery.data ?? []) as MonitoringRow[];

  const publishOverview = useMemo(() => computePublishOverview(publishRecords), [publishRecords]);
  const platformRows = useMemo(() => computePlatformDistribution(publishRecords), [publishRecords]);
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const weeklyNewCount = useMemo(() => articles.filter(a => isInThisWeek(a.createdAt)).length, [articles]);
  const sceneCount = tasks.length > 0 ? tasks.length : articles.length > 0 ? articles.length : null;
  const withLinkCount = useMemo(() => publishRecords.filter(r => recordPublicLink(r)).length, [publishRecords]);

  const funnelStages = useMemo(
    () =>
      computeAssetFunnel({
        articleCount: articles.length,
        publishRecordCount: publishRecords.length,
        withLinkCount,
        aiTestedCount: countAiTestedMonitoring(monitoring),
        afterPublishTestCount: countAfterPublishTests(monitoring),
      }),
    [articles.length, publishRecords.length, withLinkCount, monitoring],
  );

  const aiTestAggregate = useMemo(() => aggregateAiTestEvidence(monitoringEvidenceRows(monitoring)), [monitoring]);
  const hasAiTest = aiTestAggregate.questionCount > 0;

  const progressActions = useMemo(
    () =>
      buildProgressNextActions({
        publishCount: publishRecords.length,
        withoutLinkCount: publishRecords.filter(r => !recordPublicLink(r)).length,
        pendingRetestCount: publishOverview.pendingRetestCount ?? 0,
        hasAiTest,
        taskCount: tasks.length,
      }),
    [publishRecords, publishOverview.pendingRetestCount, hasAiTest, tasks.length],
  );

  const loading =
    enabled &&
    (scoresQuery.isLoading ||
      articlesQuery.isLoading ||
      publishRecordsQuery.isLoading ||
      tasksQuery.isLoading ||
      monitoringQuery.isLoading);
  const loadError =
    scoresQuery.isError ||
    articlesQuery.isError ||
    publishRecordsQuery.isError ||
    tasksQuery.isError ||
    monitoringQuery.isError;

  if (!enabled && !projectsLoading) {
    return (
      <AiPageShell>
        <ProjectContextEmptyState />
      </AiPageShell>
    );
  }

  return (
    <AiPageShell>
      <AiPageHero
        title="资产进展看板"
        description="查看当前企业的 GEO 增长进展。"
        badge="进展看板"
      >
        <BusinessPageProjectHeader projectName={selectedProject?.enterpriseName} testId="progress-project-header" />
      </AiPageHero>

      {loadError ? (
        <p className="text-sm text-amber-100">暂时无法加载，请刷新重试</p>
      ) : loading ? (
        <p className="text-sm text-slate-400">加载中...</p>
      ) : (
        <>
          <AiSection title="资产进展总览">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AiMetricCard
                label="累计发布内容"
                value={publishRecords.length > 0 ? String(publishRecords.length) : "暂无数据"}
                hint="已登记各平台发布记录"
              />
              <AiMetricCard
                label="覆盖问题场景"
                value={sceneCount != null ? String(sceneCount) : "暂无数据"}
                hint="来自诊断任务与内容方向"
                accent="violet"
              />
              <AiMetricCard
                label="AI 搜索可见度评分"
                value={latestScore ? `${latestScore.totalScore} 分` : "暂无数据"}
                hint="基于最近一次内容诊断"
                accent="cyan"
              />
              <AiMetricCard
                label="本周新增内容"
                value={weeklyNewCount > 0 ? String(weeklyNewCount) : "暂无数据"}
                hint="本周自然周内生成"
                accent="emerald"
              />
            </div>
          </AiSection>

          <AiSection title="内容资产漏斗" description="从生产到发布后复测的阶段进展。">
            <AiFunnelRail stages={funnelStages} />
          </AiSection>

          <AiSection title="平台覆盖">
            {platformRows.length === 0 ? (
              <p className="text-sm text-slate-500">暂无平台覆盖数据</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {platformRows.map(row => (
                  <span
                    key={row.platform}
                    className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-sm text-violet-100"
                  >
                    {row.platform}
                    <span className="ml-2 text-white">{row.count}</span>
                    <span className="text-violet-300/80"> 篇</span>
                  </span>
                ))}
              </div>
            )}
          </AiSection>

          <AiSection title="AI 实测进展">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AiMetricCard label="实测问题数" value={hasAiTest ? String(aiTestAggregate.questionCount) : "暂无数据"} />
              <AiMetricCard
                label="覆盖引擎数"
                value={hasAiTest ? String(aiTestAggregate.byEngine.filter(e => e.questionCount > 0).length) : "暂无数据"}
                accent="violet"
              />
              <AiMetricCard
                label="品牌提及率"
                value={hasAiTest ? `${Math.round(aiTestAggregate.mentionRate * 100)}%` : "暂无数据"}
                accent="cyan"
              />
              <AiMetricCard
                label="品牌推荐率"
                value={hasAiTest ? `${Math.round(aiTestAggregate.recommendRate * 100)}%` : "暂无数据"}
                accent="emerald"
              />
            </div>
          </AiSection>

          <AiSection title="下一轮资产建设重点">
            <ul className="grid gap-3 lg:grid-cols-3">
              {progressActions.map(line => (
                <li key={line} className="ai-action-card p-4 text-sm leading-relaxed text-gray-600">
                  {line}
                </li>
              ))}
            </ul>
            <AiGlassPanel className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-gray-200 text-blue-700" onClick={() => selectedProjectId && setLocation(buildProjectUrl("/weekly", selectedProjectId))}>
                去生成本周内容
              </Button>
              <Button type="button" variant="outline" className="border-gray-200 text-blue-700" onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}>
                查看发布记录
              </Button>
              <Button type="button" variant="outline" className="border-gray-200 text-blue-700" onClick={() => selectedProjectId && setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))}>
                去 AI 实测
              </Button>
            </AiGlassPanel>
          </AiSection>
        </>
      )}
    </AiPageShell>
  );
}

import React from "react";
import {
  AiActionCard,
  AiAssetCard,
  AiMetricCard,
  AiPageHero,
  AiPageShell,
  AiSection,
  AiStatusBadge,
} from "@/components/ai/ProductUi";
import { monitoringEvidenceRows } from "@/lib/assetProgressDisplay";
import { BusinessPageProjectHeader } from "@/components/BusinessPageProjectHeader";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { GeoScoreTrendChart } from "@/components/geo/GeoScoreTrendChart";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { aggregateAiTestEvidence } from "@shared/aiTestEvidence";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type ArticleRow = { id: number; status?: string | null; createdAt?: Date | string | null; title?: string | null };
type PublishRecordRow = { id: number; publishTitle?: string | null; publishChannel?: string | null; publishedAt?: Date | string | null };
type GeoScoreRow = {
  id: number;
  totalScore: number;
  createdAt?: Date | string | null;
  calculationDetail?: Record<string, unknown> | null;
};

function resolveIndustryAverageScore(detail: Record<string, unknown> | null | undefined): number | null {
  if (!detail || typeof detail !== "object") return null;
  const candidates = ["industryAverageScore", "industryAvgScore", "averageScore", "benchmarkScore"];
  for (const key of candidates) {
    const value = detail[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
  }
  return null;
}

function parseTime(value: Date | string | number | null | undefined): number {
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

function daysAgoLabel(publishedAt: Date | string | null | undefined): string {
  const t = parseTime(publishedAt ?? null);
  if (Number.isNaN(t)) return "—";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function SectionSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`} aria-hidden />;
}

export default function V1WorkbenchOverview() {
  const [, setLocation] = useLocation();
  const { projectsLoading, selectedProjectId, selectedProject, projectInput, enabled } = useActiveProjectSelection();

  useEffect(() => {
    document.title = "AI 搜索增长总览 - GEO 内容诊断与智能发布";
  }, []);

  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const scoreTrendQuery = trpc.geo.scores.recent.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });

  const tasks = (tasksQuery.data ?? []) as { id: number }[];
  const articles = (articlesQuery.data ?? []) as ArticleRow[];
  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordRow[];
  const latestScore = scoreQuery.data as GeoScoreRow | null | undefined;
  const industryAverageScore = resolveIndustryAverageScore(latestScore?.calculationDetail);
  const scoreTrendPoints = useMemo(
    () =>
      ((scoreTrendQuery.data ?? []) as GeoScoreRow[]).map(row => ({
        totalScore: row.totalScore,
        createdAt: row.createdAt ?? new Date(0),
      })),
    [scoreTrendQuery.data],
  );
  const monitoring = monitoringQuery.data ?? [];

  const aiTestAggregate = useMemo(
    () => aggregateAiTestEvidence(monitoringEvidenceRows(monitoring)),
    [monitoring],
  );

  const weeklyGenerated = useMemo(() => articles.filter(a => isInThisWeek(a.createdAt)).length, [articles]);
  const taskCount = tasks.length;
  const totalPublishCount = publishRecords.length;

  const recentPublish = useMemo(
    () => [...publishRecords].sort((a, b) => parseTime(b.publishedAt) - parseTime(a.publishedAt)).slice(0, 3),
    [publishRecords],
  );

  const scoreValueText =
    latestScore && typeof latestScore.totalScore === "number" ? `${latestScore.totalScore} 分` : "暂无数据";
  const mentionText = aiTestAggregate.questionCount > 0 ? `${Math.round(aiTestAggregate.mentionRate * 100)}%` : "暂无数据";
  const recommendText = aiTestAggregate.questionCount > 0 ? `${Math.round(aiTestAggregate.recommendRate * 100)}%` : "暂无数据";
  const weeklyAssetText = weeklyGenerated > 0 ? `${weeklyGenerated} 篇` : totalPublishCount > 0 ? `${totalPublishCount} 篇已发布` : "暂无数据";

  const updatedLabel = latestScore?.createdAt ? `评分更新：${daysAgoLabel(latestScore.createdAt)}` : "请先完成内容诊断";

  const loading =
    projectsLoading ||
    (enabled &&
      (scoreQuery.isLoading ||
        scoreTrendQuery.isLoading ||
        tasksQuery.isLoading ||
        articlesQuery.isLoading ||
        publishRecordsQuery.isLoading ||
        monitoringQuery.isLoading));

  if (!enabled) {
    return (
      <AiPageShell>
        <ProjectContextEmptyState />
      </AiPageShell>
    );
  }

  return (
    <AiPageShell>
      <AiPageHero
        title="AI 搜索增长总览"
        description="查看品牌在 AI 搜索中的可见度、内容资产进度和下一步增长动作。"
        badge="增长驾驶舱"
        meta={updatedLabel}
      >
        <BusinessPageProjectHeader projectName={selectedProject?.enterpriseName} testId="workbench-project-header" />
      </AiPageHero>

      <AiSection title="核心状态">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <SectionSkeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AiMetricCard label="AI 搜索可见度评分" value={scoreValueText} hint="基于最近一次内容诊断" accent="cyan" />
            <AiMetricCard label="品牌提及率" value={mentionText} hint="来自收录监测实测样本" accent="violet" />
            <AiMetricCard label="品牌推荐率" value={recommendText} hint="来自收录监测实测样本" accent="emerald" />
            <AiMetricCard label="本周新增资产" value={weeklyAssetText} hint="本周生成 + 已登记发布" accent="amber" />
          </div>
        )}
      </AiSection>

      <AiSection title="GEO 分数趋势" description="最近 5 次内容诊断评分变化（按记录时间从早到晚）。">
        <div className="ai-glass-panel p-4">
          <GeoScoreTrendChart
            points={scoreTrendPoints}
            industryAverageScore={industryAverageScore}
            loading={enabled && scoreTrendQuery.isLoading}
            variant="dark"
          />
        </div>
      </AiSection>

      <AiSection title="下一步动作" description="按优先级推进，把诊断结论转化为可发布资产。">
        <div className="grid gap-4 lg:grid-cols-3">
          <AiActionCard
            title="生成内容资产"
            description={taskCount > 0 ? `已有 ${taskCount} 条内容方向，进入生产台批量生成。` : "先完成 AI 内容诊断，系统将给出可生成的资产方向。"}
            actionLabel={taskCount > 0 ? "进入内容资产生产" : "去完成内容诊断"}
            onAction={() => setLocation(buildProjectUrl(taskCount > 0 ? "/weekly" : "/ai-diagnosis", selectedProjectId))}
          />
          <AiActionCard
            title="完成后发布后复测"
            description="对已发布 7–14 天的资产执行 AI 复测，验证可见度变化。"
            actionLabel="进入收录监测"
            variant="outline"
            onAction={() => setLocation(buildProjectUrl("/inclusion-monitoring", selectedProjectId))}
          />
          <AiActionCard
            title="查看客户交付报告"
            description="汇总经营结论、实测结果与下一轮优化动作，用于客户演示。"
            actionLabel="打开交付报告"
            variant="outline"
            onAction={() => setLocation(buildProjectUrl("/delivery-reports", selectedProjectId))}
          />
        </div>
      </AiSection>

      <AiSection
        title="最近进展"
        description="轻量查看最近发布与诊断状态。"
        className="pb-4"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ai-glass-panel space-y-3">
            <p className="text-sm font-medium text-white">最近发布</p>
            {recentPublish.length === 0 ? (
              <p className="text-sm text-gray-500">还没有发布记录，生成内容后登记平台链接。</p>
            ) : (
              <ul className="space-y-2">
                {recentPublish.map(r => (
                  <li key={r.id} className="text-sm text-gray-600">
                    <span className="text-gray-900">{truncate((r.publishTitle || "未命名").trim(), 28)}</span>
                    <span className="text-gray-600"> · </span>
                    {r.publishChannel ?? "—"}
                    <span className="text-gray-600"> · </span>
                    <span className="text-gray-500">{daysAgoLabel(r.publishedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="ai-glass-panel space-y-3">
            <p className="text-sm font-medium text-white">诊断与实测</p>
            <div className="flex flex-wrap gap-2">
              <AiStatusBadge tone={latestScore ? "success" : "neutral"}>
                {latestScore ? `内容评分 ${latestScore.totalScore} 分` : "待运行诊断"}
              </AiStatusBadge>
              <AiStatusBadge tone={aiTestAggregate.questionCount > 0 ? "info" : "neutral"}>
                {aiTestAggregate.questionCount > 0 ? `已实测 ${aiTestAggregate.questionCount} 题` : "待 AI 实测"}
              </AiStatusBadge>
            </div>
            {recentPublish.slice(0, 1).map(r => (
              <AiAssetCard
                key={r.id}
                title={truncate((r.publishTitle || "发布资产").trim(), 40)}
                subtitle={`${r.publishChannel ?? "平台待标注"} · ${daysAgoLabel(r.publishedAt)}`}
              />
            ))}
          </div>
        </div>
      </AiSection>
    </AiPageShell>
  );
}

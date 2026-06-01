import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { PublishRecordsListPanel } from "@/components/publishing/PublishRecordsListPanel";
import type { PublishRecordsListItem } from "@/components/publishing/PublishRecordsListPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import { filterPublishRecordsByDateRange } from "@shared/publishRecordArchive";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export function PublishRecordsHistoryPage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, enabled, projectsLoading } = useActiveProjectSelection();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const publishRecordsQuery = trpc.geo.publishRecords.listWithStatus.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const articlesQuery = trpc.geo.articles.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );

  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordsListItem[];
  const articles = articlesQuery.data ?? [];
  const articleById = useMemo(() => new Map(articles.map(a => [a.id, a])), [articles]);

  const filteredRecords = useMemo(
    () =>
      filterPublishRecordsByDateRange(publishRecords, {
        from: dateFrom || null,
        to: dateTo || null,
      }),
    [publishRecords, dateFrom, dateTo],
  );

  const loading = publishRecordsQuery.isLoading || articlesQuery.isLoading;

  if (!enabled && !projectsLoading) {
    return (
      <div className="pb-12" data-testid="publish-records-history-page">
        <ProjectContextEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" data-testid="publish-records-history-page">
      <header className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-900"
          data-testid="publish-records-history-back"
          onClick={() =>
            selectedProjectId &&
            setLocation(buildProjectUrl("/content-publishing", selectedProjectId))
          }
        >
          <ArrowLeft className="mr-1 size-4" />
          返回平台适配发布
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">发布记录历史</h1>
          <p className="mt-1 text-sm text-gray-500">
            {selectedProject?.enterpriseName
              ? `${selectedProject.enterpriseName} · 按发布时间筛选全部登记记录`
              : "按发布时间筛选全部登记记录"}
          </p>
        </div>
      </header>

      <section
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        data-testid="publish-records-history-filters"
      >
        <h2 className="text-sm font-medium text-gray-800">时间筛选</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="publish-history-from">开始日期</Label>
            <Input
              id="publish-history-from"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              data-testid="publish-records-history-date-from"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publish-history-to">结束日期</Label>
            <Input
              id="publish-history-to"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              data-testid="publish-records-history-date-to"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-2">
            <Button
              type="button"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              data-testid="publish-records-history-clear-filters"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              清除筛选
            </Button>
          </div>
        </div>
        {(dateFrom || dateTo) && !loading ? (
          <p className="mt-3 text-xs text-gray-500" data-testid="publish-records-history-filter-summary">
            筛选结果：{filteredRecords.length} 条
            {dateFrom ? ` · 自 ${dateFrom}` : ""}
            {dateTo ? ` · 至 ${dateTo}` : ""}
          </p>
        ) : null}
      </section>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-gray-500">
          <Spinner className="size-5 text-blue-600" />
          正在加载历史记录…
        </div>
      ) : filteredRecords.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="publish-records-history-empty">
          当前时间范围内暂无发布记录，请调整筛选或返回发布页登记。
        </p>
      ) : (
        <PublishRecordsListPanel
          variant="full"
          records={filteredRecords}
          resolveTitle={record => {
            const article = articleById.get(record.articleId ?? 0);
            return (
              article?.title?.trim() ||
              record.publishTitle?.trim() ||
              `文章 #${record.articleId ?? "—"}`
            );
          }}
        />
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  ARTICLE_LIFECYCLE_LABELS,
  type ArticleLifecycleEvent,
  type ArticleLifecycleStatus,
  resolveArticleLifecycleView,
} from "@shared/articleLifecycle";
import { useMemo, useState } from "react";

export type ArticleLifecycleFields = {
  lifecycleStatus?: string | null;
  lifecycleEvents?: unknown;
  status?: string | null;
  publicPath?: string | null;
};

type ArticleLifecyclePanelProps = {
  articleId: number;
  article: ArticleLifecycleFields;
  /** 列表接口已附带 lifecycle 时可传入，减少重复计算 */
  lifecycle?: ReturnType<typeof resolveArticleLifecycleView>;
  compact?: boolean;
};

function formatEventTime(at: string): string {
  try {
    return new Date(at).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return at;
  }
}

function LifecycleTimelineBody({
  events,
  fakePublished,
}: {
  events: ArticleLifecycleEvent[];
  fakePublished: boolean;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">暂无生命周期事件记录</p>;
  }
  return (
    <ol className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto pr-1">
      {fakePublished ? (
        <li className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          检测到「已发布」状态但缺少公开链接证据，请勿当作真实发布完成。
        </li>
      ) : null}
      {events.map((ev, i) => (
        <li
          key={`${ev.at}-${ev.status}-${i}`}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          data-lifecycle-status={ev.status}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900">
              {ARTICLE_LIFECYCLE_LABELS[ev.status as ArticleLifecycleStatus] ?? ev.status}
            </span>
            <span className="text-[10px] text-gray-400">{formatEventTime(ev.at)}</span>
          </div>
          {ev.message ? <p className="mt-1 text-xs text-gray-600">{ev.message}</p> : null}
          <p className="mt-1 text-[10px] text-gray-400">
            来源：{ev.source}
            {ev.platform ? ` · ${ev.platform}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ArticleLifecyclePanel({
  articleId,
  article,
  lifecycle: lifecycleProp,
  compact = false,
}: ArticleLifecyclePanelProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const lifecycle = useMemo(
    () => lifecycleProp ?? resolveArticleLifecycleView(article),
    [lifecycleProp, article],
  );

  const timelineQuery = trpc.geo.articles.lifecycleTimeline.useQuery(
    { articleId },
    { enabled: timelineOpen && articleId > 0 },
  );

  const timelineEvents = timelineQuery.data?.events ?? lifecycle.events;

  return (
    <div
      className={`rounded-lg border border-blue-200 bg-blue-50 ${compact ? "px-3 py-2" : "px-3 py-3"}`}
      data-testid="article-lifecycle-panel"
      data-lifecycle-status={lifecycle.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-blue-600">生命周期</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">{lifecycle.label}</p>
          {lifecycle.fakePublished ? (
            <p className="mt-1 text-xs text-amber-700">状态异常：缺少发布链接证据</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          data-testid="article-lifecycle-timeline-open"
          onClick={() => setTimelineOpen(true)}
        >
          状态时间线
        </Button>
      </div>
      {lifecycle.latestEvent ? (
        <p className="mt-2 text-xs text-gray-600">
          <span className="text-gray-400">最近事件 · </span>
          {lifecycle.latestEvent.message ?? ARTICLE_LIFECYCLE_LABELS[lifecycle.latestEvent.status]}
          <span className="text-gray-400"> · {formatEventTime(lifecycle.latestEvent.at)}</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-400">暂无事件记录</p>
      )}
      <p className="mt-1.5 text-xs text-blue-700">
        <span className="text-gray-400">下一步 · </span>
        {lifecycle.nextAction}
      </p>

      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>内容生命周期时间线</DialogTitle>
            <DialogDescription>
              从生成、质检、确认到本地 Agent 发布的完整状态记录（真实数据库事件）
            </DialogDescription>
          </DialogHeader>
          {timelineQuery.isLoading ? (
            <p className="text-sm text-gray-500">加载中…</p>
          ) : (
            <LifecycleTimelineBody
              events={timelineEvents}
              fakePublished={lifecycle.fakePublished}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  AUTO_INCLUSION_MONITORING_HINT,
  type PublishColumnId,
  type PublishTaskCardModel,
} from "@/lib/publishCenterDisplay";

const COLUMN_META: Record<
  PublishColumnId,
  { title: string; description: string; testId: string }
> = {
  pending: {
    title: "待处理",
    description: "已加入发布队列，等待本地客户端处理",
    testId: "publish-column-pending",
  },
  active: {
    title: "处理中 / 需确认",
    description: "客户端处理中，或需在平台人工确认发布",
    testId: "publish-column-active",
  },
  done: {
    title: "已完成",
    description: "发布完成、失败结束，或等待回填公开链接",
    testId: "publish-column-done",
  },
};

type Props = {
  columns: Record<PublishColumnId, PublishTaskCardModel[]>;
  linkDraftByRecordId: Record<number, string>;
  savingRecordId: number | null;
  onPreview: (card: PublishTaskCardModel) => void;
  onStartPublish: (card: PublishTaskCardModel) => void;
  onSaveLink: (recordId: number) => void;
  onMarkAbnormal: (card: PublishTaskCardModel) => void;
  onLinkDraftChange: (recordId: number, value: string) => void;
  retryingTaskId?: number | null;
  onRetryTask?: (card: PublishTaskCardModel) => void;
};

function TaskCard({
  card,
  col,
  linkDraftByRecordId,
  savingRecordId,
  onPreview,
  onStartPublish,
  onSaveLink,
  onMarkAbnormal,
  onLinkDraftChange,
  retryingTaskId,
  onRetryTask,
}: {
  card: PublishTaskCardModel;
  col: PublishColumnId;
} & Omit<Props, "columns">) {
  return (
    <P0Card key={card.key} testId={`publish-task-card-${card.key}`} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-medium text-gray-900 line-clamp-2">{card.title}</p>
        <Badge variant="outline" className={card.statusBadgeClass}>
          {card.statusLabel}
        </Badge>
      </div>

      <dl className="grid gap-1.5 text-xs text-gray-600">
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-500">目标平台</dt>
          <dd>{card.platformLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-500">发布账号</dt>
          <dd>{card.accountLabel}</dd>
        </div>
        {card.timeLabel ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-gray-500">最近更新</dt>
            <dd>{card.timeLabel}</dd>
          </div>
        ) : null}
      </dl>

      {card.contentGoal ? (
        <p className="text-xs text-gray-600">
          <span className="text-gray-500">内容目标：</span>
          {card.contentGoal}
        </p>
      ) : null}

      {(card.draftUrl || card.publishedUrl) && (
        <div className="flex flex-wrap gap-3 text-xs">
          {card.draftUrl ? (
            <a
              href={card.draftUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              查看草稿
            </a>
          ) : null}
          {card.publishedUrl ? (
            <a
              href={card.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              查看已发布文章
            </a>
          ) : null}
        </div>
      )}

      {card.autoInclusionMonitoring ? (
        <p
          className="rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800"
          data-testid="publish-auto-inclusion-hint"
        >
          {AUTO_INCLUSION_MONITORING_HINT}
        </p>
      ) : null}

      {card.errorMessage ? (
        <p className="rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-xs text-red-800">
          {card.errorMessage}
        </p>
      ) : null}

      {card.retryExhausted ? (
        <p
          className="rounded-md border border-amber-100 bg-amber-50 px-2.5 py-2 text-xs text-amber-900"
          data-testid="publish-retry-exhausted"
        >
          请人工处理（已重试 {card.retryCount ?? 0} 次，已达上限）
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={geoP0Brand.primaryOutline}
          onClick={() => onPreview(card)}
        >
          预览内容
        </Button>
        {col === "pending" ? (
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            onClick={() => onStartPublish(card)}
          >
            开始本地发布
          </Button>
        ) : null}
        {card.recordId ? (
          <>
            <Input
              className="h-8 min-w-[180px] flex-1 text-xs"
              placeholder="公开链接"
              value={linkDraftByRecordId[card.recordId] ?? ""}
              onChange={e => onLinkDraftChange(card.recordId!, e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={geoP0Brand.primaryOutline}
              disabled={savingRecordId === card.recordId}
              onClick={() => onSaveLink(card.recordId!)}
            >
              {savingRecordId === card.recordId ? "保存中…" : "填写公开链接"}
            </Button>
          </>
        ) : null}
        {card.canRetry && card.taskId && onRetryTask ? (
          <Button
            type="button"
            size="sm"
            className={geoP0Brand.primary}
            data-testid={`publish-retry-btn-${card.taskId}`}
            disabled={retryingTaskId === card.taskId}
            onClick={() => onRetryTask(card)}
          >
            {retryingTaskId === card.taskId ? "重试中…" : "重试"}
          </Button>
        ) : null}
        {card.isAbnormal && !card.canRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-amber-200 text-amber-800"
            onClick={() => onMarkAbnormal(card)}
          >
            查看说明
          </Button>
        ) : null}
      </div>
    </P0Card>
  );
}

export function PublishTaskColumnBoard({
  columns,
  linkDraftByRecordId,
  savingRecordId,
  onPreview,
  onStartPublish,
  onSaveLink,
  onMarkAbnormal,
  onLinkDraftChange,
  retryingTaskId,
  onRetryTask,
}: Props) {
  return (
    <div className="space-y-8" data-testid="publish-task-columns">
      {(["pending", "active", "done"] as const).map(col => (
        <section key={col} data-testid={COLUMN_META[col].testId} className="space-y-3">
          <div className="border-b border-gray-200 pb-2">
            <h2 className="text-base font-semibold text-gray-900">{COLUMN_META[col].title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{COLUMN_META[col].description}</p>
            <p className="mt-1 text-xs text-gray-400">共 {columns[col].length} 条</p>
          </div>
          {columns[col].length === 0 ? (
            <P0Card className="text-sm text-gray-500">暂无任务</P0Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {columns[col].map(card => (
                <TaskCard
                  key={card.key}
                  card={card}
                  col={col}
                  linkDraftByRecordId={linkDraftByRecordId}
                  savingRecordId={savingRecordId}
                  onPreview={onPreview}
                  onStartPublish={onStartPublish}
                  onSaveLink={onSaveLink}
                  onMarkAbnormal={onMarkAbnormal}
                  onLinkDraftChange={onLinkDraftChange}
                  retryingTaskId={retryingTaskId}
                  onRetryTask={onRetryTask}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { PublishPagePlatformCard } from "@shared/publishPageLayout";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: PublishPagePlatformCard["status"]): string {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "ready":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "publishing":
      return "bg-indigo-50 text-indigo-800 border-indigo-200";
    case "failed":
      return "bg-red-50 text-red-800 border-red-200";
    case "pending_confirm":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "not_bound":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "manual_only":
      return "bg-violet-50 text-violet-800 border-violet-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

type Props = {
  cards: PublishPagePlatformCard[];
  loading?: boolean;
  publishingCardKey?: string | null;
  retryingTaskId?: number | null;
  onPreview: (card: PublishPagePlatformCard) => void;
  onPublish: (card: PublishPagePlatformCard) => void;
  onRetry: (card: PublishPagePlatformCard) => void;
};

export function PublishPlatformCardGrid({
  cards = [],
  loading,
  publishingCardKey,
  retryingTaskId,
  onPreview,
  onPublish,
  onRetry,
}: Props) {
  return (
    <P0Card testId="publish-platform-card-grid">
      <div>
        <h2 className="text-base font-semibold text-gray-900">平台发布状态</h2>
        <p className="mt-1 text-sm text-gray-600">
          按平台查看本周内容标题、发布进度与失败原因；本地可发布平台需保持客户端运行。
        </p>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4 text-blue-600" />
          正在加载各平台状态…
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-2" data-testid="publish-platform-card-list">
          {cards.map(card => {
            const busy = publishingCardKey === card.key;
            const retrying = card.taskId != null && retryingTaskId === card.taskId;
            return (
              <li
                key={card.key}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                data-testid={`publish-platform-card-${card.key}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{card.label}</p>
                  <Badge variant="outline" className={cn("shrink-0", statusBadgeClass(card.status))}>
                    {card.statusLabel}
                  </Badge>
                </div>

                <p className="mt-3 text-xs font-medium text-gray-500">本周内容标题</p>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-gray-800">
                  {card.weeklyTitlePreview ?? "暂无，请先在「平台化内容生产」生成本周内容"}
                </p>

                {card.failureReason ? (
                  <p
                    className="mt-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-xs leading-relaxed text-red-800"
                    data-testid={`publish-platform-failure-${card.key}`}
                  >
                    失败原因：{card.failureReason}
                  </p>
                ) : null}
                <p
                  className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs leading-relaxed text-blue-900"
                  data-testid={`publish-platform-verification-${card.key}`}
                >
                  平台能力：{card.verification.label}。{card.verification.hint}
                </p>

                {card.manualOnly ? (
                  <p className="mt-2 text-xs text-gray-500">该平台需人工复制素材发布，并在发布记录中回填链接。</p>
                ) : !card.bound ? (
                  <p className="mt-2 text-xs text-gray-500">请先在本地客户端绑定该平台账号。</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={geoP0Brand.primaryOutline}
                    disabled={!card.canPreview}
                    data-testid={`publish-platform-preview-${card.key}`}
                    onClick={() => onPreview(card)}
                  >
                    预览
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className={geoP0Brand.primary}
                    disabled={!card.canPublish || busy}
                    data-testid={`publish-platform-publish-${card.key}`}
                    onClick={() => onPublish(card)}
                  >
                    {busy ? "提交中…" : "发布"}
                  </Button>
                  {card.canRetry ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-200 text-amber-900 hover:bg-amber-50"
                      disabled={retrying}
                      data-testid={`publish-platform-retry-${card.key}`}
                      onClick={() => onRetry(card)}
                    >
                      {retrying ? "重试中…" : "重试"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </P0Card>
  );
}

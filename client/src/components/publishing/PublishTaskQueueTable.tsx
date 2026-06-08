import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { PublishTaskCardModel } from "@/lib/publishCenterDisplay";

export type PublishExecutionTabKey =
  | "pending"
  | "active"
  | "failed"
  | "published"
  | "waiting_links";

type Props = {
  tab: PublishExecutionTabKey;
  cards: PublishTaskCardModel[];
  savingRowId: number | null;
  retryingTaskId: number | null;
  onSendToClient: (card: PublishTaskCardModel) => void;
  onViewTask: (card: PublishTaskCardModel) => void;
  onRetry: (card: PublishTaskCardModel) => void;
  onBackfillLink: (card: PublishTaskCardModel) => void;
  onMarkFailed: (card: PublishTaskCardModel) => void;
};

export function PublishTaskQueueTable({
  tab,
  cards,
  savingRowId,
  retryingTaskId,
  onSendToClient,
  onViewTask,
  onRetry,
  onBackfillLink,
  onMarkFailed,
}: Props) {
  return (
    <div className="overflow-x-auto" data-testid="publish-task-queue-table">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="py-2 pr-4 font-medium">平台</th>
            <th className="py-2 pr-4 font-medium">标题</th>
            <th className="py-2 pr-4 font-medium">账号</th>
            <th className="py-2 pr-4 font-medium">状态</th>
            <th className="py-2 pr-4 font-medium">创建时间</th>
            <th className="py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {cards.map(card => (
            <tr
              key={card.key}
              className="border-b border-gray-50 text-gray-800"
              data-testid={`publish-queue-row-${card.key}`}
            >
              <td className="py-3 pr-4 whitespace-nowrap">{card.platformLabel}</td>
              <td className="py-3 pr-4 max-w-[14rem]">
                <span className="line-clamp-2 font-medium text-gray-900">{card.title}</span>
              </td>
              <td className="py-3 pr-4 whitespace-nowrap">{card.accountLabel}</td>
              <td className="py-3 pr-4 whitespace-nowrap">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${card.statusBadgeClass}`}>
                  {card.statusLabel}
                </span>
              </td>
              <td className="py-3 pr-4 whitespace-nowrap text-gray-500">{card.timeLabel ?? "—"}</td>
              <td className="py-3">
                <div className="flex flex-wrap gap-1.5">
                  {(tab === "pending" || tab === "active") ? (
                    <Button
                      type="button"
                      size="sm"
                      className={`h-7 px-2 text-xs ${geoP0Brand.primary}`}
                      data-testid={`publish-queue-send-client-${card.key}`}
                      onClick={() => onSendToClient(card)}
                    >
                      发送到客户端
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
                    onClick={() => onViewTask(card)}
                  >
                    查看任务
                  </Button>
                  {card.canRetry && card.taskId ? (
                    <Button
                      type="button"
                      size="sm"
                      className={`h-7 px-2 text-xs ${geoP0Brand.primary}`}
                      disabled={retryingTaskId === card.taskId}
                      onClick={() => onRetry(card)}
                    >
                      {retryingTaskId === card.taskId ? "重试中…" : "重试"}
                    </Button>
                  ) : null}
                  {(tab === "published" || tab === "waiting_links" || tab === "failed") &&
                  (card.taskId || card.recordId) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
                      disabled={savingRowId === (card.taskId ?? card.recordId)}
                      onClick={() => onBackfillLink(card)}
                    >
                      {savingRowId === (card.taskId ?? card.recordId)
                        ? "保存中…"
                        : card.publishedUrl
                          ? "编辑链接"
                          : "回填链接"}
                    </Button>
                  ) : null}
                  {(tab === "failed" || tab === "waiting_links") ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
                      onClick={() => onMarkFailed(card)}
                    >
                      标记失败
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

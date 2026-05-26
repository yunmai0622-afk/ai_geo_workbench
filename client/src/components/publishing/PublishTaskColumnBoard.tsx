import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import type { PublishColumnId, PublishTaskCardModel } from "@/lib/publishCenterDisplay";

const COLUMN_META: Record<
  PublishColumnId,
  { title: string; description: string; testId: string }
> = {
  pending: {
    title: "待发布",
    description: "已入队，等待 Local Agent 处理",
    testId: "publish-column-pending",
  },
  active: {
    title: "发布中 / 待确认",
    description: "客户端处理中或需人工确认",
    testId: "publish-column-active",
  },
  done: {
    title: "已发布 / 待填链接",
    description: "发布完成或等待回填公开链接",
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
};

export function PublishTaskColumnBoard({
  columns,
  linkDraftByRecordId,
  savingRecordId,
  onPreview,
  onStartPublish,
  onSaveLink,
  onMarkAbnormal,
  onLinkDraftChange,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-testid="publish-task-columns">
      {(["pending", "active", "done"] as const).map(col => (
        <section key={col} data-testid={COLUMN_META[col].testId} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{COLUMN_META[col].title}</h2>
            <p className="text-xs text-gray-500">{COLUMN_META[col].description}</p>
          </div>
          {columns[col].length === 0 ? (
            <P0Card className="text-sm text-gray-500">暂无数据</P0Card>
          ) : (
            columns[col].map(card => (
              <P0Card key={card.key} testId={`publish-task-card-${card.key}`} className="space-y-2">
                <p className="font-medium text-gray-900 line-clamp-2">{card.title}</p>
                <p className="text-xs text-gray-600">
                  <span className="text-gray-500">平台：</span>
                  {card.platform}
                </p>
                <p className="text-xs text-gray-600">
                  <span className="text-gray-500">账号：</span>
                  {card.accountLabel}
                </p>
                {card.contentGoal ? (
                  <p className="text-xs text-gray-600">
                    <span className="text-gray-500">内容目标：</span>
                    {card.contentGoal}
                  </p>
                ) : null}
                {card.geoGap ? (
                  <p className="text-xs text-gray-600">
                    <span className="text-gray-500">GEO 缺口：</span>
                    {card.geoGap}
                  </p>
                ) : null}
                <p className="text-xs font-medium text-gray-700">状态：{card.statusLabel}</p>
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
                        className="h-8 text-xs"
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
                  {card.isAbnormal ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-amber-800 border-amber-200"
                      onClick={() => onMarkAbnormal(card)}
                    >
                      标记异常
                    </Button>
                  ) : null}
                </div>
              </P0Card>
            ))
          )}
        </section>
      ))}
    </div>
  );
}

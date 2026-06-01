import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import type { GeoArticleGenerationHistoryEntry } from "@shared/geoArticleGenerationHistory";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ArticleGenerationHistoryPanelProps = {
  projectId: number;
  articleId: number;
  disabled?: boolean;
  onRestored?: (payload: { title: string; markdownContent: string }) => void;
};

function formatHistoryTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function HistoryPreviewDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: GeoArticleGenerationHistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{entry?.title ?? "历史版本"}</DialogTitle>
          <DialogDescription>
            {entry ? `${formatHistoryTime(entry.createdAt)} · ${entry.statusLabel} · ${entry.sourceLabel}` : ""}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[min(60vh,480px)] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800">
          {entry?.markdownContent ?? ""}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

export function ArticleGenerationHistoryPanel({
  projectId,
  articleId,
  disabled,
  onRestored,
}: ArticleGenerationHistoryPanelProps) {
  const historyQuery = trpc.geo.articles.generationHistory.useQuery(
    { projectId, articleId },
    { enabled: articleId > 0 },
  );
  const restoreMutation = trpc.geo.articles.restoreGenerationHistory.useMutation({
    onSuccess: data => {
      toast.success("已恢复到所选历史版本");
      void historyQuery.refetch();
      if (data.article?.title && data.article.markdownContent) {
        onRestored?.({
          title: data.article.title,
          markdownContent: data.article.markdownContent,
        });
      }
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "恢复失败")),
  });
  const [previewEntry, setPreviewEntry] = useState<GeoArticleGenerationHistoryEntry | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const entries = historyQuery.data?.entries ?? [];
  const restorableCount = useMemo(
    () => entries.filter((e: GeoArticleGenerationHistoryEntry) => e.canRestore).length,
    [entries],
  );

  const openPreview = (entry: GeoArticleGenerationHistoryEntry) => {
    setPreviewEntry(entry);
    setPreviewOpen(true);
  };

  const handleRestore = (entry: GeoArticleGenerationHistoryEntry) => {
    if (!entry.canRestore || disabled || restoreMutation.isPending) return;
    const ok = window.confirm(
      `确定将当前正文恢复为「${entry.title.slice(0, 40)}${entry.title.length > 40 ? "…" : ""}」？恢复前会自动备份当前版本。`,
    );
    if (!ok) return;
    restoreMutation.mutate({ projectId, articleId, entryKey: entry.key });
  };

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white px-4 py-3"
      data-testid="article-generation-history"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">生成历史</p>
          <p className="mt-0.5 text-xs text-gray-500">
            含重新生成记录与质检/优化快照，共 {entries.length} 条
            {restorableCount > 0 ? `（可恢复 ${restorableCount} 条）` : ""}
          </p>
        </div>
        {historyQuery.isFetching ? <Spinner className="size-4 text-gray-400" /> : null}
      </div>

      {historyQuery.isLoading ? (
        <p className="mt-3 text-sm text-gray-500">加载历史记录…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">暂无生成历史</p>
      ) : (
        <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
          {entries.map((entry: GeoArticleGenerationHistoryEntry) => (
            <li
              key={entry.key}
              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              data-testid={`article-history-entry-${entry.key}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{entry.title}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {formatHistoryTime(entry.createdAt)} · {entry.statusLabel}
                  </p>
                  <p className="text-[11px] text-gray-400">{entry.sourceLabel}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-gray-200 px-2 text-xs"
                    data-testid={`article-history-view-${entry.key}`}
                    onClick={() => openPreview(entry)}
                  >
                    查看
                  </Button>
                  {entry.canRestore ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-gray-200 px-2 text-xs"
                      disabled={disabled || restoreMutation.isPending}
                      data-testid={`article-history-restore-${entry.key}`}
                      onClick={() => handleRestore(entry)}
                    >
                      恢复
                    </Button>
                  ) : (
                    <span className="inline-flex h-7 items-center px-2 text-[11px] text-gray-400">当前</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <HistoryPreviewDialog entry={previewEntry} open={previewOpen} onOpenChange={setPreviewOpen} />
    </section>
  );
}

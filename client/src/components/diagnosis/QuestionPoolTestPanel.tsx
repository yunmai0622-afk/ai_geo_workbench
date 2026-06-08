import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { toUserFacingQueryError } from "@shared/userFacingErrors";

function formatLastTestTime(value: string | null | undefined): string {
  if (!value) return "尚未发起";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未发起";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function QuestionPoolTestPanel(props: {
  projectId: number | null;
  enabled: boolean;
  canOperate: boolean;
}) {
  const { projectId, enabled, canOperate } = props;
  const utils = trpc.useUtils();
  const summaryQuery = trpc.geo.questionPoolTest.summary.useQuery(
    { projectId: projectId! },
    { enabled: enabled && Boolean(projectId) },
  );
  const startMutation = trpc.geo.questionPoolTest.start.useMutation({
    onSuccess: async () => {
      if (!projectId) return;
      await Promise.all([
        utils.geo.questionPoolTest.summary.invalidate({ projectId }),
        utils.geo.testRounds.list.invalidate({ projectId }),
        utils.geo.questions.list.invalidate({ projectId: projectId }),
      ]);
    },
  });

  const summary = summaryQuery.data;
  const isRunning = Boolean(summary?.runningRoundId) || startMutation.isPending;
  const errorMessage = startMutation.error
    ? toUserFacingQueryError(startMutation.error.message, "发起实测失败，请稍后重试")
    : summaryQuery.error
      ? toUserFacingQueryError(summaryQuery.error.message, "加载问题池实测信息失败")
      : null;

  return (
    <div
      className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm"
      data-testid="ai-diagnosis-question-pool-test"
    >
      <p className="text-sm font-semibold text-emerald-950">从问题池发起实测</p>
      <p className="mt-1 text-sm text-emerald-900">
        基于问题库中所有启用题目，在豆包 / DeepSeek / Kimi 等平台顺序实测，保存原始回答并自动抽取提及、推荐、竞品与引用来源。
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
          <p className="text-xs text-gray-500">可用于实测的题目数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800" data-testid="question-pool-enabled-count">
            {summaryQuery.isLoading ? "—" : (summary?.enabledQuestionCount ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-3">
          <p className="text-xs text-gray-500">上次基于问题池的实测时间</p>
          <p className="mt-1 text-sm font-medium text-emerald-900" data-testid="question-pool-last-test-at">
            {summaryQuery.isLoading ? "加载中…" : formatLastTestTime(summary?.lastQuestionPoolTestAt)}
          </p>
        </div>
      </div>
      {isRunning ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-900" data-testid="question-pool-test-running">
          <Spinner className="size-4" />
          问题池实测进行中，请稍候刷新查看进度…
        </div>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
        data-testid="question-pool-start-test"
        disabled={
          !canOperate ||
          !projectId ||
          isRunning ||
          summaryQuery.isLoading ||
          (summary?.enabledQuestionCount ?? 0) === 0
        }
        onClick={() => {
          if (!projectId) return;
          startMutation.mutate({ projectId });
        }}
      >
        {startMutation.isPending ? "正在发起…" : "基于问题池发起新一轮实测"}
      </Button>
    </div>
  );
}

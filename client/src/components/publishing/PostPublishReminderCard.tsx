import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onGoInclusionMonitoring: () => void;
};

/** 发布成功后的后续步骤提醒（发布中心页） */
export function PostPublishReminderCard({ visible, onDismiss, onGoInclusionMonitoring }: Props) {
  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="post-publish-reminder-card"
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950"
    >
      <p className="font-semibold text-emerald-900">内容已发布成功 ✅</p>
      <p className="mt-2 font-medium text-emerald-900">建议后续步骤：</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed text-emerald-900/90">
        <li>等待 7 天让 AI 平台收录内容</li>
        <li>在收录监测页执行 AI 实测</li>
        <li>对比发布前后的品牌提及率变化</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className={geoP0Brand.primary}
          data-testid="post-publish-reminder-go-monitoring"
          onClick={onGoInclusionMonitoring}
        >
          去收录监测
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={geoP0Brand.primaryOutline}
          data-testid="post-publish-reminder-dismiss"
          onClick={onDismiss}
        >
          知道了
        </Button>
      </div>
    </div>
  );
}

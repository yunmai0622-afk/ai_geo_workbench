import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  formatPublishSuccessBody,
  PUBLISH_SUCCESS_NEXT_STEP,
  PUBLISH_SUCCESS_NOTIFICATION_TITLE,
  PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL,
} from "@shared/publishSuccessNotification";
import { CheckCircle2, ExternalLink } from "lucide-react";

type Props = {
  visible: boolean;
  platformLabel: string;
  articleUrl?: string | null;
  onDismiss: () => void;
};

/** 发布成功后的醒目通知卡片（周内容 / 发布中心共用） */
export function PublishSuccessNotificationCard({
  visible,
  platformLabel,
  articleUrl,
  onDismiss,
}: Props) {
  if (!visible) return null;

  const body = formatPublishSuccessBody(platformLabel);
  const link = articleUrl?.trim() || null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="publish-success-notification-card"
      className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-green-50 px-6 py-5 shadow-lg shadow-emerald-200/60 ring-1 ring-emerald-400/30"
    >
      <div className="flex gap-4">
        <CheckCircle2
          className="mt-0.5 h-8 w-8 shrink-0 text-emerald-600"
          aria-hidden
          data-testid="publish-success-notification-icon"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p
            className="text-lg font-bold tracking-tight text-emerald-950"
            data-testid="publish-success-notification-title"
          >
            {PUBLISH_SUCCESS_NOTIFICATION_TITLE}
          </p>
          <p
            className="text-base font-medium text-emerald-900"
            data-testid="publish-success-notification-body"
          >
            {body}
          </p>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 underline decoration-blue-400 underline-offset-2 hover:text-blue-800"
              data-testid="publish-success-notification-view-article"
            >
              {PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
          <p
            className="text-sm font-medium text-emerald-800/90"
            data-testid="publish-success-notification-next-step"
          >
            下一步：{PUBLISH_SUCCESS_NEXT_STEP}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={`shrink-0 self-start ${geoP0Brand.primaryOutline}`}
          data-testid="publish-success-notification-dismiss"
          onClick={onDismiss}
        >
          知道了
        </Button>
      </div>
    </div>
  );
}

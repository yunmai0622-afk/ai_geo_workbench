import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  formatPublishSuccessBody,
  PUBLISH_SUCCESS_DISMISS_LABEL,
  PUBLISH_SUCCESS_GO_TO_INCLUSION_LABEL,
  PUBLISH_SUCCESS_NOTIFICATION_TITLE,
  PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL,
} from "@shared/publishSuccessNotification";
import { CheckCircle2, ExternalLink } from "lucide-react";

type Props = {
  visible: boolean;
  platformLabel: string;
  articleUrl?: string | null;
  onDismiss: () => void;
  /** 传入时展示发布中心主链路按钮（去收录监测 / 查看文章 / 知道了） */
  onGoToInclusionMonitoring?: () => void;
};

/** 发布成功后的醒目通知卡片（周内容 / 发布中心共用） */
export function PublishSuccessNotificationCard({
  visible,
  platformLabel,
  articleUrl,
  onDismiss,
  onGoToInclusionMonitoring,
}: Props) {
  if (!visible) return null;

  const body = formatPublishSuccessBody(platformLabel);
  const link = articleUrl?.trim() || null;
  const postPublishWorkflow = Boolean(onGoToInclusionMonitoring);

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
        <div className="min-w-0 flex-1 space-y-3">
          <p
            className="text-lg font-bold tracking-tight text-emerald-950"
            data-testid="publish-success-notification-title"
          >
            {PUBLISH_SUCCESS_NOTIFICATION_TITLE}
          </p>
          <p
            className="text-base font-medium leading-relaxed text-emerald-900"
            data-testid="publish-success-notification-body"
          >
            {body}
          </p>
          {postPublishWorkflow ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className={geoP0Brand.primary}
                data-testid="publish-success-notification-go-inclusion"
                onClick={onGoToInclusionMonitoring}
              >
                {PUBLISH_SUCCESS_GO_TO_INCLUSION_LABEL}
              </Button>
              {link ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={geoP0Brand.primaryOutline}
                  asChild
                >
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="publish-success-notification-view-article"
                  >
                    {PUBLISH_SUCCESS_VIEW_ARTICLE_LABEL}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={geoP0Brand.primaryOutline}
                data-testid="publish-success-notification-dismiss"
                onClick={onDismiss}
              >
                {PUBLISH_SUCCESS_DISMISS_LABEL}
              </Button>
            </div>
          ) : (
            <>
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
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`${geoP0Brand.primaryOutline}`}
                  data-testid="publish-success-notification-dismiss"
                  onClick={onDismiss}
                >
                  {PUBLISH_SUCCESS_DISMISS_LABEL}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

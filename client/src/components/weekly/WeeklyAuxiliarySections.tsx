import PlatformContentStrategyPanel from "@/components/PlatformContentStrategyPanel";
import { QuestionTemplatePicker } from "@/components/content/QuestionTemplatePicker";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import type { GeoContentTaskSource } from "@shared/geoContentTaskSource";
import type { PlatformContentStrategyInput } from "@shared/platformContentRules";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import { WeeklyPlatformArticleCard } from "@/components/weekly/WeeklyPlatformArticleCard";
import type { ContentReviewStatus } from "@shared/contentReviewStatus";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { Button } from "@/components/ui/button";

type Props = {
  source: GeoContentTaskSource | null;
  platformStrategy: PlatformContentStrategyInput;
  onPlatformStrategyChange: (next: PlatformContentStrategyInput) => void;
  targetQuestionOptions: string[];
  strategyDisabled?: boolean;
  historyCards: WeeklyArticleCardModel[];
  historyDisabled?: boolean;
  onHistoryView: (model: WeeklyArticleCardModel) => void;
  onHistoryRegenerate: (model: WeeklyArticleCardModel) => void;
  onHistoryEnqueue: (model: WeeklyArticleCardModel) => void;
  onHistoryGoPublishing?: () => void;
  onHistoryReviewChange?: (articleId: number, status: ContentReviewStatus) => void;
  selectedQuestionTemplateId?: number | null;
  onQuestionTemplateChange?: (id: number | null) => void;
  onGoInclusionMonitoring?: () => void;
};

function CollapsibleSection({
  testId,
  title,
  defaultOpen = false,
  children,
}: {
  testId: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="rounded-xl border border-gray-200 bg-white shadow-sm"
      data-testid={testId}
      open={defaultOpen ? undefined : false}
    >
      <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800 [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="space-y-4 border-t border-gray-100 p-4">{children}</div>
    </details>
  );
}

export function WeeklyAuxiliarySections({
  source,
  platformStrategy,
  onPlatformStrategyChange,
  targetQuestionOptions,
  strategyDisabled,
  historyCards,
  historyDisabled,
  onHistoryView,
  onHistoryRegenerate,
  onHistoryEnqueue,
  onHistoryGoPublishing,
  onHistoryReviewChange,
  selectedQuestionTemplateId,
  onQuestionTemplateChange,
  onGoInclusionMonitoring,
}: Props) {
  return (
    <section
      id="weekly-section-auxiliary"
      className="scroll-mt-24 space-y-3"
      data-testid="weekly-auxiliary-sections"
    >
      <p className="text-xs text-gray-500" data-testid="weekly-inclusion-retest-hint">
        发布完成后，可在「收录复测中心」查看 T1/T2/T3 复测结果。
        {onGoInclusionMonitoring ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs text-blue-700"
            data-testid="weekly-go-inclusion-monitoring"
            onClick={onGoInclusionMonitoring}
          >
            去收录复测中心
          </Button>
        ) : null}
      </p>

      {onQuestionTemplateChange ? (
        <CollapsibleSection testId="weekly-aux-template-library" title="查看内容模板库">
          <QuestionTemplatePicker
            platform={platformStrategy.targetPublishPlatform}
            value={selectedQuestionTemplateId ?? null}
            onChange={onQuestionTemplateChange}
            disabled={strategyDisabled}
          />
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection testId="weekly-aux-platform-rules" title="查看平台规则">
        <PlatformContentStrategyPanel
          value={platformStrategy}
          onChange={onPlatformStrategyChange}
          targetQuestionOptions={targetQuestionOptions}
          disabled={strategyDisabled}
        />
      </CollapsibleSection>

      {source ? (
        <CollapsibleSection testId="weekly-aux-ai-diagnosis" title="AI 可见度目标">
          <P0Card testId="weekly-ai-diagnosis-basis-collapsed">
            <dl className="space-y-3 text-sm text-gray-800">
              <div>
                <dt className="font-medium text-gray-500">诊断发现</dt>
                <dd className="mt-1 leading-relaxed" data-testid="weekly-diagnosis-finding">
                  {source.diagnosisFinding}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">内容缺口</dt>
                <dd className="mt-1" data-testid="weekly-content-gaps">
                  {source.contentGaps.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-gray-700">
                      {source.contentGaps.map(gap => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-600">诊断任务已就绪，缺口条目将随实测结果展示。</p>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">推荐补齐</dt>
                <dd className="mt-1" data-testid="weekly-recommend-fill">
                  {source.recommendFill}
                </dd>
              </div>
            </dl>
          </P0Card>
        </CollapsibleSection>
      ) : null}

      {historyCards.length > 0 ? (
        <CollapsibleSection testId="weekly-aux-history" title="历史内容记录">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {historyCards.map(model => (
              <WeeklyPlatformArticleCard
                key={model.id}
                model={model}
                disabled={historyDisabled}
                onView={() => onHistoryView(model)}
                onRegenerate={() => onHistoryRegenerate(model)}
                onEnqueuePublish={() => onHistoryEnqueue(model)}
                onGoPublishingPage={onHistoryGoPublishing}
                onContentReviewStatusChange={
                  onHistoryReviewChange
                    ? status => onHistoryReviewChange(model.id, status)
                    : undefined
                }
              />
            ))}
          </div>
        </CollapsibleSection>
      ) : null}
    </section>
  );
}

import PlatformContentStrategyPanel from "@/components/PlatformContentStrategyPanel";
import { ProfileAiUnderstandingPreview, type ProfileAiPreviewModel } from "@/components/enterpriseProfile/ProfileAiUnderstandingPreview";
import { P0Card } from "@/components/geo/P0UiPrimitives";
import { AiTaskProgressCard } from "@/components/geo/AiTaskProgressCard";
import { PlatformBatchGenerationPanel } from "@/components/weekly/PlatformBatchGenerationPanel";
import { WeeklyCollapsibleSection } from "@/components/weekly/WeeklyCollapsibleSection";
import { MotherArticleSummaryCard } from "@/components/weekly/ContentTaskProgressionView";
import { WeeklyPlatformArticleCard } from "@/components/weekly/WeeklyPlatformArticleCard";
import type { GeoContentTaskSource } from "@shared/geoContentTaskSource";
import type { PlatformContentStrategyInput } from "@shared/platformContentRules";
import type { WeeklyArticleCardModel } from "@/components/weekly/WeeklyPlatformArticleCard";
import type { ContentReviewStatus } from "@shared/contentReviewStatus";
import type { PlatformBatchQueueItem } from "@shared/platformBatchGeneration";
import type { AiTaskProgressErrorCategory } from "@shared/aiTaskProgress";
import { PLATFORM_CONTENT_PROGRESS_HINT_90S } from "@shared/aiTaskProgress";

type Props = {
  profilePreview: ProfileAiPreviewModel | null;
  source: GeoContentTaskSource | null;
  platformStrategy: PlatformContentStrategyInput;
  onPlatformStrategyChange: (next: PlatformContentStrategyInput) => void;
  targetQuestionOptions: string[];
  strategyDisabled?: boolean;
  platformBatchQueue: PlatformBatchQueueItem[] | null;
  platformBatchRunning: boolean;
  onStartBatch: () => void;
  onRetryBatchItem: (platformKey: string) => void;
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
  motherArticle?: {
    title: string | null;
    summary: string | null;
    status: string | null;
    onViewFull: () => void;
    onEdit: () => void;
    onApprove: () => void;
    approveDisabled?: boolean;
  } | null;
  generationLog?: {
    visible: boolean;
    platformLabel: string | null;
    stepLabel: string;
    stepDescription: string;
    percent: number;
    elapsedSec: number;
    status: "running" | "success" | "failed";
    errorCategory?: AiTaskProgressErrorCategory;
    errorMessage?: string;
    onRegenerate?: () => void;
    regenerateDisabled?: boolean;
  };
};

export function WeeklyAdvancedInfoSections({
  profilePreview,
  source,
  platformStrategy,
  onPlatformStrategyChange,
  targetQuestionOptions,
  strategyDisabled,
  platformBatchQueue,
  platformBatchRunning,
  onStartBatch,
  onRetryBatchItem,
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
  motherArticle,
  generationLog,
}: Props) {
  return (
    <section
      id="weekly-section-advanced-info"
      className="scroll-mt-24 space-y-3"
      data-testid="weekly-advanced-info-sections"
    >
      <WeeklyCollapsibleSection testId="weekly-aux-brand-keywords" title="查看品牌与关键词依据">
        {profilePreview ? (
          <ProfileAiUnderstandingPreview model={profilePreview} />
        ) : (
          <p className="text-sm text-gray-600">企业资料加载中或尚未完善，完善后可提升内容生成质量。</p>
        )}
      </WeeklyCollapsibleSection>

      <WeeklyCollapsibleSection testId="weekly-aux-platform-strategy" title="查看平台策略">
        <PlatformContentStrategyPanel
          value={platformStrategy}
          onChange={onPlatformStrategyChange}
          targetQuestionOptions={targetQuestionOptions}
          disabled={strategyDisabled}
        />
      </WeeklyCollapsibleSection>

      <WeeklyCollapsibleSection testId="weekly-aux-advanced-writing" title="查看高级写作设置">
        <PlatformBatchGenerationPanel
          queue={platformBatchQueue}
          running={platformBatchRunning}
          onStartBatch={onStartBatch}
          onRetry={onRetryBatchItem}
        />
      </WeeklyCollapsibleSection>

      <WeeklyCollapsibleSection testId="weekly-aux-reference-content" title="查看参考内容">
        {motherArticle?.title ? (
          <MotherArticleSummaryCard
            title={motherArticle.title}
            summary={motherArticle.summary}
            corePoints={null}
            status={motherArticle.status}
            onViewFull={motherArticle.onViewFull}
            onEdit={motherArticle.onEdit}
            onApprove={motherArticle.onApprove}
            approveDisabled={motherArticle.approveDisabled}
          />
        ) : null}
        {source ? (
          <P0Card testId="weekly-ai-diagnosis-basis-collapsed" className={motherArticle?.title ? "mt-4" : ""}>
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
            </dl>
          </P0Card>
        ) : (
          !motherArticle?.title ? (
            <p className="text-sm text-gray-600">暂无参考内容，生成平台稿后将在此展示。</p>
          ) : null
        )}
      </WeeklyCollapsibleSection>

      <WeeklyCollapsibleSection testId="weekly-aux-generation-diagnostics" title="查看生成日志与诊断">
        {generationLog?.visible && generationLog.platformLabel ? (
          <AiTaskProgressCard
            testId="platform-content-progress"
            title={`正在生成${generationLog.platformLabel}内容`}
            stepLabel={generationLog.stepLabel}
            stepDescription={generationLog.stepDescription}
            percent={generationLog.percent}
            elapsedSec={generationLog.elapsedSec}
            hint90s={PLATFORM_CONTENT_PROGRESS_HINT_90S}
            status={generationLog.status}
            errorCategory={generationLog.errorCategory}
            errorMessage={generationLog.errorMessage}
            onRegenerate={generationLog.onRegenerate}
            regenerateDisabled={generationLog.regenerateDisabled}
          />
        ) : (
          <p className="text-sm text-gray-600">暂无进行中的生成任务，开始生成后日志将在此展示。</p>
        )}
      </WeeklyCollapsibleSection>

      <WeeklyCollapsibleSection testId="weekly-aux-history" title="历史内容记录">
        {historyCards.length > 0 ? (
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
        ) : (
          <p className="text-sm text-gray-600">暂无历史内容记录。</p>
        )}
      </WeeklyCollapsibleSection>
    </section>
  );
}

export function buildProfilePreviewFromRecord(
  profile: Record<string, unknown> | null | undefined,
  brandName: string,
): ProfileAiPreviewModel | null {
  if (!profile) return null;
  const keywords = Array.isArray(profile.keywords)
    ? profile.keywords.map(String).filter(Boolean)
    : typeof profile.keywords === "string"
      ? profile.keywords.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
      : [];
  return {
    brandName: String(profile.brandName ?? profile.enterpriseName ?? brandName ?? ""),
    industry: String(profile.industry ?? ""),
    oneLiner: String(profile.oneLiner ?? profile.brandIntro ?? ""),
    productDesc: String(profile.productDesc ?? profile.coreProducts ?? ""),
    targetCustomer: String(profile.targetCustomer ?? ""),
    primaryPain: String(profile.primaryPain ?? ""),
    coreAdvantage: String(profile.coreAdvantage ?? ""),
    keywords,
  };
}

import { P0Card } from "@/components/geo/P0UiPrimitives";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import { Button } from "@/components/ui/button";
import {
  buildGeoHealthBriefText,
  resolveGeoHealthBriefT0Flags,
  type PublishRecordWeekRow,
} from "@shared/geoHealthBrief";
import { hasCompletedT0Baseline, hasCompletedT1Retest } from "@shared/workspaceMainChain";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type GeoHealthBriefCardProps = {
  enterpriseName: string;
  publishRecords: PublishRecordWeekRow[];
  articles: Array<{ status?: string | null }>;
  testRounds: Array<{
    roundType: string;
    status: string;
    finishedAt?: Date | string | null;
    id: string;
    roundName: string;
    platforms: string[];
    questionsCount: number;
    runsPerQuestion: number;
  }>;
  t0MentionRate: number | null;
  t0RecommendRate: number | null;
  monitoringMentionRate: number | null;
  monitoringRecommendRate: number | null;
  contentGapLine?: string | null;
  disabled?: boolean;
};

export function GeoHealthBriefCard({
  enterpriseName,
  publishRecords,
  articles,
  testRounds,
  t0MentionRate,
  t0RecommendRate,
  monitoringMentionRate,
  monitoringRecommendRate,
  contentGapLine,
  disabled,
}: GeoHealthBriefCardProps) {
  const [briefText, setBriefText] = useState<string | null>(null);

  const t0Flags = useMemo(() => resolveGeoHealthBriefT0Flags(testRounds), [testRounds]);

  const hasT0 =
    t0Flags.hasCompletedT0 ||
    hasCompletedT0Baseline(testRounds) ||
    (t0MentionRate != null && !Number.isNaN(t0MentionRate));

  function handleGenerate() {
    const result = buildGeoHealthBriefText({
      enterpriseName,
      publishRecords,
      allPublishRecords: publishRecords,
      articles,
      hasCompletedT0: hasT0,
      hasCompletedT1: t0Flags.hasCompletedT1 || hasCompletedT1Retest(testRounds),
      t0FinishedAt: t0Flags.t0FinishedAt,
      t0MentionRate: hasT0 ? t0MentionRate : null,
      t0RecommendRate: hasT0 ? t0RecommendRate : null,
      monitoringMentionRate,
      monitoringRecommendRate,
      contentGapLine,
    });
    setBriefText(result.text);
  }

  async function handleCopy() {
    if (!briefText) {
      toast.message("请先生成本周健康度简报");
      return;
    }
    try {
      await navigator.clipboard.writeText(briefText);
      toast.success("健康度简报已复制");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  }

  return (
    <P0Card testId="delivery-report-health-brief" className="border-emerald-100 bg-emerald-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={geoP0Surfaces.sectionTitle}>健康度简报</p>
          <p className="text-sm text-gray-600">
            基于本周发布记录与 AI 能见度诊断数据，一键生成可复制的周报摘要（规则生成，不调用 AI）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={geoP0Brand.primary}
            data-testid="delivery-report-health-brief-generate"
            disabled={disabled}
            onClick={handleGenerate}
          >
            生成本周摘要
          </Button>
          <Button
            type="button"
            variant="outline"
            className={geoP0Brand.primaryOutline}
            data-testid="delivery-report-health-brief-copy"
            disabled={disabled || !briefText}
            onClick={() => void handleCopy()}
          >
            复制文本
          </Button>
        </div>
      </div>
      {briefText ? (
        <pre
          className="mt-4 whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white p-4 text-sm leading-relaxed text-gray-800"
          data-testid="delivery-report-health-brief-body"
        >
          {briefText}
        </pre>
      ) : (
        <p className="mt-4 text-sm text-gray-500">点击「生成本周摘要」后，将在此展示可复制文本。</p>
      )}
    </P0Card>
  );
}

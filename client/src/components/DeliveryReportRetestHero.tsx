import { buildPublishRetestHeroContent, type PublishRetestHeroContent } from "@/lib/deliveryReportLightDisplay";
import type { AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import { useMemo } from "react";

type DeliveryReportRetestHeroProps = {
  publishCompare: AiTestEvidenceAggregate["publishCompare"];
};

function formatDeltaPointsLine(points: number): string {
  if (points > 0) return `+${points}个百分点`;
  if (points < 0) return `${points}个百分点`;
  return "持平";
}

function ComparisonHero({ content }: { content: Extract<PublishRetestHeroContent, { kind: "comparison" }> }) {
  const deltaText = formatDeltaPointsLine(content.deltaPoints);
  const deltaPositive = content.deltaPoints > 0;
  const deltaNeutral = content.deltaPoints === 0;

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800/80">复测效果一览</p>
      <p className="text-xl font-bold leading-snug text-gray-900 sm:text-2xl md:text-3xl">
        <span className="text-gray-700">发布前提及率：</span>
        <span className="tabular-nums text-gray-900">{content.beforePct}%</span>
        <span className="mx-2 inline-block text-sky-600 sm:mx-3" aria-hidden>
          →
        </span>
        <span className="text-gray-700">发布后提及率：</span>
        <span className="tabular-nums text-sky-700">{content.afterPct}%</span>
      </p>
      <p
        className={`text-2xl font-bold tabular-nums sm:text-3xl md:text-4xl ${
          deltaNeutral ? "text-gray-700" : deltaPositive ? "text-emerald-600" : "text-amber-700"
        }`}
      >
        变化：{deltaText}
      </p>
    </div>
  );
}

function WaitingT1Hero({ content }: { content: Extract<PublishRetestHeroContent, { kind: "waiting_t1" }> }) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-800/80">复测进度</p>
      <p className="text-3xl font-bold tabular-nums text-gray-900 sm:text-4xl md:text-5xl">
        优化前基线：{content.t0BaselinePct}%
      </p>
      <p className="text-lg font-semibold leading-relaxed text-sky-800 sm:text-xl md:text-2xl">
        等待发布后 7 天执行复测
      </p>
    </div>
  );
}

export function DeliveryReportRetestHero({ publishCompare }: DeliveryReportRetestHeroProps) {
  const content = useMemo(() => buildPublishRetestHeroContent(publishCompare), [publishCompare]);

  return (
    <section
      className="overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-5 py-8 shadow-md sm:px-8 sm:py-10"
      data-testid="delivery-report-retest-hero"
      aria-label="发布前后提及率复测对比"
    >
      {content.kind === "comparison" ? <ComparisonHero content={content} /> : <WaitingT1Hero content={content} />}
    </section>
  );
}

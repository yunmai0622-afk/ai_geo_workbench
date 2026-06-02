import { P0Card } from "@/components/geo/P0UiPrimitives";
import { PlatformContentGuidelineHelp } from "@/components/weekly/PlatformContentGuidelineHelp";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  formatCountsLine,
  type PlatformContentCounts,
  type WeeklyPlatformDef,
  type WeeklyPlatformKey,
} from "@/lib/weeklyPlatformBoard";

export type PlatformBoardRow = {
  def: WeeklyPlatformDef;
  counts: PlatformContentCounts;
  platformRole: string;
  platformGenerationGoal: string;
  publishHint: string;
};

type Props = {
  rows: PlatformBoardRow[];
  /** 批量生成等全局忙碌：禁用全部平台按钮 */
  boardBusy?: boolean;
  /** 当前正在生成的平台（仅禁用该平台「生成」按钮） */
  generatingPlatformKey?: WeeklyPlatformKey | null;
  onGenerate: (key: WeeklyPlatformDef["key"]) => void;
  onView: (key: WeeklyPlatformDef["key"]) => void;
};

export function PlatformContentBoard({
  rows,
  boardBusy = false,
  generatingPlatformKey = null,
  onGenerate,
  onView,
}: Props) {
  return (
    <section className="space-y-4" data-testid="weekly-platform-board">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>平台内容矩阵</h2>
        <p className={geoP0Surfaces.muted}>
          各平台围绕同一轮 GEO 内容任务独立生成，不支持一稿多发。请按平台分别生成本轮内容资产。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ def, counts, platformRole, platformGenerationGoal, publishHint }) => {
          const countsLine = formatCountsLine(counts);
          const hasContent = counts.pendingConfirm + counts.ready + counts.published > 0;
          const generatedCount = counts.pendingConfirm + counts.ready + counts.published;
          return (
            <P0Card key={def.key} testId={`weekly-platform-card-${def.key}`} className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-semibold text-gray-900">{def.label}</h3>
                <PlatformContentGuidelineHelp
                  platformLabel={def.label}
                  publishPlatformId={def.publishPlatformId}
                  testId={`platform-content-guideline-${def.key}`}
                />
              </div>
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-medium text-gray-500">平台内容角色：</span>
                <span data-testid="weekly-platform-role">{platformRole}</span>
              </p>
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-medium text-gray-500">本平台生成目标：</span>
                <span data-testid="weekly-platform-generation-goal">{platformGenerationGoal}</span>
              </p>
              <p className="mt-2 text-xs text-gray-500">
                适合内容类型：<span className="text-gray-800">{def.contentTypes}</span>
              </p>
              {countsLine ? (
                <>
                  <p className="mt-3 text-xs font-medium text-gray-700" data-testid="weekly-platform-counts">
                    待生成 {counts.pending} / 已生成 {generatedCount} / 可发布 {counts.ready} / 已发布{" "}
                    {counts.published}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">{countsLine}</p>
                </>
              ) : (
                <p className="mt-3 text-xs text-gray-400">暂无内容记录</p>
              )}
              <p className="mt-2 text-xs text-blue-700" data-testid={`weekly-platform-publish-hint-${def.key}`}>
                下一步发布提示：{publishHint}
              </p>
              <div className="mt-4 flex flex-1 flex-col gap-2 border-t border-gray-100 pt-4">
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  disabled={boardBusy || generatingPlatformKey === def.key}
                  data-testid={`weekly-generate-${def.key}`}
                  onClick={() => onGenerate(def.key)}
                >
                  {generatingPlatformKey === def.key ? "生成中…" : "生成该平台内容"}
                </Button>
                {hasContent ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={geoP0Brand.primaryOutline}
                    disabled={boardBusy}
                    data-testid={`weekly-view-${def.key}`}
                    onClick={() => onView(def.key)}
                  >
                    查看内容
                  </Button>
                ) : null}
              </div>
            </P0Card>
          );
        })}
      </div>
    </section>
  );
}

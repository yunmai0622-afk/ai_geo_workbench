import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
import {
  formatCountsLine,
  type PlatformContentCounts,
  type WeeklyPlatformDef,
} from "@/lib/weeklyPlatformBoard";

export type PlatformBoardRow = {
  def: WeeklyPlatformDef;
  counts: PlatformContentCounts;
};

type Props = {
  rows: PlatformBoardRow[];
  disabled?: boolean;
  onGenerate: (key: WeeklyPlatformDef["key"]) => void;
  onView: (key: WeeklyPlatformDef["key"]) => void;
};

export function PlatformContentBoard({ rows, disabled, onGenerate, onView }: Props) {
  return (
    <section className="space-y-4" data-testid="weekly-platform-board">
      <div className="space-y-1">
        <h2 className={geoP0Surfaces.sectionTitle}>平台内容看板</h2>
        <p className={geoP0Surfaces.muted}>
          不同平台独立生成，不支持一稿多发。请按平台分别生成本轮 GEO 内容。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ def, counts }) => {
          const countsLine = formatCountsLine(counts);
          const hasContent = counts.pendingConfirm + counts.ready + counts.published > 0;
          return (
            <P0Card key={def.key} testId={`weekly-platform-card-${def.key}`} className="flex flex-col">
              <h3 className="text-base font-semibold text-gray-900">{def.label}</h3>
              <p className="mt-1 text-xs text-gray-500">平台内容目标：{def.goal}</p>
              <p className="mt-2 text-xs text-gray-600">
                适合内容类型：<span className="text-gray-800">{def.contentTypes}</span>
              </p>
              {countsLine ? (
                <p className="mt-3 text-xs font-medium text-gray-700" data-testid="weekly-platform-counts">
                  {countsLine}
                </p>
              ) : (
                <p className="mt-3 text-xs text-gray-400">暂无内容记录</p>
              )}
              <div className="mt-4 flex flex-1 flex-col gap-2 border-t border-gray-100 pt-4">
                <Button
                  type="button"
                  size="sm"
                  className={geoP0Brand.primary}
                  disabled={disabled}
                  data-testid={`weekly-generate-${def.key}`}
                  onClick={() => onGenerate(def.key)}
                >
                  生成该平台内容
                </Button>
                {hasContent ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={geoP0Brand.primaryOutline}
                    disabled={disabled}
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

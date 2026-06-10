import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { T0ContentGapSuggestionsResult } from "@shared/t0ContentGapSuggestions";
import { Lightbulb } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type Props = {
  projectId: number;
  suggestions: T0ContentGapSuggestionsResult;
  className?: string;
};

export function T0ContentGapSuggestionsCard({ projectId, suggestions, className }: Props) {
  const [, setLocation] = useLocation();

  return (
    <section
      className={cn("geo-card border-amber-200 bg-gradient-to-br from-amber-50/90 to-white p-5", className)}
      data-testid="t0-content-gap-suggestions-card"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
          <Lightbulb className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-bold text-amber-950">AI 现状检测内容缺口建议</h2>
          <p className="text-xs text-amber-800/80">数据来源：ai_test_runs</p>
        </div>
      </div>

      <p className="text-sm font-medium text-gray-900" data-testid="t0-content-gap-headline">
        {suggestions.headline}
      </p>
      <ul className="mt-3 space-y-3">
        {suggestions.items.map(item => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid={`t0-content-gap-item-${item.id}`}
          >
            <p className="text-sm leading-relaxed text-gray-800">- {item.message}</p>
            <Button
              type="button"
              size="sm"
              className={cn("shrink-0", geoP0Brand.primary)}
              data-testid={`t0-content-gap-generate-${item.id}`}
              onClick={() => setLocation(buildProjectUrl(item.actionPath, projectId))}
            >
              立即生成
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

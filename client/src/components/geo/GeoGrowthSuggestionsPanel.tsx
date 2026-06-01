import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import type { GeoGrowthSuggestion } from "@shared/geoGrowthSuggestions";
import { TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type GeoGrowthSuggestionsPanelProps = {
  projectId?: number;
  suggestions: GeoGrowthSuggestion[];
  loading?: boolean;
  variant?: "sidebar" | "card";
  className?: string;
};

export function GeoGrowthSuggestionsPanel({
  projectId,
  suggestions,
  loading = false,
  variant = "card",
  className = "",
}: GeoGrowthSuggestionsPanelProps) {
  const [, setLocation] = useLocation();
  const isSidebar = variant === "sidebar";

  return (
    <section
      className={cn(
        isSidebar
          ? "rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4"
          : "rounded-xl border border-gray-200 bg-white p-5 shadow-sm",
        className,
      )}
      data-testid="geo-growth-suggestions-panel"
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg shadow-sm",
            isSidebar ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        </div>
        <h3 className={cn("font-bold", isSidebar ? "text-sm text-emerald-900" : "text-base text-gray-900")}>
          增长建议
        </h3>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">正在根据项目数据生成建议…</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-gray-500">当前指标与进度良好，暂无额外增长建议。</p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map(item => (
            <li
              key={item.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3",
                isSidebar ? "border-emerald-100 bg-white/80" : "border-gray-100 bg-gray-50/50",
              )}
              data-testid={`geo-growth-suggestion-${item.id}`}
            >
              <p className="text-sm leading-relaxed text-gray-800">{item.message}</p>
              {projectId ? (
                <Button
                  type="button"
                  size="sm"
                  variant={isSidebar ? "default" : "outline"}
                  className={cn(
                    "w-full sm:w-auto",
                    isSidebar ? geoP0Brand.primary : geoP0Brand.primaryOutline,
                  )}
                  data-testid={`geo-growth-suggestion-action-${item.id}`}
                  onClick={() => setLocation(buildProjectUrl(item.actionPath, projectId))}
                >
                  {item.actionLabel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

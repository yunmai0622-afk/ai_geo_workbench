import { BarChart3, CheckCircle2 } from "lucide-react";
import {
  AUTH_PRODUCT_NAME,
  AUTH_PRODUCT_SELLING_POINTS,
  AUTH_PRODUCT_TAGLINE,
} from "./authMarketing";
import { cn } from "@/lib/utils";

type AuthMarketingPanelProps = {
  compact?: boolean;
  className?: string;
};

export default function AuthMarketingPanel({ compact = false, className }: AuthMarketingPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        compact ? "items-center text-center" : "h-full justify-center px-10 py-12 xl:px-16",
        className,
      )}
    >
      <div className={cn("flex flex-col", compact ? "items-center gap-4" : "max-w-lg gap-8")}>
        <div className={cn("flex items-center gap-3", compact && "flex-col")}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div className={compact ? "text-center" : undefined}>
            <p className="text-sm font-medium text-blue-700">企业 GEO 内容增长</p>
            <h1
              className={cn(
                "font-semibold tracking-tight text-gray-900",
                compact ? "text-2xl" : "text-3xl",
              )}
            >
              {AUTH_PRODUCT_NAME}
            </h1>
          </div>
        </div>

        <p
          className={cn(
            "leading-relaxed text-gray-600",
            compact ? "max-w-sm text-sm" : "text-lg",
          )}
        >
          {AUTH_PRODUCT_TAGLINE}
        </p>

        <ul className={cn("space-y-3", compact && "max-w-sm text-left")}>
          {AUTH_PRODUCT_SELLING_POINTS.map(point => (
            <li key={point} className="flex gap-3 text-sm leading-6 text-gray-700">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

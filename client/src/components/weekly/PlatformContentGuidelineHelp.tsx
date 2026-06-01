import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PublishPlatformId } from "@shared/platformContentRules";
import {
  formatPlatformContentGuidelineLine,
  getPlatformContentGuideline,
  getPlatformContentGuidelineByPublishId,
} from "@shared/platformContentGuidelines";
import { CircleHelp } from "lucide-react";
import type { SyntheticEvent } from "react";

type Props = {
  platformLabel: string;
  publishPlatformId?: PublishPlatformId | null;
  className?: string;
  testId?: string;
  stopPropagation?: boolean;
};

export function PlatformContentGuidelineHelp({
  platformLabel,
  publishPlatformId,
  className,
  testId = "platform-content-guideline",
  stopPropagation = false,
}: Props) {
  const guideline =
    getPlatformContentGuideline(platformLabel) ??
    getPlatformContentGuidelineByPublishId(publishPlatformId);

  if (!guideline) return null;

  const blockParentActivation = (event: SyntheticEvent) => {
    if (!stopPropagation) return;
    event.stopPropagation();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
            className,
          )}
          data-testid={`${testId}-trigger`}
          aria-label={`查看${guideline.label}内容规范说明`}
          onClick={blockParentActivation}
          onPointerDown={blockParentActivation}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 border-gray-200 bg-white p-3 text-gray-900 shadow-lg"
        data-testid={testId}
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <p className="text-xs font-semibold text-gray-800">{guideline.label}内容建议</p>
        <p className="mt-0.5 text-[11px] text-gray-500">静态规范说明，供撰写与发布前参考</p>
        <p className="mt-2.5 text-sm leading-relaxed text-gray-700" data-testid={`${testId}-body`}>
          {formatPlatformContentGuidelineLine(guideline)}
        </p>
      </PopoverContent>
    </Popover>
  );
}

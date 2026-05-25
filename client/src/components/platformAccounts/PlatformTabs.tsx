import { aiChipActive, aiChipIdle } from "@/lib/aiProductUi";
import {
  BINDING_PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  platformCapabilityHint,
  type BindingPublishPlatform,
} from "@shared/platformAccountVerify";
import { cn } from "@/lib/utils";

type Props = {
  selectedPlatform: BindingPublishPlatform;
  platformCounts: Map<BindingPublishPlatform, number>;
  onSelect: (platform: BindingPublishPlatform) => void;
};

export function PlatformTabs({ selectedPlatform, platformCounts, onSelect }: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      data-testid="platform-account-tabs"
      role="tablist"
    >
      {BINDING_PUBLISH_PLATFORMS.map(platform => {
        const hint = platformCapabilityHint(platform);
        const count = platformCounts.get(platform) ?? 0;
        const label = PUBLISH_PLATFORM_LABELS[platform];
        return (
          <button
            key={platform}
            type="button"
            role="tab"
            aria-selected={selectedPlatform === platform}
            data-testid={`platform-tab-${platform}`}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
              selectedPlatform === platform ? aiChipActive : aiChipIdle,
            )}
            onClick={() => onSelect(platform)}
          >
            <span>
              {label} {count}
            </span>
            {hint ? (
              <span className="ml-1.5 text-[10px] text-amber-200/90" data-testid={`platform-pending-${platform}`}>
                {hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

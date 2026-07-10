import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { whiteLabel } from "@/lib/whiteLabel";

export function WhiteLabelBrandMark({ className }: { className?: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(whiteLabel.brandLogoUrl) && !logoFailed;

  return (
    <div
      className={cn("flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-600 text-white shadow-md", className)}
      style={whiteLabel.brandColor ? { backgroundColor: whiteLabel.brandColor } : undefined}
      data-testid="white-label-brand-mark"
    >
      {showLogo ? (
        <img
          src={whiteLabel.brandLogoUrl!}
          alt={`${whiteLabel.agencyName} Logo`}
          className="h-full w-full object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <BarChart3 className="h-6 w-6" aria-hidden />
      )}
    </div>
  );
}

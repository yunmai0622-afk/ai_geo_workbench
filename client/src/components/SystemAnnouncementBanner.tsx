import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  readDismissedAnnouncementVersion,
  shouldShowSystemAnnouncement,
  writeDismissedAnnouncementVersion,
} from "@shared/systemAnnouncement";
import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";

export function SystemAnnouncementBanner() {
  const { data: announcement } = trpc.adminConfig.systemAnnouncement.useQuery();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() =>
    readDismissedAnnouncementVersion(),
  );

  useEffect(() => {
    setDismissedVersion(readDismissedAnnouncementVersion());
  }, [announcement?.versionKey]);

  if (!announcement) return null;
  if (!shouldShowSystemAnnouncement(announcement, dismissedVersion)) return null;

  const handleDismiss = () => {
    if (!announcement.versionKey) return;
    writeDismissedAnnouncementVersion(announcement.versionKey);
    setDismissedVersion(announcement.versionKey);
  };

  return (
    <div
      className="sticky top-0 z-50 flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 md:px-6"
      role="status"
      data-testid="system-announcement-banner"
    >
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <p className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{announcement.body.trim()}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-amber-800 hover:bg-amber-100 hover:text-amber-950"
        aria-label="关闭公告"
        data-testid="system-announcement-dismiss"
        onClick={handleDismiss}
        disabled={!announcement.versionKey}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
